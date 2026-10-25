import { confirmResetOpen, exportJson, resetAll } from '../app/store';

/**
 * "Reset everything?" confirmation, with a chance to export the current world
 * first. A native <dialog>: Esc and the backdrop cancel, focus is trapped.
 */
export function ConfirmReset(): HTMLElement {
    const exportBtn = (
        <button className="btn" onClick={() => {
            exportJson();
            exportBtn.textContent = 'exported ✓';
        }}>export json</button>
    ) as HTMLButtonElement;

    const dialog = (
        <dialog className="confirm" aria-labelledby="confirm-reset-title">
            <h2 id="confirm-reset-title">reset everything?</h2>
            <p>
                This starts a fresh random world with default settings, stops the script and clears the
                script editor. Your layout and auto-limit settings are kept.
            </p>
            <p className="confirm-hint">Want to keep this world? Export it first.</p>
            <div className="confirm-actions">
                {exportBtn}
                <span className="spacer" />
                <button className="btn" onClick={() => confirmResetOpen.set(false)}>cancel</button>
                <button className="btn danger" onClick={() => {
                    confirmResetOpen.set(false);
                    void resetAll();
                }}>reset all</button>
            </div>
        </dialog>
    ) as HTMLDialogElement;

    // Esc / programmatic close → keep the signal in sync.
    dialog.addEventListener('close', () => confirmResetOpen.set(false));
    // Click on the backdrop (outside the dialog box) cancels.
    dialog.addEventListener('click', (ev) => {
        if (ev.target === dialog) confirmResetOpen.set(false);
    });

    confirmResetOpen.subscribe((open) => {
        if (open && !dialog.open) {
            exportBtn.textContent = 'export json';
            dialog.showModal();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    });

    return dialog;
}
