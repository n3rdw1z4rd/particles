import { Signal } from '@n3rdw1z4rd/smoke-ui';

/* ------------------------------------------------------------------ */
/* Layout state for the dockable panel — persisted per browser.         */
/* ------------------------------------------------------------------ */

export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

const STORAGE_KEY = 'particles.ui';

interface StoredUi {
    edge?: DockEdge;
    open?: boolean;
    tab?: string;
    sheet?: number;
    autoTune?: boolean;
    minSimRate?: number;
}

function load(): StoredUi {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

/** Phones and other narrow / touch-first screens start with a bottom sheet. */
export function isCompact(): boolean {
    return matchMedia('(max-width: 720px), (pointer: coarse) and (max-width: 1024px)').matches;
}

/** Bottom sheet on portrait phones; a side panel everywhere else (incl. landscape phones). */
function defaultEdge(): DockEdge {
    return isCompact() && innerHeight > innerWidth ? 'bottom' : 'right';
}

const stored = load();
const EDGES: DockEdge[] = ['left', 'right', 'top', 'bottom'];

export const dockEdge = new Signal<DockEdge>(EDGES.includes(stored.edge!) ? stored.edge! : defaultEdge());
export const dockOpen = new Signal<boolean>(stored.open ?? !isCompact());
export const activeTab = new Signal<string>(stored.tab ?? 'world');
/** Height of a bottom sheet as a fraction of the screen (set by dragging its grip). */
export const sheetFraction = new Signal<number>(
    typeof stored.sheet === 'number' ? Math.min(0.85, Math.max(0.2, stored.sheet)) : 0.5,
);
/** Lower the particle count automatically when the simulation can't keep up. */
export const autoTune = new Signal<boolean>(stored.autoTune ?? true);
/** Steps per second the auto-tuner tries to stay above. */
export const minSimRate = new Signal<number>(typeof stored.minSimRate === 'number' ? stored.minSimRate : 20);
/** Hides the dock and stats; the action bar shrinks to a single "show UI" button. */
export const uiHidden = new Signal(false);

function save(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ edge: dockEdge.get(), open: dockOpen.get(), tab: activeTab.get(), sheet: sheetFraction.get(), autoTune: autoTune.get(), minSimRate: minSimRate.get() }));
    } catch { /* storage unavailable — fine */ }
}

dockEdge.subscribe(save);
dockOpen.subscribe(save);
activeTab.subscribe(save);
sheetFraction.subscribe(save);
autoTune.subscribe(save);
minSimRate.subscribe(save);

export function toggleDock(): void {
    dockOpen.set(!dockOpen.get());
}

export function toggleUi(): void {
    uiHidden.set(!uiHidden.get());
}
