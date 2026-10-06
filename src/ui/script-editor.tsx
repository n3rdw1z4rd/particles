import { computed } from '@n3rdw1z4rd/smoke-ui';
import {
    editorOpen, runningScript, runScript, scriptSource, scriptState, stopScript,
} from '../app/store';
import { SCRIPT_EXAMPLES } from '../core/script';

type CodeMirrorView = import('codemirror').EditorView;

let view: CodeMirrorView | null = null;
let loading: Promise<void> | null = null;

/** Lazily loads CodeMirror the first time the editor opens. */
async function ensureEditor(host: HTMLElement): Promise<void> {
    if (view) return;
    if (loading) return loading;

    loading = (async () => {
        const [{ EditorView, basicSetup }, { javascript }, { oneDark }, { keymap }] = await Promise.all([
            import('codemirror'),
            import('@codemirror/lang-javascript'),
            import('@codemirror/theme-one-dark'),
            import('@codemirror/view'),
        ]);

        host.textContent = '';

        view = new EditorView({
            parent: host,
            doc: scriptSource.get() || SCRIPT_EXAMPLES[0].source,
            extensions: [
                keymap.of([
                    { key: 'Mod-Enter', run: () => { void runScript(view!.state.doc.toString()); return true; } },
                    { key: 'Mod-s', run: () => { void runScript(view!.state.doc.toString()); return true; } },
                    { key: 'Escape', run: () => { editorOpen.set(false); return true; } },
                ]),
                basicSetup,
                javascript(),
                oneDark,
                EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Consolas, monospace' } }),
                EditorView.updateListener.of((u) => {
                    if (u.docChanged) scriptSource.set(u.state.doc.toString());
                }),
            ],
        });

        if (!scriptSource.get()) scriptSource.set(view.state.doc.toString());
    })();

    return loading;
}

function setDoc(source: string): void {
    scriptSource.set(source);
    if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
}

// Keep the editor in sync when a script arrives from outside (link/import).
scriptSource.subscribe((src) => {
    if (view && view.state.doc.toString() !== src) {
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: src } });
    }
});

export function ScriptEditor(): HTMLElement {
    const host = <div className="script-host"><div className="script-loading">loading editor…</div></div> as HTMLElement;

    const statusText = computed(() => {
        const s = scriptState.get();
        const modified = s.kind === 'running' && scriptSource.get() !== runningScript.get();
        switch (s.kind) {
            case 'running': return modified ? '● running (edited — Ctrl/⌘+Enter to apply)' : '● running';
            case 'pending': return `⚠ ${s.message}`;
            case 'error': return `✖ ${s.message}`;
            default: return '○ not running · Ctrl/⌘+Enter to run';
        }
    });
    const statusClass = computed(() => `script-status status-${scriptState.get().kind}`);

    const drawer = (
        <section className={computed(() => (editorOpen.get() ? 'script-drawer open' : 'script-drawer'))}>
            <header className="script-header">
                <strong>script</strong>
                <select
                    onChange={(e: Event) => {
                        const i = Number((e.target as HTMLSelectElement).value);
                        if (!Number.isNaN(i) && SCRIPT_EXAMPLES[i]) setDoc(SCRIPT_EXAMPLES[i].source);
                        (e.target as HTMLSelectElement).value = '';
                    }}
                >
                    <option value="">examples…</option>
                    {SCRIPT_EXAMPLES.map((ex, i) => <option value={String(i)}>{ex.name}</option>)}
                </select>
                <span className="spacer" />
                <button className="btn primary" title="Ctrl/⌘+Enter" onClick={() => void runScript()}>▶ run</button>
                <button className="btn" onClick={() => stopScript()}>■ stop</button>
                <button className="btn icon" title="close (Esc)" onClick={() => editorOpen.set(false)}>✕</button>
            </header>
            {host}
            <pre className={statusClass}>{statusText}</pre>
        </section>
    ) as HTMLElement;

    editorOpen.subscribe((open) => {
        if (!open) return;
        void ensureEditor(host).then(() => view?.focus());
    });

    return drawer;
}
