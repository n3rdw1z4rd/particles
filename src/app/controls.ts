import { computed, Signal } from '@n3rdw1z4rd/smoke-ui';
import {
    applyMatrixPreset, beta, count, dims, editorOpen, exportJson, forceScale, frictionHalfLife,
    newWorld, paused, pickAndImportJson, pointSize, range, requestResetAll, restartWorld, runScript, scriptSource,
    scriptState, setDims, setSpeciesCount, shareLink, showBounds, species, step, timeScale,
    togglePause, trails,
} from './store';
import { autoTune, DockEdge, dockEdge, minSimRate, toggleUi } from './ui-state';
import { MAX_SPECIES } from '../core/world';

/* ------------------------------------------------------------------ */
/* The control panel described as data.                                 */
/*                                                                      */
/* Nothing here touches the DOM: the DOM panel (src/ui/controls-dom)    */
/* renders it today, and a three.js / WebXR panel can render the same   */
/* description later. All state flows through the store's signals, so   */
/* every renderer stays in sync for free.                               */
/* ------------------------------------------------------------------ */

type Text = string | Signal<string>;

interface Base {
    /** Hidden while this is false. */
    visible?: Signal<boolean>;
}

export interface SliderControl extends Base {
    kind: 'slider';
    label: string;
    signal: Signal<number>;
    min: number;
    max: number;
    step: number;
}

export interface ToggleControl extends Base {
    kind: 'toggle';
    label: string;
    signal: Signal<boolean>;
}

export interface ChoiceControl<T = any> extends Base {
    kind: 'choice';
    label?: string;
    options: { value: T; label: string }[];
    value: Signal<T>;
    /** Defaults to `value.set`. */
    select?: (value: T) => void;
}

export interface ButtonControl extends Base {
    kind: 'button';
    label: Text;
    title?: string;
    primary?: boolean;
    action: () => void;
}

export interface TextControl extends Base {
    kind: 'text';
    text: Text;
    /** Styling hint, e.g. a status class. */
    tone?: Signal<string>;
}

/** Widgets too specific for a generic control; each renderer supplies its own by id. */
export interface CustomControl extends Base {
    kind: 'custom';
    id: 'seed' | 'species' | 'matrix';
}

/** Lays its children out on one line (wrapping if needed). */
export interface RowControl extends Base {
    kind: 'row';
    controls: Control[];
}

export type Control =
    | SliderControl | ToggleControl | ChoiceControl | ButtonControl | TextControl | CustomControl | RowControl;

export interface Section {
    id: string;
    title: string;
    controls: Control[];
}

const when = (fn: () => boolean) => computed(fn);

const scriptStatus = computed(() => {
    const s = scriptState.get();
    return s.kind === 'running' ? '● script running' : s.kind === 'error' ? '✖ script error' : s.kind === 'pending' ? '⚠ script waiting' : s.kind === 'stopped' ? '■ script stopped' : '○ no script';
});

