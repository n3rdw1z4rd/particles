import { computed } from '@n3rdw1z4rd/smoke-ui';
import {
    dims, editorOpen, enterVR, paused, restartWorld, scriptState, setDims, step, togglePause, vrReady,
} from '../app/store';
import { toggleDock, toggleUi } from '../app/ui-state';
import { Icon } from './icons';

const Btn = ({ label, onClick, children, className, hidden, state }: {
    label: string; onClick: () => void; children?: any; className?: string; hidden?: () => boolean; state?: () => string;
}) => {
    const el = <button className={`fab-btn ${className ?? ''}`} aria-label={label} title={label} onClick={onClick}>{children}</button> as HTMLElement;
    if (hidden) computed(hidden).subscribe((h) => (el.hidden = h));
    if (state) computed(state).subscribe((s) => el.setAttribute('data-state', s));
    return el;
};

/** Floating, thumb-sized actions so nothing is keyboard-only. */
export function ActionBar(): HTMLElement {
    return (
        <div className="action-bar" role="toolbar" aria-label="simulation">
            <Btn label="play / pause (space)" onClick={togglePause}>
                <span className={computed(() => (paused.get() ? 'swap' : 'swap hide'))}><Icon name="play" /></span>
                <span className={computed(() => (paused.get() ? 'swap hide' : 'swap'))}><Icon name="pause" /></span>
            </Btn>
            <Btn label="step one frame (.)" onClick={step}><Icon name="step" /></Btn>
            <Btn label="restart simulation (r)" onClick={restartWorld}><Icon name="restart" /></Btn>
            <Btn label="switch 2D / 3D (d)" className="fab-text" onClick={() => setDims(dims.get() === 2 ? 3 : 2)}>
                {computed(() => (dims.get() === 2 ? '3D' : '2D'))}
            </Btn>
            <Btn
                label="script editor (e)"
                className="script-btn"
                state={() => scriptState.get().kind}
                onClick={() => editorOpen.set(!editorOpen.get())}
            >
                <Icon name="code" />
            </Btn>
            <Btn label="enter VR" className="fab-text" onClick={enterVR} hidden={() => !vrReady.get()}>
                <Icon name="vr" />
            </Btn>
            <Btn label="toggle panel (p)" onClick={toggleDock}><Icon name="panel" /></Btn>
            <Btn label="hide UI (h)" className="hide-ui" onClick={toggleUi}><Icon name="eyeOff" /></Btn>
            <Btn label="show UI (h)" className="show-ui" onClick={toggleUi}><Icon name="eye" /></Btn>
        </div>
    ) as HTMLElement;
}
