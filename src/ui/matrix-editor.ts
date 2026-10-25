import { Signal } from '@n3rdw1z4rd/smoke-ui';
import { markDirty, onFrame, sim, species } from '../app/store';

const HEADER = 16; // px for the species color dots along the top/left
const DRAG_SENSITIVITY = 0.01; // matrix units per px of vertical drag

function cellColor(v: number): string {
    // Diverging: rose for repel, teal for attract, near-black at zero.
    const t = Math.min(1, Math.abs(v));
    const hue = v >= 0 ? 160 : 350;
    return `hsl(${hue}, ${30 + t * 45}%, ${12 + t * 38}%)`;
}

/**
 * Canvas-based attraction-matrix editor.
 *
 * - Drag a cell up/down to change it (Shift = fine)
 * - Scroll over a cell to nudge it
 * - Double-click a cell to zero it
 *
 * Rows are "this species", columns are "feels about that species".
 */
export function MatrixEditor(): HTMLElement {
    const readout = new Signal('drag a cell ↕ · scroll to nudge · double-click = 0');

    const canvas = document.createElement('canvas');
    canvas.className = 'matrix-canvas';

    const wrap = document.createElement('div');
    wrap.className = 'matrix-editor';
    wrap.append(canvas);

    const text = document.createElement('div');
    text.className = 'matrix-readout';
    readout.subscribe((v) => (text.textContent = v));
    wrap.append(text);

    let drawnVersion = -1;
    let drawnSim: unknown = null;
    let drawnSpecies: unknown = null;
    let drawnWidth = 0;
    let hover: [number, number] | null = null;
    let drag: { a: number; b: number; y: number; start: number } | null = null;

    const layout = () => {
        const width = canvas.clientWidth || 260;
        const k = sim.k;
        const cell = (width - HEADER) / k;
        return { width, k, cell, height: HEADER + cell * k };
    };

    const cellAt = (ev: MouseEvent): [number, number] | null => {
        const { k, cell } = layout();
        const rect = canvas.getBoundingClientRect();
        const b = Math.floor((ev.clientX - rect.left - HEADER) / cell);
        const a = Math.floor((ev.clientY - rect.top - HEADER) / cell);
        return a >= 0 && b >= 0 && a < k && b < k ? [a, b] : null;
    };

    const describe = (a: number, b: number) => {
        const sp = species.get();
        const v = sim.get(a, b);
        const verb = v > 0.05 ? 'attracted to' : v < -0.05 ? 'repelled by' : 'indifferent to';
        readout.set(`${sp[a]?.name ?? a} is ${verb} ${sp[b]?.name ?? b}  (${v >= 0 ? '+' : ''}${v.toFixed(2)})`);
    };

    const draw = () => {
        const { width, k, cell, height } = layout();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.style.height = `${height}px`;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const sp = species.get();
        const dot = Math.min(5, HEADER / 3);

        for (let i = 0; i < k; i++) {
            ctx.fillStyle = sp[i]?.color ?? '#fff';
            ctx.beginPath();
            ctx.arc(HEADER + cell * (i + 0.5), HEADER / 2, dot, 0, Math.PI * 2);
            ctx.arc(HEADER / 2, HEADER + cell * (i + 0.5), dot, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.font = `${Math.max(9, Math.min(12, cell * 0.3))}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let a = 0; a < k; a++) {
            for (let b = 0; b < k; b++) {
                const v = sim.get(a, b);
                const x = HEADER + b * cell;
                const y = HEADER + a * cell;
                ctx.fillStyle = cellColor(v);
                ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

                if (hover && hover[0] === a && hover[1] === b) {
                    ctx.strokeStyle = '#ddd';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
                }

                if (cell >= 30) {
                    ctx.fillStyle = Math.abs(v) > 0.55 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.7)';
                    ctx.fillText(v.toFixed(2).replace(/^(-?)0\./, '$1.'), x + cell / 2, y + cell / 2 + 0.5);
                }
            }
        }

        drawnVersion = sim.matrixVersion;
        drawnSim = sim;
        drawnSpecies = sp;
        drawnWidth = width;
    };

    canvas.addEventListener('pointerdown', (ev) => {
        const hit = cellAt(ev);
        if (!hit) return;
        drag = { a: hit[0], b: hit[1], y: ev.clientY, start: sim.get(hit[0], hit[1]) };
        canvas.setPointerCapture(ev.pointerId);
        ev.preventDefault();
    });

    canvas.addEventListener('pointermove', (ev) => {
        if (drag) {
            const sens = ev.shiftKey ? DRAG_SENSITIVITY / 5 : DRAG_SENSITIVITY;
            sim.set(drag.a, drag.b, drag.start - (ev.clientY - drag.y) * sens);
            describe(drag.a, drag.b);
            return;
        }
        const hit = cellAt(ev);
        if (String(hit) !== String(hover)) {
            hover = hit;
            if (hit) describe(hit[0], hit[1]);
            draw();
        }
    });

    const endDrag = () => {
        if (drag) markDirty();
        drag = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => {
        if (drag) return;
        hover = null;
        draw();
    });

    canvas.addEventListener('dblclick', (ev) => {
        const hit = cellAt(ev);
        if (!hit) return;
        sim.set(hit[0], hit[1], 0);
        describe(hit[0], hit[1]);
        markDirty();
    });

    canvas.addEventListener('wheel', (ev) => {
        const hit = cellAt(ev);
        if (!hit) return;
        ev.preventDefault();
        const nudge = (ev.shiftKey ? 0.01 : 0.05) * -Math.sign(ev.deltaY);
        sim.set(hit[0], hit[1], sim.get(hit[0], hit[1]) + nudge);
        describe(hit[0], hit[1]);
        markDirty();
    }, { passive: false });

    // Redraw only when something actually changed (UI edit, script, preset, resize).
    onFrame(() => {
        if (
            sim !== drawnSim ||
            sim.matrixVersion !== drawnVersion ||
            species.get() !== drawnSpecies ||
            canvas.clientWidth !== drawnWidth
        ) {
            draw();
        }
    });

    return wrap;
}
