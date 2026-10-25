import { computed } from '@n3rdw1z4rd/smoke-ui';
import { setTheme } from '@n3rdw1z4rd/smoke-ui-components';
import {
    boot, count, dims, editorOpen, fps, newWorld, resetWorld, resetAll, runScript, scriptSource,
    scriptState, seed, setDims, simTime, step, stopScript, togglePause,
} from './app/store';
import * as store from './app/store';
import { ControlPanel } from './ui/panel';
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
        <span>{fps}</span> fps · <span>{count}</span> particles · {computed(() => `${dims.get()}D`)} · seed <span>{seed}</span> · t <span>{simTime}</span>s
    </div>
);

/** Shown when a shared link/file carries a script the user hasn't run before. */
const ScriptBanner = () => (
    <div className="banner" style={{ display: computed(() => (scriptState.get().kind === 'pending' ? '' : 'none')) }}>
        <span>This shared world includes a <b>script</b>. Scripts run as code in this page — review it first.</span>
        <button className="btn" onClick={() => editorOpen.set(true)}>review</button>
        <button className="btn primary" onClick={() => void runScript(scriptSource.get())}>run</button>
        <button className="btn" onClick={() => stopScript()}>ignore</button>
    </div>
);

const root = document.getElementById('root')!;
root.append(<Stats />, <ScriptBanner />, <ControlPanel />, <ScriptEditor />);

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
        case 'h': document.body.classList.toggle('ui-hidden'); break;
        default: return;
    }

    ev.preventDefault();
});

void boot(root);

// Console access for live tinkering: `particles.sim.set(0, 1, 0.5)`, `particles.store.newWorld()`, …
(window as any).particles = {
    get sim() { return store.sim; },
    store,
};
