import { loginAPI, fetchAcademicYears, fetchYearWorkGrades, fetchGPA } from './api.js';
import { setToken, removeToken, isAuthenticated, saveAccount, getSavedAccounts, removeAccount } from './auth.js';
import { renderYearWorkGrades } from './components/YearWorkRenderer.js';
import { renderGPA } from './components/GPARenderer.js';
import { renderPredictor } from './components/PredictorRenderer.js';
import { initSearch, openSearch, openSubjectByName, setGPAData, addYearWorkData, clearSearchData, setSearchUnlocked, setSearchSyncing, setCurrentYearWorkGrades } from './search.js';

// --- DOM Elements ---
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');

const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const btnText = loginBtn.querySelector('.btn-text');
const btnLoader = loginBtn.querySelector('.btn-loader');
const loginError = document.getElementById('login-error');

const logoutBtn = document.getElementById('logout-btn');
const logoutNavBtn = document.getElementById('logout-nav-btn');

const loader = document.getElementById('loader');
const errorContainer = document.getElementById('error-container');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

const yearWorkTabBtn = document.querySelector('[data-target="year-work-tab"]');
const gpaTabBtn = document.querySelector('[data-target="gpa-tab"]');
const predictorTabBtn = document.querySelector('[data-target="predictor-tab"]');
const settingsTabBtn = document.querySelector('[data-target="settings-tab"]');

const yearWorkTab = document.getElementById('year-work-tab');
const gpaTab = document.getElementById('gpa-tab');
const predictorTab = document.getElementById('predictor-tab');
const settingsTab = document.getElementById('settings-tab');
const appWebVersionSpan = document.getElementById('app-web-version');
const pageTitle = document.getElementById('page-title');

const yearSelect = document.getElementById('year-select');

// --- State ---
let cachedAcademicYears = null;
let yearWorkCacheTime = null;
let gpaCacheTime = null;
let currentYearWorkGrades = null;
let currentYearWorkCacheTime = null;
let cachedGPAData = null;
const cachedYearWorkData = new Map();
let currentRevalidateCallback = null;

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
            saveAccount(username, password);
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

const performLogout = () => {
    removeToken();
    showLogin();
    document.getElementById('grades-container').innerHTML = '';
    document.getElementById('gpa-container').innerHTML = '';
    yearSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    yearSelect.disabled = true;
    cachedAcademicYears = null;
    yearWorkCacheTime = null;
    gpaCacheTime = null;
    currentYearWorkGrades = null;
    currentYearWorkCacheTime = null;
    cachedGPAData = null;
    cachedYearWorkData.clear();
    clearSearchData();
    hideNavCacheInfo();
};

const logout = () => {
    performLogout();
};

const requestLogout = () => {
    showConfirmModal(
        'تسجيل الخروج',
        'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
        'خروج',
        'إلغاء',
        () => {
            performLogout();
        }
    );
};

// --- Saved Accounts quick login logic ---

const renderSavedAccounts = () => {
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
        
        // Handle clicking on the item to login
        item.addEventListener('click', (e) => {
            if (e.target.closest('.saved-account-remove-btn')) {
                return;
            }
            
            document.getElementById('username').value = acc.username;
            document.getElementById('password').value = acc.password;
            
            // Trigger login form submit
            const event = new Event('submit', { cancelable: true });
            loginForm.dispatchEvent(event);
        });
        
        // Handle clicking on remove button
        const removeBtn = item.querySelector('.saved-account-remove-btn');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeleteConfirmation(acc.username);
        });
        
        savedAccountsList.appendChild(item);
    });
};

// --- Saved Accounts quick login logic ---
let confirmCallback = null;

const showConfirmModal = (title, message, yesText, noText, onConfirm) => {
    if (!confirmModal) return;
    const titleEl = confirmModal.querySelector('h3');
    const messageEl = document.getElementById('confirm-modal-message');
    const yesBtn = document.getElementById('confirm-yes-btn');
    const noBtn = document.getElementById('confirm-no-btn');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (yesBtn) {
        yesBtn.textContent = yesText;
    }
    if (noBtn) noBtn.textContent = noText;
    
    confirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
};

const hideConfirmModal = () => {
    if (confirmModal) {
        confirmModal.classList.add('hidden');
    }
    confirmCallback = null;
};

const showDeleteConfirmation = (username) => {
    showConfirmModal(
        'تأكيد الحذف',
        `هل أنت متأكد من رغبتك في حذف الحساب "${username}" من هذا الجهاز؟`,
        'حذف',
        'إلغاء',
        () => {
            removeAccount(username);
            renderSavedAccounts();
        }
    );
};

const topNavbar = document.getElementById('top-navbar');

