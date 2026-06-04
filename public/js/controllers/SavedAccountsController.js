import { getSavedAccounts, removeAccount } from '../auth.js';
import { Dialog } from '../utils/Dialog.js';

/**
 * SavedAccountsController - Controls UI list of saved user accounts,
 * triggers quick login on click, and handles removal confirmations.
 */
export class SavedAccountsController {
    constructor(loginFormId = 'login-form', usernameInputId = 'username', passwordInputId = 'password') {
        this.loginForm = document.getElementById(loginFormId);
        this.usernameInput = document.getElementById(usernameInputId);
        this.passwordInput = document.getElementById(passwordInputId);
    }

    /**
     * Renders saved accounts list from localStorage.
     */
    render() {
        const savedAccountsSection = document.getElementById('saved-accounts-section');
        const savedAccountsList = document.getElementById('saved-accounts-list');

        if (!savedAccountsSection || !savedAccountsList) return;

        const accounts = getSavedAccounts();

        if (accounts.length === 0) {
            savedAccountsSection.classList.add('hidden');
            return;
        }

        savedAccountsSection.classList.remove('hidden');
        savedAccountsList.innerHTML = '';

        accounts.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'saved-account-item';

            const firstLetter = acc.username ? acc.username.charAt(0).toUpperCase() : 'U';

            item.innerHTML = `
                <div class="saved-account-info">
                    <div class="saved-account-avatar">${firstLetter}</div>
                    <div class="saved-account-username">${acc.username}</div>
                </div>
                <button class="saved-account-remove-btn" title="حذف الحساب" data-username="${acc.username}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            `;

            // Quick login on click
            item.addEventListener('click', (e) => {
                if (e.target.closest('.saved-account-remove-btn')) {
                    return;
                }

                if (this.usernameInput && this.passwordInput) {
                    this.usernameInput.value = acc.username;
                    this.passwordInput.value = acc.password;

                    // Trigger form submission
                    const event = new Event('submit', { cancelable: true });
                    this.loginForm.dispatchEvent(event);
                }
            });

            // Remove button click
            const removeBtn = item.querySelector('.saved-account-remove-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeleteConfirmation(acc.username);
            });

            savedAccountsList.appendChild(item);
        });
    }

    /**
     * Shows confirmation popup before deleting account from disk.
     */
    showDeleteConfirmation(username) {
        Dialog.showConfirm(
            'تأكيد الحذف',
            `هل أنت متأكد من رغبتك في حذف الحساب "${username}" من هذا الجهاز؟`,
            'حذف',
            'إلغاء',
            () => {
                removeAccount(username);
                this.render();
            }
        );
    }
}
