import { computed } from '@n3rdw1z4rd/smoke-ui';
import { Checkbox, Panel, Slider } from '@n3rdw1z4rd/smoke-ui-components';
import {
    applyMatrixPreset, beta, count, dims, editorOpen, exportJson, forceScale, frictionHalfLife,
    importJson, loadSeed, newWorld, paused, pointSize, range, resetWorld, runScript,
    scriptSource, scriptState, seed, setDims, setSpeciesColor, setSpeciesCount, shareLink,
    showBounds, species, step, timeScale, togglePause, trails,
} from '../app/store';
import { MAX_SPECIES } from '../core/world';
import { MatrixEditor } from './matrix-editor';

const Section = ({ title, open = true, children }: { title: string; open?: boolean; children?: any }) => {
    const el = (
        <details className="section">
            <summary>{title}</summary>
            <div className="section-body">{children}</div>
        </details>
    ) as HTMLDetailsElement;
    el.open = open;
    return el;
};

const Button = ({ label, title, onClick, className }: { label: any; title?: string; onClick: () => void; className?: any }) => (
    <button className={className ?? 'btn'} title={title ?? ''} onClick={onClick}>{label}</button>
);

const showIf = (cond: () => boolean) => computed(() => (cond() ? '' : 'none'));

function SpeciesList(): HTMLElement {
    const list = <div className="species-list" /> as HTMLElement;

    // smoke-ui has no keyed lists, so rebuild this small row whenever the set changes.
    // Inputs only hold event handlers (no subscriptions), so nothing leaks.
    species.subscribe((sp) => {
        list.textContent = '';
        sp.forEach((s, i) => {
            const input = <input
                type="color"
                value={s.color}
                title={s.name}
                onInput={(e: Event) => setSpeciesColor(i, (e.target as HTMLInputElement).value)}
            /> as HTMLInputElement;
            list.append(input);
        });
    });

    return list;
}

function SeedInput(): HTMLElement {
    const text = computed(() => String(seed.get()));
    return (
        <input
            className="seed-input"
            type="text"
            inputMode="numeric"
            value={text}
            title="seed — press Enter to load"
            onKeyDown={(e: KeyboardEvent) => {
                if (e.key !== 'Enter') return;
                const v = parseInt((e.target as HTMLInputElement).value);
                if (Number.isFinite(v)) loadSeed(v);
                (e.target as HTMLInputElement).blur();
            }}
        />
    ) as HTMLElement;
}

export function ControlPanel(): HTMLElement {
    const fileInput = <input
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) void importJson(file);
            (e.target as HTMLInputElement).value = '';
        }}
    /> as HTMLInputElement;

    const dimClass = (d: 2 | 3) => computed(() => (dims.get() === d ? 'seg active' : 'seg'));

    const scriptLabel = computed(() => {
        const s = scriptState.get();
        return s.kind === 'running' ? '● script running' : s.kind === 'error' ? '✖ script error' : s.kind === 'pending' ? '⚠ script waiting' : '○ no script';
    });
    const scriptLabelClass = computed(() => `script-pill status-${scriptState.get().kind}`);

    const speciesCount = computed(() => species.get().length);

    return (
        <aside className="control-panel">
            <Panel title="particles">
                <Section title="world">
                    <div className="row-buttons">
                        <div className="segmented">
                            <button className={dimClass(2)} onClick={() => setDims(2)}>2D</button>
                            <button className={dimClass(3)} onClick={() => setDims(3)}>3D</button>
                        </div>
                        <SeedInput />
                        <Button label="🎲" title="new random world (N)" onClick={newWorld} />
                    </div>
                    <div className="row-buttons">
                        <Button
                            label={computed(() => (paused.get() ? '▶ play' : '❚❚ pause'))}
                            title="Space"
                            onClick={togglePause}
                        />
                        <Button label="step" title="advance one frame (.)" onClick={step} />
                        <Button label="reset" title="respawn particles from the seed, keep the matrix (R)" onClick={resetWorld} />
                    </div>
                    <Slider label="particles" signal={count} min={100} max={10000} step={100} />
                    <Slider label="speed" signal={timeScale} min={0} max={3} step={0.05} />
                </Section>

                <Section title="species" open={false}>
                    <div className="row-buttons">
                        <SpeciesList />
                        <span className="spacer" />
                        <Button label="−" title="remove a species" onClick={() => setSpeciesCount(speciesCount.get() - 1)} />
                        <Button label="+" title={`add a species (max ${MAX_SPECIES})`} onClick={() => setSpeciesCount(speciesCount.get() + 1)} />
                    </div>
                </Section>

                <Section title="attraction matrix" open={false}>
                    <MatrixEditor />
                    <div className="row-buttons wrap">
                        <Button label="random" onClick={() => applyMatrixPreset('random')} />
                        <Button label="symmetric" title="average a→b and b→a" onClick={() => applyMatrixPreset('symmetric')} />
                        <Button label="invert" onClick={() => applyMatrixPreset('invert')} />
                        <Button label="snakes" onClick={() => applyMatrixPreset('snakes')} />
                        <Button label="zero" onClick={() => applyMatrixPreset('zero')} />
                    </div>
                </Section>

                <Section title="physics" open={false}>
                    <Slider label="range" signal={range} min={0.02} max={0.4} step={0.005} />
                    <Slider label="friction t½" signal={frictionHalfLife} min={0.005} max={0.5} step={0.005} />
                    <Slider label="force" signal={forceScale} min={0} max={0.5} step={0.005} />
                    <Slider label="beta" signal={beta} min={0.05} max={0.95} step={0.01} />
                </Section>

                <Section title="view" open={false}>
                    <Slider label="point size" signal={pointSize} min={1} max={12} step={0.5} />
                    <div style={{ display: showIf(() => dims.get() === 2) }}>
                        <Slider label="trails" signal={trails} min={0} max={0.98} step={0.01} />
                    </div>
                    <div style={{ display: showIf(() => dims.get() === 3) }}>
                        <Checkbox label="bounds" signal={showBounds} />
                    </div>
                </Section>

                <Section title="script" open={false}>
                    <div className="row-buttons">
                        <span className={scriptLabelClass}>{scriptLabel}</span>
                        <span className="spacer" />
                        <Button
                            label={computed(() => (scriptState.get().kind === 'pending' ? 'review' : 'edit'))}
                            title="open the script editor (E)"
                            onClick={() => editorOpen.set(true)}
                        />
                    </div>
                    <div style={{ display: showIf(() => scriptState.get().kind === 'pending') }} className="row-buttons">
                        <Button label="▶ run shared script" className="btn primary" onClick={() => void runScript(scriptSource.get())} />
                    </div>
                </Section>

                <Section title="share">
                    <div className="row-buttons wrap">
                        <Button label="copy link" title="the whole world — matrix, params, script — in one URL" onClick={() => void shareLink()} />
                        <Button label="export json" onClick={exportJson} />
                        <Button label="import json" onClick={() => fileInput.click()} />
                    </div>
                    {fileInput}
                </Section>

                <div className="shortcuts">
                    space pause/play · . step · r reset · R reset all· n new · d 2D/3D · e script · h hide UI
                </div>
            </Panel>
        </aside>
    ) as HTMLElement;
}