// --- View Navigation ---
const showLogin = () => {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    if(topNavbar) topNavbar.classList.add('hidden');
    renderSavedAccounts();
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

const checkAndUnlockSearch = () => {
    const hasGPA = !!cachedGPAData;
    const hasAllYears = cachedAcademicYears && cachedAcademicYears.every(y => cachedYearWorkData.has(y.Value));
    if (hasGPA && hasAllYears) {
        setSearchUnlocked(true);
    } else {
        setSearchUnlocked(false);
    }
};

// --- Dashboard Logic ---
const initializeDashboard = async () => {
    showLoader();
    try {
        await loadAcademicYears();
        await loadYearWorkGrades('');
        yearWorkTab.classList.remove('hidden');
        
        checkAndUnlockSearch();
        
        // Start background prefetching to populate search index for all terms/years
        backgroundPrefetchAll();
    } catch (error) {
        showError(error.message || 'حدث خطأ غير متوقع');
    }
};

const backgroundPrefetchAll = async () => {
    // 1. Prefetch GPA
    try {
        const response = await fetchGPA(false);
        const data = await response.json();
        if (data.success) {
            cachedGPAData = data.data;
            gpaCacheTime = data.updatedAt;
            setGPAData(data.data);
        }
    } catch (err) {
        console.warn('Background GPA prefetch failed:', err);
    }

    // 2. Prefetch other year work grades
    if (cachedAcademicYears && Array.isArray(cachedAcademicYears)) {
        for (const year of cachedAcademicYears) {
            if (cachedYearWorkData.has(year.Value)) continue;
            try {
                const response = await fetchYearWorkGrades(year.Value, false);
                const data = await response.json();
                if (data.success) {
                    cachedYearWorkData.set(year.Value, { data: data.data, updatedAt: data.updatedAt });
                    addYearWorkData(year.Text, data.data);
                }
            } catch (err) {
                console.warn(`Background year work prefetch failed for ${year.Text}:`, err);
            }
        }
    }
    
    checkAndUnlockSearch();
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

const updateNavCacheInfo = (updatedAt, onRevalidateCallback) => {
    const navCacheInfo = document.getElementById('nav-cache-info');
    const navCacheTime = document.getElementById('nav-cache-time');
    
    if (!navCacheInfo || !navCacheTime) return;
    
    if (!updatedAt) {
        navCacheInfo.classList.add('hidden');
        currentRevalidateCallback = null;
        return;
    }
    
    navCacheInfo.classList.remove('hidden');
    currentRevalidateCallback = onRevalidateCallback;
    
    // Format date safely
    let dateStr = updatedAt;
    if (typeof dateStr === 'string') {
        if (dateStr.includes(' ') && !dateStr.includes('T')) {
            dateStr = dateStr.replace(' ', 'T');
        }
        if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-Z') && !dateStr.includes('Z')) {
            dateStr += 'Z';
        }
    }
    const date = new Date(dateStr);
    const timeStr = !isNaN(date.getTime()) 
        ? date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: 'numeric', hour12: true })
        : 'الآن';
    navCacheTime.textContent = timeStr;
};

const hideNavCacheInfo = () => {
    const navCacheInfo = document.getElementById('nav-cache-info');
    if (navCacheInfo) navCacheInfo.classList.add('hidden');
    currentRevalidateCallback = null;
};

const loadPredictorData = async (force = false) => {
    // If we already have currentYearWorkGrades and it's not a forced refresh, just render it
    if (currentYearWorkGrades && !force) {
        renderPredictor('predictor-container', currentYearWorkGrades);
        updateNavCacheInfo(currentYearWorkCacheTime, () => loadPredictorData(true));
        predictorTab.classList.remove('hidden');
        return;
    }
    
    showLoader();
    const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
    if (force && navRevalidateBtn) {
        navRevalidateBtn.classList.add('spinning');
        navRevalidateBtn.disabled = true;
    }
    try {
        const response = await fetchYearWorkGrades('', force);
        const data = await response.json();

        if (data.success) {
            currentYearWorkGrades = data.data;
            currentYearWorkCacheTime = data.updatedAt;
            
            cachedYearWorkData.set('', { data: data.data, updatedAt: data.updatedAt });
            
            renderPredictor('predictor-container', currentYearWorkGrades);
            
            // If the user hasn't selected another year in the year-work dropdown,
            // we can also update the year work tab's cache time and grades display.
            if (!yearSelect.value) { 
                renderYearWorkGrades('grades-container', data.data, openSubjectByName);
                yearWorkCacheTime = data.updatedAt;
            }
            
            const ywYearLabel = yearSelect.options[yearSelect.selectedIndex]?.text || '';
            if (ywYearLabel) addYearWorkData(ywYearLabel, data.data);
            setCurrentYearWorkGrades(currentYearWorkGrades, ywYearLabel);
            
            const activeLink = document.querySelector('.sidebar-link.active');
            const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
            if (activeTargetId === 'predictor-tab') {
                updateNavCacheInfo(currentYearWorkCacheTime, () => loadPredictorData(true));
            }
            
            hideLoader();
            predictorTab.classList.remove('hidden');
        } else {
            if (response.status === 401 || response.status === 403) logout();
            else throw new Error(data.error);
        }
    } finally {
        if (navRevalidateBtn) {
            navRevalidateBtn.classList.remove('spinning');
            navRevalidateBtn.disabled = false;
        }
    }
};

