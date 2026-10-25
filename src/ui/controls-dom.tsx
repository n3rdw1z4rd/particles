import { computed, Signal } from '@n3rdw1z4rd/smoke-ui';
import { Checkbox, Slider } from '@n3rdw1z4rd/smoke-ui-components';
import type { Control, CustomControl, Section } from '../app/controls';
import { loadSeed, seed, setSpeciesColor, species } from '../app/store';
import { MatrixEditor } from './matrix-editor';

/* ------------------------------------------------------------------ */
/* DOM renderer for the control description in app/controls.ts         */
/* ------------------------------------------------------------------ */

function SeedInput(): HTMLElement {
    const commit = (input: HTMLInputElement) => {
        const v = parseInt(input.value);
        if (Number.isFinite(v) && v !== seed.get()) loadSeed(v);
        else input.value = String(seed.get());
    };

    return (
        <input
            className="seed-input"
            type="text"
            inputMode="numeric"
            enterKeyHint="go"
            value={computed(() => String(seed.get()))}
            title="seed — press Enter to load"
            onKeyDown={(e: KeyboardEvent) => {
                if (e.key !== 'Enter') return;
                commit(e.target as HTMLInputElement);
                (e.target as HTMLInputElement).blur();
            }}
            onChange={(e: Event) => commit(e.target as HTMLInputElement)}
        />
    ) as HTMLElement;
}

function SpeciesList(): HTMLElement {
    const list = <div className="species-list" /> as HTMLElement;

    // smoke-ui has no keyed lists, so rebuild this small row whenever the set changes.
    // Inputs only hold event handlers (no subscriptions), so nothing leaks.
    species.subscribe((sp) => {
        list.textContent = '';
        sp.forEach((s, i) => {
            list.append(<input
                type="color"
                value={s.color}
                title={s.name}
                aria-label={`${s.name} color`}
                onInput={(e: Event) => setSpeciesColor(i, (e.target as HTMLInputElement).value)}
            /> as HTMLInputElement);
        });
    });

    return list;
}

const CUSTOM: Record<CustomControl['id'], () => HTMLElement> = {
    seed: SeedInput,
    species: SpeciesList,
    matrix: MatrixEditor,
};

function renderControl(control: Control): HTMLElement {
    const el = build(control);
    if (control.visible) {
        const visible = control.visible;
        // `hidden` (not style.display) so a row's own inline display:flex survives being shown again.
        visible.subscribe((v) => (el.hidden = !v));
    }
    return el;
}

function build(c: Control): HTMLElement {
    switch (c.kind) {
        case 'slider':
            return Slider({ label: c.label, signal: c.signal, min: c.min, max: c.max, step: c.step }) as HTMLElement;

        case 'toggle':
            return Checkbox({ label: c.label, signal: c.signal }) as HTMLElement;

        case 'button':
            return (
                <button className={c.primary ? 'btn primary' : 'btn'} title={c.title ?? ''} onClick={c.action}>
                    {c.label}
                </button>
            ) as HTMLElement;

        case 'choice': {
            const select = c.select ?? ((v: any) => c.value.set(v));
            const group = (
                <div className="segmented" role="group">
                    {c.options.map((o) => (
                        <button
                            className={computed(() => (c.value.get() === o.value ? 'seg active' : 'seg'))}
                            aria-pressed={computed(() => String(c.value.get() === o.value))}
                            onClick={() => select(o.value)}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            ) as HTMLElement;
            return c.label ? <div className="smoke-row"><span>{c.label}</span>{group}</div> as HTMLElement : group;
        }

        case 'text':
            return (
                <span className={c.tone ? computed(() => `ctl-text ${(c.tone as Signal<string>).get()}`) : 'ctl-text'}>
                    {c.text}
                </span>
            ) as HTMLElement;

        case 'custom':
            return CUSTOM[c.id]();

        case 'row':
            return <div className="row-buttons">{c.controls.map(renderControl)}</div> as HTMLElement;
    }
}

export function renderSection(section: Section): HTMLElement {
    return (
        <div className="section-body" data-section={section.id}>
            {section.controls.map(renderControl)}
        </div>
    ) as HTMLElement;
}
