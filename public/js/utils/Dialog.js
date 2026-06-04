/**
 * Dialog - Simple confirmation and dialog helper.
 */
export class Dialog {
    static confirmCallback = null;

    /**
     * Initializes global confirm dialog button listeners.
     */
    static init() {
        const confirmYesBtn = document.getElementById('confirm-yes-btn');
        const confirmNoBtn = document.getElementById('confirm-no-btn');

        if (confirmYesBtn) {
            confirmYesBtn.addEventListener('click', () => {
                if (this.confirmCallback) this.confirmCallback();
                this.hideConfirm();
            });
        }
        if (confirmNoBtn) {
            confirmNoBtn.addEventListener('click', () => this.hideConfirm());
        }
    }

    /**
     * Shows a confirmation modal dialog.
     */
    static showConfirm(title, message, yesText, noText, onConfirm) {
        const confirmModal = document.getElementById('confirm-modal');
        if (!confirmModal) return;

        const titleEl = confirmModal.querySelector('h3');
        const messageEl = document.getElementById('confirm-modal-message');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (yesBtn) yesBtn.textContent = yesText;
        if (noBtn) noBtn.textContent = noText;

        this.confirmCallback = onConfirm;
        confirmModal.classList.remove('hidden');
    }

    /**
     * Hides the confirmation modal dialog.
     */
    static hideConfirm() {
        const confirmModal = document.getElementById('confirm-modal');
        if (confirmModal) {
            confirmModal.classList.add('hidden');
        }
        this.confirmCallback = null;
    }
}