const loadYearWorkGrades = async (yearId, force = false) => {
    if (cachedYearWorkData.has(yearId) && !force) {
        const cached = cachedYearWorkData.get(yearId);
        renderYearWorkGrades('grades-container', cached.data, openSubjectByName);
        yearWorkCacheTime = cached.updatedAt;
        
        if (yearId === '') {
            currentYearWorkGrades = cached.data;
            currentYearWorkCacheTime = cached.updatedAt;
            renderPredictor('predictor-container', currentYearWorkGrades);
            
            let ywYearLabel = '';
            if (cachedAcademicYears) {
                const opt = cachedAcademicYears.find(y => y.Value === yearId);
                if (opt) ywYearLabel = opt.Text;
            }
            if (!ywYearLabel && yearId === '') {
                ywYearLabel = yearSelect.options[yearSelect.selectedIndex]?.text || '';
            }
            setCurrentYearWorkGrades(currentYearWorkGrades, ywYearLabel);
        }
        
        const activeLink = document.querySelector('.sidebar-link.active');
        const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
        if (activeTargetId === 'year-work-tab') {
            updateNavCacheInfo(yearWorkCacheTime, () => loadYearWorkGrades(yearId, true));
        }
        yearWorkTab.classList.remove('hidden');
        return;
    }

    showLoader();
    const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
    if (force && navRevalidateBtn) {
        navRevalidateBtn.classList.add('spinning');
        navRevalidateBtn.disabled = true;
    }
    try {
        const response = await fetchYearWorkGrades(yearId, force);
        const data = await response.json();

        if (data.success) {
            cachedYearWorkData.set(yearId, { data: data.data, updatedAt: data.updatedAt });
            
            renderYearWorkGrades('grades-container', data.data, openSubjectByName);
            
            // If we are loading the default/latest year (yearId === '')
            if (yearId === '') {
                currentYearWorkGrades = data.data;
                currentYearWorkCacheTime = data.updatedAt;
                renderPredictor('predictor-container', currentYearWorkGrades);
            }
            
            let ywYearLabel = '';
            if (cachedAcademicYears) {
                const opt = cachedAcademicYears.find(y => y.Value === yearId);
                if (opt) ywYearLabel = opt.Text;
            }
            if (!ywYearLabel && yearId === '') {
                ywYearLabel = yearSelect.options[yearSelect.selectedIndex]?.text || '';
            }
            if (ywYearLabel) {
                addYearWorkData(ywYearLabel, data.data);
            }
            if (yearId === '') {
                setCurrentYearWorkGrades(currentYearWorkGrades, ywYearLabel);
            }
            
            yearWorkCacheTime = data.updatedAt;
            const activeLink = document.querySelector('.sidebar-link.active');
            const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
            if (activeTargetId === 'year-work-tab') {
                updateNavCacheInfo(yearWorkCacheTime, () => loadYearWorkGrades(yearId, true));
            }
            
            checkAndUnlockSearch();
            hideLoader();
            yearWorkTab.classList.remove('hidden');
        } else {
            if (response.status === 401 || response.status === 403) logout();
            else throw new Error(data.error);
        }
    } finally {
        if (navRevalidateBtn) {
            navRevalidateBtn.classList.remove('spinning');
            navRevalidateBtn.disabled = false;
        }
    }
};

const loadGPA = async (force = false) => {
    if (cachedGPAData && !force) {
        renderGPA('gpa-container', cachedGPAData, openSubjectByName);
        setGPAData(cachedGPAData);
        updateNavCacheInfo(gpaCacheTime, () => loadGPA(true));
        gpaTab.classList.remove('hidden');
        return;
    }

    showLoader();
    const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
    if (force && navRevalidateBtn) {
        navRevalidateBtn.classList.add('spinning');
        navRevalidateBtn.disabled = true;
    }
    try {
        const response = await fetchGPA(force);
        const data = await response.json();

        if (data.success) {
            cachedGPAData = data.data;
            renderGPA('gpa-container', data.data, openSubjectByName);
            setGPAData(data.data);
            gpaCacheTime = data.updatedAt;
            const activeLink = document.querySelector('.sidebar-link.active');
            const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
            if (activeTargetId === 'gpa-tab') {
                updateNavCacheInfo(gpaCacheTime, () => loadGPA(true));
            }
            checkAndUnlockSearch();
            hideLoader();
            gpaTab.classList.remove('hidden');
        } else {
            if (response.status === 401 || response.status === 403) logout();
            else throw new Error(data.error);
        }
    } finally {
        if (navRevalidateBtn) {
            navRevalidateBtn.classList.remove('spinning');
            navRevalidateBtn.disabled = false;
        }
    }
};

