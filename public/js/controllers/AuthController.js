import { loginAPI } from '../api.js';
import { setToken, removeToken, isAuthenticated, saveAccount } from '../auth.js';
import { appState } from '../services/AppState.js';
import { Dialog } from '../utils/Dialog.js';

/**
 * AuthController - Handles authorization state transitions, views (login vs dashboard),
 * handles credentials validation, and manages session logouts.
 */
export class AuthController {
    constructor(savedAccountsController, onAuthSuccess, onLogout) {
        this.savedAccountsController = savedAccountsController;
        this.onAuthSuccess = onAuthSuccess;
        this.onLogout = onLogout;

        this.loginView = document.getElementById('login-view');
        this.dashboardView = document.getElementById('dashboard-view');
        this.topNavbar = document.getElementById('top-navbar');

        this.loginForm = document.getElementById('login-form');
        this.loginBtn = document.getElementById('login-btn');
        this.btnText = this.loginBtn?.querySelector('.btn-text');
        this.btnLoader = this.loginBtn?.querySelector('.btn-loader');
        this.loginError = document.getElementById('login-error');

        this.logoutBtn = document.getElementById('logout-btn');
        this.logoutNavBtn = document.getElementById('logout-nav-btn');
    }

    /**
     * Registers submit and click listeners for auth controls.
     */
    init() {
        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.login(e));
        }
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.requestLogout());
        }
        if (this.logoutNavBtn) {
            this.logoutNavBtn.addEventListener('click', () => this.requestLogout());
        }

        // Toggle password visibility
        const togglePasswordBtn = document.getElementById('toggle-password-btn');
        const passwordInput = document.getElementById('password');
        if (togglePasswordBtn && passwordInput) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);

                const eyeIcon = document.getElementById('eye-icon');
                const eyeOffIcon = document.getElementById('eye-off-icon');
                if (eyeIcon && eyeOffIcon) {
                    if (type === 'password') {
                        eyeIcon.classList.remove('hidden');
                        eyeOffIcon.classList.add('hidden');
                    } else {
                        eyeIcon.classList.add('hidden');
                        eyeOffIcon.classList.remove('hidden');
                    }
                }
            });
        }
    }

    /**
     * Checks initial page authorization credentials status.
     */
    checkAuthStatus() {
        if (isAuthenticated()) {
            this.showDashboard();
            if (this.onAuthSuccess) this.onAuthSuccess();
        } else {
            this.showLogin();
        }
    }

    /**
     * Performs async authentication API validation.
     */
    async login(e) {
        e.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value;
        const password = passwordInput.value;

        if (this.btnText) this.btnText.classList.add('hidden');
        if (this.btnLoader) this.btnLoader.classList.remove('hidden');
        if (this.loginBtn) this.loginBtn.disabled = true;
        if (this.loginError) this.loginError.classList.add('hidden');

        try {
            const data = await loginAPI(username, password);

            if (data.success) {
                setToken(data.token);
                saveAccount(username, password);
                this.showDashboard();
                if (this.onAuthSuccess) this.onAuthSuccess();
            } else {
                this.showLoginError(data.error);
            }
        } catch (err) {
            this.showLoginError('تعذر الاتصال بالخادم. الرجاء المحاولة لاحقاً.');
        } finally {
            if (this.btnText) this.btnText.classList.remove('hidden');
            if (this.btnLoader) this.btnLoader.classList.add('hidden');
            if (this.loginBtn) this.loginBtn.disabled = false;
        }
    }

    /**
     * Clears all session keys, local state maps, and returns to login card.
     */
    performLogout() {
        removeToken();
        this.showLogin();

        // Clear application global cache memory
        appState.clearAll();
        if (this.onLogout) this.onLogout();
    }

    /**
     * Asks confirmation modal before executing clear session logout.
     */
    requestLogout() {
        Dialog.showConfirm(
            'تسجيل الخروج',
            'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
            'خروج',
            'إلغاء',
            () => this.performLogout()
        );
    }

    /**
     * Displays login view card.
     */
    showLogin() {
        if (this.loginView) this.loginView.classList.remove('hidden');
        if (this.dashboardView) this.dashboardView.classList.add('hidden');
        if (this.topNavbar) this.topNavbar.classList.add('hidden');
        if (this.savedAccountsController) this.savedAccountsController.render();
    }

    /**
     * Displays main dashboard content view.
     */
    showDashboard() {
        if (this.loginView) this.loginView.classList.add('hidden');
        if (this.dashboardView) this.dashboardView.classList.remove('hidden');
        if (this.topNavbar) this.topNavbar.classList.remove('hidden');
    }

    /**
     * Displays validation/API auth error message.
     */
    showLoginError(msg) {
        if (this.loginError) {
            this.loginError.textContent = msg;
            this.loginError.classList.remove('hidden');
        }
    }
}
