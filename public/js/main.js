import { loginAPI, fetchAcademicYears, fetchYearWorkGrades, fetchGPA } from './api.js';
import { setToken, removeToken, isAuthenticated } from './auth.js';
import { renderCacheIndicator, removeCacheIndicator } from './components/CacheIndicator.js';
import { renderYearWorkGrades } from './components/YearWorkRenderer.js';
import { renderGPA } from './components/GPARenderer.js';
import { renderPredictor } from './components/PredictorRenderer.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');
const loginError = document.getElementById('login-error');

const logoutBtn = document.getElementById('logout-btn');

const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

const yearWorkTabBtn = document.querySelector('[data-target="year-work-tab"]');
const gpaTabBtn = document.querySelector('[data-target="gpa-tab"]');
const predictorTabBtn = document.querySelector('[data-target="predictor-tab"]');

const yearWorkTab = document.getElementById('year-work-tab');
const gpaTab = document.getElementById('gpa-tab');
const predictorTab = document.getElementById('predictor-tab');
const pageTitle = document.getElementById('page-title');

const yearSelect = document.getElementById('year-select');

// --- State ---
let cachedAcademicYears = null;

// --- App Initialization ---
const checkAuthStatus = () => {
    if (isAuthenticated()) {
        showDashboard();
        initializeDashboard();
    } else {
        showLogin();
    }
};

const login = async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    loginBtn.disabled = true;
    loginError.classList.add('hidden');

    try {
        const data = await loginAPI(username, password);

        if (data.success) {
            setToken(data.token);
            showDashboard();
            initializeDashboard();
        } else {
            showLoginError(data.error);
        }
    } catch (err) {
        showLoginError('تعذر الاتصال بالخادم. الرجاء المحاولة لاحقاً.');
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        loginBtn.disabled = false;
    }
};

const logout = () => {
    removeToken();
    showLogin();
    document.getElementById('grades-container').innerHTML = '';
    document.getElementById('gpa-container').innerHTML = '';
    yearSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    yearSelect.disabled = true;
    cachedAcademicYears = null;
    removeCacheIndicator('year-work-cache-container');
    removeCacheIndicator('gpa-cache-container');
    removeCacheIndicator('predictor-cache-container');
};

const topNavbar = document.getElementById('top-navbar');

// --- View Navigation ---
const showLogin = () => {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    if(topNavbar) topNavbar.classList.add('hidden');
};

const showDashboard = () => {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    if(topNavbar) topNavbar.classList.remove('hidden');
};

const showLoginError = (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
};

const showLoader = () => {
    loader.classList.remove('hidden');
    errorContainer.classList.add('hidden');
    yearWorkTab.classList.add('hidden');
    gpaTab.classList.add('hidden');
};

const hideLoader = () => {
    loader.classList.add('hidden');
};

const showError = (msg) => {
    hideLoader();
    errorMessage.textContent = msg;
    errorContainer.classList.remove('hidden');
};

// --- Dashboard Logic ---
const initializeDashboard = async () => {
    showLoader();
    try {
        await loadAcademicYears();
        await loadYearWorkGrades('');
        yearWorkTab.classList.remove('hidden');
    } catch (error) {
        showError(error.message || 'حدث خطأ غير متوقع');
    }
};

const loadAcademicYears = async () => {
    if (cachedAcademicYears) return;

    const data = await fetchAcademicYears();
    if (data.success) {
        cachedAcademicYears = data.data;
        yearSelect.innerHTML = '';
        
        if (Array.isArray(cachedAcademicYears) && cachedAcademicYears.length > 0) {
            cachedAcademicYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year.Value;
                option.textContent = year.Text;
                if (year.Selected) option.selected = true;
                yearSelect.appendChild(option);
            });
            yearSelect.disabled = false;
        } else {
            yearSelect.innerHTML = '<option value="">لا توجد أعوام أكاديمية متاحة</option>';
        }
    } else {
        throw new Error(data.error);
    }
};

const loadYearWorkGrades = async (yearId, force = false) => {
    showLoader();
    const response = await fetchYearWorkGrades(yearId, force);
    const data = await response.json();

    if (data.success) {
        renderYearWorkGrades('grades-container', data.data);
        renderCacheIndicator('year-work-cache-container', data.updatedAt, () => loadYearWorkGrades(yearId, true));
        
        // Also render Predictor if the default year work is loaded (or current term is active)
        renderPredictor('predictor-container', data.data);
        renderCacheIndicator('predictor-cache-container', data.updatedAt, () => loadYearWorkGrades(yearId, true));
        
        hideLoader();
        yearWorkTab.classList.remove('hidden');
    } else {
        if (response.status === 401 || response.status === 403) logout();
        else throw new Error(data.error);
    }
};

const loadGPA = async (force = false) => {
    showLoader();
    const response = await fetchGPA(force);
    const data = await response.json();

    if (data.success) {
        renderGPA('gpa-container', data.data);
        renderCacheIndicator('gpa-cache-container', data.updatedAt, () => loadGPA(true));
        hideLoader();
        gpaTab.classList.remove('hidden');
    } else {
        if (response.status === 401 || response.status === 403) logout();
        else throw new Error(data.error);
    }
};

// --- Tab Logic ---
const switchTab = async (targetId) => {
    document.querySelectorAll('.sidebar-link').forEach(btn => btn.classList.remove('active'));
    const activeLink = document.querySelector(`[data-target="${targetId}"]`);
    activeLink.classList.add('active');
    
    // Update Page Title dynamically
    pageTitle.textContent = activeLink.getAttribute('data-title');

    errorContainer.classList.add('hidden');
    yearWorkTab.classList.add('hidden');
    gpaTab.classList.add('hidden');
    predictorTab.classList.add('hidden');

    if (targetId === 'year-work-tab') {
        const container = document.getElementById('grades-container');
        if (container.children.length === 0) {
            await loadYearWorkGrades(yearSelect.value);
        } else {
            yearWorkTab.classList.remove('hidden');
        }
    } else if (targetId === 'gpa-tab') {
        const container = document.getElementById('gpa-container');
        if (container.children.length === 0) {
            await loadGPA();
        } else {
            gpaTab.classList.remove('hidden');
        }
    } else if (targetId === 'predictor-tab') {
        const container = document.getElementById('predictor-container');
        if (container.children.length === 0) {
            await loadYearWorkGrades(yearSelect.value); // shares year work
            predictorTab.classList.remove('hidden');
        } else {
            predictorTab.classList.remove('hidden');
        }
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', login);
    logoutBtn.addEventListener('click', logout);
    
    retryBtn.addEventListener('click', () => {
        if (yearWorkTabBtn.classList.contains('active')) {
            initializeDashboard();
        } else {
            switchTab('gpa-tab');
        }
    });

    yearSelect.addEventListener('change', async (e) => {
        try {
            await loadYearWorkGrades(e.target.value);
        } catch (error) {
            showError(error.message || 'حدث خطأ أثناء جلب الدرجات');
        }
    });

    yearWorkTabBtn.addEventListener('click', () => switchTab('year-work-tab'));
    gpaTabBtn.addEventListener('click', () => switchTab('gpa-tab'));
    predictorTabBtn.addEventListener('click', () => switchTab('predictor-tab'));

    checkAuthStatus();
});