let fetchedVersion = null;
const loadSettings = async () => {
    // Init culture selector
    const cultureSelect = document.getElementById('ums-culture-select');
    if (cultureSelect) {
        const saved = localStorage.getItem('ums_culture') || 'ar';
        cultureSelect.value = saved;
        
        if (!cultureSelect.dataset.listenerAdded) {
            cultureSelect.dataset.listenerAdded = 'true';
            cultureSelect.addEventListener('change', (e) => {
                const newLang = e.target.value;
                localStorage.setItem('ums_culture', newLang);
                // Clear in-memory caches so next tab switch re-fetches in the new language
                cachedGPAData = null;
                gpaCacheTime = null;
                cachedAcademicYears = null;
                cachedYearWorkData.clear();
                clearSearchData();
                setSearchUnlocked(false);
                // Also clear rendered content to avoid stale UI
                document.getElementById('grades-container').innerHTML = '';
                document.getElementById('gpa-container').innerHTML = '';
            });
        }
    }

    if (fetchedVersion) return;
    try {
        const response = await fetch('/api/version');
        const data = await response.json();
        if (data.success) {
            fetchedVersion = data.version;
            appWebVersionSpan.textContent = fetchedVersion;
        } else {
            appWebVersionSpan.textContent = '1.0.0';
        }
    } catch (e) {
        console.error('Failed to fetch app version:', e);
        appWebVersionSpan.textContent = '1.0.0';
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
    settingsTab.classList.add('hidden');

    if (targetId === 'year-work-tab') {
        const container = document.getElementById('grades-container');
        if (container.children.length === 0) {
            await loadYearWorkGrades(yearSelect.value);
        } else {
            yearWorkTab.classList.remove('hidden');
            updateNavCacheInfo(yearWorkCacheTime, () => loadYearWorkGrades(yearSelect.value, true));
        }
    } else if (targetId === 'gpa-tab') {
        const container = document.getElementById('gpa-container');
        if (container.children.length === 0) {
            await loadGPA();
        } else {
            gpaTab.classList.remove('hidden');
            updateNavCacheInfo(gpaCacheTime, () => loadGPA(true));
        }
    } else if (targetId === 'predictor-tab') {
        await loadPredictorData();
    } else if (targetId === 'settings-tab') {
        hideNavCacheInfo();
        await loadSettings();
        settingsTab.classList.remove('hidden');
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', login);
    logoutBtn.addEventListener('click', requestLogout);
    if (logoutNavBtn) logoutNavBtn.addEventListener('click', requestLogout);

    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            hideConfirmModal();
        });
    }
    if (confirmNoBtn) confirmNoBtn.addEventListener('click', hideConfirmModal);
    
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
    settingsTabBtn.addEventListener('click', () => switchTab('settings-tab'));

    const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
    if (navRevalidateBtn) {
        navRevalidateBtn.addEventListener('click', async () => {
            if (currentRevalidateCallback) {
                await currentRevalidateCallback();
            }
        });
    }

    // --- Search ---
    initSearch(async () => {
        setSearchSyncing(true);
        try {
            // 1. Fetch GPA if not cached
            if (!cachedGPAData) {
                const response = await fetchGPA(false);
                const data = await response.json();
                if (data.success) {
                    cachedGPAData = data.data;
                    gpaCacheTime = data.updatedAt;
                    setGPAData(data.data);
                }
            }

            // 2. Fetch all academic years if not cached
            if (cachedAcademicYears && Array.isArray(cachedAcademicYears)) {
                for (const year of cachedAcademicYears) {
                    if (!cachedYearWorkData.has(year.Value)) {
                        const response = await fetchYearWorkGrades(year.Value, false);
                        const data = await response.json();
                        if (data.success) {
                            cachedYearWorkData.set(year.Value, { data: data.data, updatedAt: data.updatedAt });
                            addYearWorkData(year.Text, data.data);
                        }
                    }
                }
            }
            checkAndUnlockSearch();
        } catch (err) {
            console.error('مزامنة البحث فشلت:', err);
            alert('فشلت المزامنة: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setSearchSyncing(false);
        }
    });

    const searchNavBtn = document.getElementById('search-nav-btn');
    if (searchNavBtn) searchNavBtn.addEventListener('click', openSearch);

    checkAuthStatus();
});