export const SECTIONS: Section[] = [
    {
        id: 'world',
        title: 'world',
        controls: [
            {
                kind: 'row',
                controls: [
                    { kind: 'choice', options: [{ value: 2, label: '2D' }, { value: 3, label: '3D' }], value: dims, select: setDims },
                    { kind: 'custom', id: 'seed' },
                    { kind: 'button', label: '🎲', title: 'new random world (n)', action: newWorld },
                ],
            },
            {
                kind: 'row',
                controls: [
                    { kind: 'button', label: computed(() => (paused.get() ? '▶ play' : '❚❚ pause')), title: 'pause / play (space)', action: togglePause },
                    { kind: 'button', label: 'step', title: 'advance one frame (.)', action: step },
                    { kind: 'button', label: 'restart', title: 'restart simulation (r)', action: restartWorld },
                    { kind: 'button', label: 'reset', title: 'reset everything (R)', action: requestResetAll },
                ],
            },
            { kind: 'slider', label: 'particles', signal: count, min: 100, max: 10000, step: 100 },
            { kind: 'toggle', label: 'auto-limit', signal: autoTune },
            { kind: 'slider', label: 'min sim fps', signal: minSimRate, min: 5, max: 60, step: 1, visible: autoTune },
            { kind: 'slider', label: 'speed', signal: timeScale, min: 0, max: 3, step: 0.05 },
        ],
    },
    {
        id: 'species',
        title: 'species',
        controls: [
            {
                kind: 'row',
                controls: [
                    { kind: 'custom', id: 'species' },
                    { kind: 'button', label: '−', title: 'remove a species', action: () => setSpeciesCount(species.get().length - 1) },
                    { kind: 'button', label: '+', title: `add a species (max ${MAX_SPECIES})`, action: () => setSpeciesCount(species.get().length + 1) },
                ],
            },
        ],
    },
    {
        id: 'matrix',
        title: 'matrix',
        controls: [
            { kind: 'custom', id: 'matrix' },
            {
                kind: 'row',
                controls: [
                    { kind: 'button', label: 'random', action: () => applyMatrixPreset('random') },
                    { kind: 'button', label: 'symmetric', title: 'average a→b and b→a', action: () => applyMatrixPreset('symmetric') },
                    { kind: 'button', label: 'invert', action: () => applyMatrixPreset('invert') },
                    { kind: 'button', label: 'snakes', action: () => applyMatrixPreset('snakes') },
                    { kind: 'button', label: 'zero', action: () => applyMatrixPreset('zero') },
                ],
            },
        ],
    },
    {
        id: 'physics',
        title: 'physics',
        controls: [
            { kind: 'slider', label: 'range', signal: range, min: 0.02, max: 0.4, step: 0.005 },
            { kind: 'slider', label: 'friction t½', signal: frictionHalfLife, min: 0.005, max: 0.5, step: 0.005 },
            { kind: 'slider', label: 'force', signal: forceScale, min: 0, max: 0.5, step: 0.005 },
            { kind: 'slider', label: 'beta', signal: beta, min: 0.05, max: 0.95, step: 0.01 },
        ],
    },
    {
        id: 'view',
        title: 'view',
        controls: [
            { kind: 'slider', label: 'point size', signal: pointSize, min: 1, max: 12, step: 0.5 },
            { kind: 'slider', label: 'trails', signal: trails, min: 0, max: 0.98, step: 0.01, visible: when(() => dims.get() === 2) },
            { kind: 'toggle', label: 'bounds', signal: showBounds, visible: when(() => dims.get() === 3) },
        ],
    },
    {
        id: 'script',
        title: 'script',
        controls: [
            {
                kind: 'row',
                controls: [
                    { kind: 'text', text: scriptStatus, tone: computed(() => `status-${scriptState.get().kind}`) },
                    {
                        kind: 'button',
                        label: computed(() => (scriptState.get().kind === 'pending' ? 'review' : 'edit')),
                        title: 'open the script editor (e)',
                        action: () => editorOpen.set(true),
                    },
                ],
            },
            {
                kind: 'button',
                label: '▶ run shared script',
                primary: true,
                action: () => void runScript(scriptSource.get()),
                visible: when(() => scriptState.get().kind === 'pending'),
            },
        ],
    },
    {
        id: 'share',
        title: 'share',
        controls: [
            {
                kind: 'row',
                controls: [
                    { kind: 'button', label: 'copy link', title: 'the whole world — matrix, params, script — in one URL', action: () => void shareLink() },
                    { kind: 'button', label: 'export json', action: exportJson },
                    { kind: 'button', label: 'import json', action: pickAndImportJson },
                ],
            },
        ],
    },
    {
        id: 'layout',
        title: 'layout',
        controls: [
            {
                kind: 'choice',
                label: 'dock',
                options: (['left', 'right', 'top', 'bottom'] as DockEdge[]).map((e) => ({ value: e, label: e })),
                value: dockEdge,
            },
            { kind: 'button', label: 'hide UI', title: 'hide UI (h)', action: toggleUi },
            {
                kind: 'text',
                text: 'space pause/play · . step · r restart · R reset all · n new · d 2D/3D · e script · p panel · h hide UI',
                tone: new Signal('shortcuts'),
            },
        ],
    },
];
