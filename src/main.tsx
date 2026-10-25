import { computed } from '@n3rdw1z4rd/smoke-ui';
import { setTheme } from '@n3rdw1z4rd/smoke-ui-components';
import {
    activeCount, boot, count, dims, editorOpen, fps, newWorld, simRate, resetWorld, resetAll, runScript, scriptSource,
    scriptState, seed, setDims, simTime, step, stopScript, togglePause,
} from './app/store';
import * as store from './app/store';
import { dockEdge, dockOpen, toggleDock, toggleUi, uiHidden } from './app/ui-state';
import { ActionBar } from './ui/action-bar';
import { Dock } from './ui/dock';
import { ScriptEditor } from './ui/script-editor';

setTheme({
    bg: 'rgba(17, 17, 17, 0.82)',
    bgElevated: '#1d1d1d',
    fg: '#d3d3d3',
    fgMuted: '#808080',
    accent: '#3fd1a4',
    border: '#3a3a3a',
    fontSizeMd: '12px',
});

const Stats = () => (
    <div className="stats">
        <span>{fps}</span> fps · sim <span>{simRate}</span> · <span>{computed(() => (activeCount.get() === count.get() ? String(count.get()) : `${activeCount.get()}/${count.get()}`))}</span> · {computed(() => `${dims.get()}D`)} · seed <span>{seed}</span> · t <span>{simTime}</span>s
    </div>
);

/** Shown when a shared link/file carries a script the user hasn't run before. */
const ScriptBanner = () => (
    <div className="banner" style={{ display: computed(() => (scriptState.get().kind === 'pending' ? '' : 'none')) }}>
        <span>This shared world includes a <b>script</b>. Scripts run as code in this page — review it first.</span>
        <span className="banner-actions">
            <button className="btn" onClick={() => editorOpen.set(true)}>review</button>
            <button className="btn primary" onClick={() => void runScript(scriptSource.get())}>run</button>
            <button className="btn" onClick={() => stopScript()}>ignore</button>
        </span>
    </div>
);

/*
 * Layout: the stage (canvas + overlays) takes whatever space the dock leaves,
 * so the panel never covers the simulation. `data-*` attributes on the shell
 * drive all of the docking CSS.
 */
const stage = (
    <main className="stage">
        <Stats />
        <ScriptBanner />
        <ActionBar />
        <ScriptEditor />
    </main>
) as HTMLElement;

const app = (
    <div
        className="app"
        data-edge={dockEdge}
        data-open={computed(() => String(dockOpen.get()))}
        data-ui-hidden={computed(() => String(uiHidden.get()))}
    >
        {stage}
        <Dock />
    </div>
) as HTMLElement;

document.getElementById('root')!.append(app);

/* ------------------------------------------------------------------ */
/* Keyboard shortcuts                                                   */
/* ------------------------------------------------------------------ */

function isTyping(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest('.cm-editor'));
}

window.addEventListener('keydown', (ev) => {
    if (isTyping(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    switch (ev.key) {
        case ' ': togglePause(); break;
        case '.': step(); break;
        case 'r': resetWorld(); break;
        case 'R': resetAll(); break;
        case 'n': newWorld(); break;
        case 'd': setDims(dims.get() === 2 ? 3 : 2); break;
        case 'e': editorOpen.set(true); break;
        case 'h': toggleUi(); break;
        case 'p': toggleDock(); break;
        default: return;
    }

    // Keep Space from also "clicking" whatever button has focus.
    (document.activeElement as HTMLElement | null)?.blur?.();
    ev.preventDefault();
});

void boot(stage);

// Console access for live tinkering: `particles.sim.set(0, 1, 0.5)`, `particles.store.newWorld()`, …
(window as any).particles = {
    get sim() { return store.sim; },
    store,
};
