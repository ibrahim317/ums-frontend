import { fetchAcademicYears, fetchYearWorkGrades, fetchGPA, fetchCurrentCourses, fetchMyAccountInfo } from '../api.js';
import { appState } from '../services/AppState.js';
import { renderYearWorkGrades } from '../components/YearWorkRenderer.js';
import { renderGPA } from '../components/GPARenderer.js';
import { renderPredictor } from '../components/PredictorRenderer.js';

/**
 * DashboardController - Orchestrates academic year selections, tab views,
 * background data prefetching, cache timing sync, and main panels rendering.
 */
export class DashboardController {
    constructor(searchService, updaterService, logoutCallback, searchController) {
        this.searchService = searchService;
        this.updaterService = updaterService;
        this.logoutCallback = logoutCallback;
        this.searchController = searchController;

        this.loader = document.getElementById('loader');
        this.errorContainer = document.getElementById('error-container');
        this.errorMessage = document.getElementById('error-message');
        this.retryBtn = document.getElementById('retry-btn');

        this.yearSelect = document.getElementById('year-select');

        this.yearWorkTab = document.getElementById('year-work-tab');
        this.gpaTab = document.getElementById('gpa-tab');
        this.predictorTab = document.getElementById('predictor-tab');
        this.analyticsTab = document.getElementById('analytics-tab');
        this.settingsTab = document.getElementById('settings-tab');
        this.appWebVersionSpan = document.getElementById('app-web-version');
        this.pageTitle = document.getElementById('page-title');

        this.yearWorkTabBtn = document.querySelector('[data-target="year-work-tab"]');
        this.gpaTabBtn = document.querySelector('[data-target="gpa-tab"]');
        this.predictorTabBtn = document.querySelector('[data-target="predictor-tab"]');
        this.analyticsTabBtn = document.querySelector('[data-target="analytics-tab"]');
        this.settingsTabBtn = document.querySelector('[data-target="settings-tab"]');

        this.fetchedVersion = null;
    }

    /**
     * Attaches DOM event listeners for navigation, selectors, and revalidation buttons.
     */
    init() {
        if (this.yearWorkTabBtn) this.yearWorkTabBtn.addEventListener('click', () => this.switchTab('year-work-tab'));
        if (this.gpaTabBtn) this.gpaTabBtn.addEventListener('click', () => this.switchTab('gpa-tab'));
        if (this.predictorTabBtn) this.predictorTabBtn.addEventListener('click', () => this.switchTab('predictor-tab'));
        if (this.analyticsTabBtn) this.analyticsTabBtn.addEventListener('click', () => this.switchTab('analytics-tab'));
        if (this.settingsTabBtn) this.settingsTabBtn.addEventListener('click', () => this.switchTab('settings-tab'));

        if (this.yearSelect) {
            this.yearSelect.addEventListener('change', async (e) => {
                try {
                    await this.loadYearWorkGrades(e.target.value);
                } catch (error) {
                    this.showError(error.message || 'حدث خطأ أثناء جلب الدرجات');
                }
            });
        }

        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => {
                if (this.yearWorkTabBtn && this.yearWorkTabBtn.classList.contains('active')) {
                    this.initializeDashboard();
                } else {
                    this.switchTab('gpa-tab');
                }
            });
        }

        const checkUpdateBtn = document.getElementById('check-update-btn');
        if (checkUpdateBtn) {
            checkUpdateBtn.addEventListener('click', () => {
                this.updaterService.checkUpdates(true);
            });
        }

        const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
        if (navRevalidateBtn) {
            navRevalidateBtn.addEventListener('click', async () => {
                if (appState.currentRevalidateCallback) {
                    await appState.currentRevalidateCallback();
                }
            });
        }
    }

    /**
     * Resets dashboard HTML elements and clears navigation cache display.
     */
    resetUI() {
        const gradesContainer = document.getElementById('grades-container');
        const gpaContainer = document.getElementById('gpa-container');
        if (gradesContainer) gradesContainer.innerHTML = '';
        if (gpaContainer) gpaContainer.innerHTML = '';
        if (this.yearSelect) {
            this.yearSelect.innerHTML = '<option value="">جاري التحميل...</option>';
            this.yearSelect.disabled = true;
        }
        this.hideNavCacheInfo();
    }

    /**
     * Displays main spinner loader.
     */
    showLoader() {
        if (this.loader) this.loader.classList.remove('hidden');
        if (this.errorContainer) this.errorContainer.classList.add('hidden');
        if (this.yearWorkTab) this.yearWorkTab.classList.add('hidden');
        if (this.gpaTab) this.gpaTab.classList.add('hidden');
        if (this.analyticsTab) this.analyticsTab.classList.add('hidden');
    }

    /**
     * Hides main spinner loader.
     */
    hideLoader() {
        if (this.loader) this.loader.classList.add('hidden');
    }

    /**
     * Shows error state banner.
     */
    showError(msg) {
        this.hideLoader();
        if (this.errorMessage) this.errorMessage.textContent = msg;
        if (this.errorContainer) this.errorContainer.classList.remove('hidden');
    }

    /**
     * Unlocks search input in header depending on whether GPA is available.
     */
    checkAndUnlockSearch() {
        const hasGPA = !!appState.cachedGPAData;
        if (this.searchController) {
            this.searchController.setSearchUnlocked(hasGPA);
        }
    }

    /**
     * Boots up dashboard and kicks off background tasks.
     */
    async initializeDashboard() {
        this.showLoader();
        try {
            await this.loadAcademicYears();
            await this.loadYearWorkGrades('');
            if (this.yearWorkTab) this.yearWorkTab.classList.remove('hidden');

            this.checkAndUnlockSearch();
            this.backgroundPrefetchAll();
            this.updaterService.checkUpdates(false);
        } catch (error) {
            this.showError(error.message || 'حدث خطأ غير متوقع');
        }
    }

    /**
     * Prefetches GPA and remaining academic term grades asynchronously.
     */
    async backgroundPrefetchAll() {
        // 1. Prefetch GPA
        try {
            const response = await fetchGPA(false);
            const data = await response.json();
            if (data.success) {
                appState.cachedGPAData = data.data;
                appState.gpaCacheTime = data.updatedAt;
                this.searchService.setGPAData(data.data);
                this.checkAndUnlockSearch();
            }
        } catch (err) {
            console.warn('Background GPA prefetch failed:', err);
        }

        // 2. Prefetch other year work grades
        if (appState.cachedAcademicYears && Array.isArray(appState.cachedAcademicYears)) {
            for (const year of appState.cachedAcademicYears) {
                if (appState.cachedYearWorkData.has(year.Value)) continue;
                try {
                    const response = await fetchYearWorkGrades(year.Value, false);
                    const data = await response.json();
                    if (data.success) {
                        appState.cachedYearWorkData.set(year.Value, { data: data.data, updatedAt: data.updatedAt });
                        this.searchService.addYearWorkData(year.Text, data.data);
                    }
                } catch (err) {
                    console.warn(`Background year work prefetch failed for ${year.Text}:`, err);
                }
            }
        }

        // 3. Prefetch current courses
        try {
            const response = await fetchCurrentCourses(false);
            const data = await response.json();
            if (data.success) {
                appState.cachedCurrentCourses = data.data;
                appState.currentCoursesCacheTime = data.updatedAt;
            }
        } catch (err) {
            console.warn('Background current courses prefetch failed:', err);
        }

        this.checkAndUnlockSearch();
    }

    /**
     * Fetches year terms values for the select dropdown options.
     */
    async loadAcademicYears() {
        if (appState.cachedAcademicYears) return;

        const data = await fetchAcademicYears();
        if (data.success) {
            appState.cachedAcademicYears = data.data;
            if (this.yearSelect) {
                this.yearSelect.innerHTML = '';

                if (Array.isArray(appState.cachedAcademicYears) && appState.cachedAcademicYears.length > 0) {
                    appState.cachedAcademicYears.forEach(year => {
                        const option = document.createElement('option');
                        option.value = year.Value;
                        option.textContent = year.Text;
                        if (year.Selected) option.selected = true;
                        this.yearSelect.appendChild(option);
                    });
                    this.yearSelect.disabled = false;
                } else {
                    this.yearSelect.innerHTML = '<option value="">لا توجد أعوام أكاديمية متاحة</option>';
                }
            }
        } else {
            throw new Error(data.error);
        }
    }

    /**
     * Refreshes cache updatedAt timestamp display in header navigation bar.
     */
    updateNavCacheInfo(updatedAt, onRevalidateCallback) {
        const navCacheInfo = document.getElementById('nav-cache-info');
        const navCacheTime = document.getElementById('nav-cache-time');

        if (!navCacheInfo || !navCacheTime) return;

        if (!updatedAt) {
            navCacheInfo.classList.add('hidden');
            appState.currentRevalidateCallback = null;
            return;
        }

        navCacheInfo.classList.remove('hidden');
        appState.currentRevalidateCallback = onRevalidateCallback;

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
    }

    /**
     * Hides cache timestamp text and removes refresh callback.
     */
    hideNavCacheInfo() {
        const navCacheInfo = document.getElementById('nav-cache-info');
        if (navCacheInfo) navCacheInfo.classList.add('hidden');
        appState.currentRevalidateCallback = null;
    }

    /**
     * Loads predictive semester grades calculations.
     */
    async loadPredictorData(force = false) {
        if (appState.currentYearWorkGrades && appState.cachedCurrentCourses && !force) {
            renderPredictor('predictor-container', appState.currentYearWorkGrades, appState.cachedCurrentCourses);
            this.updateNavCacheInfo(appState.currentYearWorkCacheTime, () => this.loadPredictorData(true));
            if (this.predictorTab) this.predictorTab.classList.remove('hidden');
            return;
        }

        this.showLoader();
        const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
        if (force && navRevalidateBtn) {
            navRevalidateBtn.classList.add('spinning');
            navRevalidateBtn.disabled = true;
        }
        try {
            // Fetch Year Work
            const response = await fetchYearWorkGrades('', force);
            const data = await response.json();

            // Fetch Current Courses
            const coursesRes = await fetchCurrentCourses(force);
            const coursesData = await coursesRes.json();

            // Fetch GPA (needed for calculations)
            if (!appState.cachedGPAData) {
                await this.loadGPA(force);
            }

            if (data.success && coursesData.success) {
                appState.currentYearWorkGrades = data.data;
                appState.currentYearWorkCacheTime = data.updatedAt;

                appState.cachedCurrentCourses = coursesData.data;
                appState.currentCoursesCacheTime = coursesData.updatedAt;

                appState.cachedYearWorkData.set('', { data: data.data, updatedAt: data.updatedAt });

                renderPredictor('predictor-container', appState.currentYearWorkGrades, appState.cachedCurrentCourses);

                if (this.yearSelect && !this.yearSelect.value) {
                    renderYearWorkGrades(
                        'grades-container',
                        data.data,
                        (name) => this.searchController.openSubjectByName(name)
                    );
                    appState.yearWorkCacheTime = data.updatedAt;
                }

                const ywYearLabel = this.yearSelect ? (this.yearSelect.options[this.yearSelect.selectedIndex]?.text || '') : '';
                if (ywYearLabel) {
                    this.searchService.addYearWorkData(ywYearLabel, data.data);
                    appState.currentYearWorkLabel = ywYearLabel;
                }

                const activeLink = document.querySelector('.sidebar-link.active');
                const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
                if (activeTargetId === 'predictor-tab') {
                    this.updateNavCacheInfo(appState.currentYearWorkCacheTime, () => this.loadPredictorData(true));
                }

                this.hideLoader();
                if (this.predictorTab) this.predictorTab.classList.remove('hidden');
            } else {
                if (response.status === 401 || response.status === 403 || coursesRes.status === 401 || coursesRes.status === 403) {
                    if (this.logoutCallback) this.logoutCallback();
                } else {
                    throw new Error(data.error || coursesData.error);
                }
            }
        } finally {
            if (navRevalidateBtn) {
                navRevalidateBtn.classList.remove('spinning');
                navRevalidateBtn.disabled = false;
            }
        }
    }

    /**
     * Loads the Analytics data.
     */
    async loadAnalyticsData(force = false) {
        if (appState.cachedGPAData && appState.cachedMyAccount && !force) {
            import('../components/AnalyticsRenderer.js').then(module => {
                module.renderAnalytics('analytics-container', appState.cachedGPAData, appState.cachedMyAccount);
            });
            this.updateNavCacheInfo(appState.myAccountCacheTime, () => this.loadAnalyticsData(true));
            if (this.analyticsTab) this.analyticsTab.classList.remove('hidden');
            return;
        }

        this.showLoader();
        const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
        if (force && navRevalidateBtn) {
            navRevalidateBtn.classList.add('spinning');
            navRevalidateBtn.disabled = true;
        }

        try {
            // Ensure GPA is loaded since analytics heavily rely on it
            if (!appState.cachedGPAData || force) {
                await this.loadGPA(force);
            }

            // Fetch My Account Info
            const accountRes = await fetchMyAccountInfo(force);
            const accountData = await accountRes.json();

            if (accountData.success) {
                appState.cachedMyAccount = accountData.data;
                appState.myAccountCacheTime = accountData.updatedAt;

                import('../components/AnalyticsRenderer.js').then(module => {
                    module.renderAnalytics('analytics-container', appState.cachedGPAData, appState.cachedMyAccount);
                });

                const activeLink = document.querySelector('.sidebar-link.active');
                const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
                if (activeTargetId === 'analytics-tab') {
                    this.updateNavCacheInfo(appState.myAccountCacheTime, () => this.loadAnalyticsData(true));
                }

                this.hideLoader();
                if (this.analyticsTab) this.analyticsTab.classList.remove('hidden');
            } else {
                if (accountRes.status === 401 || accountRes.status === 403) {
                    if (this.logoutCallback) this.logoutCallback();
                } else {
                    throw new Error(accountData.error);
                }
            }
        } catch (error) {
            console.error('Failed to load analytics data:', error);
            const container = document.getElementById('analytics-container');
            if (container) {
                container.innerHTML = `<div class="error-state">حدث خطأ أثناء تحميل البيانات: ${error.message}</div>`;
            }
            this.hideLoader();
        } finally {
            if (navRevalidateBtn) {
                navRevalidateBtn.classList.remove('spinning');
                navRevalidateBtn.disabled = false;
            }
        }
    }

    /**
     * Loads year-work grades structure for UI.
     */
    async loadYearWorkGrades(yearId, force = false) {
        if (appState.cachedYearWorkData.has(yearId) && !force) {
            const cached = appState.cachedYearWorkData.get(yearId);
            renderYearWorkGrades(
                'grades-container',
                cached.data,
                (name) => this.searchController.openSubjectByName(name)
            );
            appState.yearWorkCacheTime = cached.updatedAt;

            if (yearId === '') {
                appState.currentYearWorkGrades = cached.data;
                appState.currentYearWorkCacheTime = cached.updatedAt;
                if (appState.cachedCurrentCourses) {
                    renderPredictor('predictor-container', appState.currentYearWorkGrades, appState.cachedCurrentCourses);
                }

                let ywYearLabel = '';
                if (appState.cachedAcademicYears) {
                    const opt = appState.cachedAcademicYears.find(y => y.Value === yearId);
                    if (opt) ywYearLabel = opt.Text;
                }
                if (!ywYearLabel && yearId === '' && this.yearSelect) {
                    ywYearLabel = this.yearSelect.options[this.yearSelect.selectedIndex]?.text || '';
                }
                appState.currentYearWorkLabel = ywYearLabel;
            }

            const activeLink = document.querySelector('.sidebar-link.active');
            const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
            if (activeTargetId === 'year-work-tab') {
                this.updateNavCacheInfo(appState.yearWorkCacheTime, () => this.loadYearWorkGrades(yearId, true));
            }
            if (this.yearWorkTab) this.yearWorkTab.classList.remove('hidden');
            return;
        }

        this.showLoader();
        const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
        if (force && navRevalidateBtn) {
            navRevalidateBtn.classList.add('spinning');
            navRevalidateBtn.disabled = true;
        }
        try {
            const response = await fetchYearWorkGrades(yearId, force);
            const data = await response.json();

            if (data.success) {
                appState.cachedYearWorkData.set(yearId, { data: data.data, updatedAt: data.updatedAt });

                renderYearWorkGrades(
                    'grades-container',
                    data.data,
                    (name) => this.searchController.openSubjectByName(name)
                );

                if (yearId === '') {
                    appState.currentYearWorkGrades = data.data;
                    appState.currentYearWorkCacheTime = data.updatedAt;
                    if (appState.cachedCurrentCourses) {
                        renderPredictor('predictor-container', appState.currentYearWorkGrades, appState.cachedCurrentCourses);
                    }
                }

                let ywYearLabel = '';
                if (appState.cachedAcademicYears) {
                    const opt = appState.cachedAcademicYears.find(y => y.Value === yearId);
                    if (opt) ywYearLabel = opt.Text;
                }
                if (!ywYearLabel && yearId === '' && this.yearSelect) {
                    ywYearLabel = this.yearSelect.options[this.yearSelect.selectedIndex]?.text || '';
                }
                if (ywYearLabel) {
                    this.searchService.addYearWorkData(ywYearLabel, data.data);
                }
                if (yearId === '') {
                    appState.currentYearWorkLabel = ywYearLabel;
                }

                appState.yearWorkCacheTime = data.updatedAt;
                const activeLink = document.querySelector('.sidebar-link.active');
                const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
                if (activeTargetId === 'year-work-tab') {
                    this.updateNavCacheInfo(appState.yearWorkCacheTime, () => this.loadYearWorkGrades(yearId, true));
                }

                this.checkAndUnlockSearch();
                this.hideLoader();
                if (this.yearWorkTab) this.yearWorkTab.classList.remove('hidden');
            } else {
                if (response.status === 401 || response.status === 403) {
                    if (this.logoutCallback) this.logoutCallback();
                } else {
                    throw new Error(data.error);
                }
            }
        } finally {
            if (navRevalidateBtn) {
                navRevalidateBtn.classList.remove('spinning');
                navRevalidateBtn.disabled = false;
            }
        }
    }

    /**
     * Loads student total Cumulative GPA scores.
     */
    async loadGPA(force = false) {
        if (appState.cachedGPAData && !force) {
            renderGPA(
                'gpa-container',
                appState.cachedGPAData,
                (name) => this.searchController.openSubjectByName(name)
            );
            this.searchService.setGPAData(appState.cachedGPAData);
            this.updateNavCacheInfo(appState.gpaCacheTime, () => this.loadGPA(true));
            if (this.gpaTab) this.gpaTab.classList.remove('hidden');
            return;
        }

        this.showLoader();
        const navRevalidateBtn = document.getElementById('nav-revalidate-btn');
        if (force && navRevalidateBtn) {
            navRevalidateBtn.classList.add('spinning');
            navRevalidateBtn.disabled = true;
        }
        try {
            const response = await fetchGPA(force);
            const data = await response.json();

            if (data.success) {
                appState.cachedGPAData = data.data;
                renderGPA(
                    'gpa-container',
                    data.data,
                    (name) => this.searchController.openSubjectByName(name)
                );
                this.searchService.setGPAData(data.data);
                appState.gpaCacheTime = data.updatedAt;
                const activeLink = document.querySelector('.sidebar-link.active');
                const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
                if (activeTargetId === 'gpa-tab') {
                    this.updateNavCacheInfo(appState.gpaCacheTime, () => this.loadGPA(true));
                }
                this.checkAndUnlockSearch();
                this.hideLoader();
                if (this.gpaTab) this.gpaTab.classList.remove('hidden');
            } else {
                if (response.status === 401 || response.status === 403) {
                    if (this.logoutCallback) this.logoutCallback();
                } else {
                    throw new Error(data.error);
                }
            }
        } finally {
            if (navRevalidateBtn) {
                navRevalidateBtn.classList.remove('spinning');
                navRevalidateBtn.disabled = false;
            }
        }
    }

    /**
     * Initializes language preferences values and fetches web version.
     */
    async loadSettings() {
        const cultureSelect = document.getElementById('ums-culture-select');
        if (cultureSelect) {
            const saved = localStorage.getItem('ums_culture') || 'ar';
            cultureSelect.value = saved;

            if (!cultureSelect.dataset.listenerAdded) {
                cultureSelect.dataset.listenerAdded = 'true';
                cultureSelect.addEventListener('change', (e) => {
                    const newLang = e.target.value;
                    localStorage.setItem('ums_culture', newLang);
                    // Reset cache
                    appState.cachedGPAData = null;
                    appState.gpaCacheTime = null;
                    appState.cachedAcademicYears = null;
                    appState.cachedYearWorkData.clear();

                    if (this.searchController) {
                        this.searchController.clearSearch();
                        this.searchController.setSearchUnlocked(false);
                    }

                    const gradesContainer = document.getElementById('grades-container');
                    const gpaContainer = document.getElementById('gpa-container');
                    if (gradesContainer) gradesContainer.innerHTML = '';
                    if (gpaContainer) gpaContainer.innerHTML = '';
                });
            }
        }

        const themeSelect = document.getElementById('app-theme-select');
        if (themeSelect) {
            const savedTheme = localStorage.getItem('ums_theme') || (document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            themeSelect.value = savedTheme;

            if (!themeSelect.dataset.listenerAdded) {
                themeSelect.dataset.listenerAdded = 'true';
                themeSelect.addEventListener('change', (e) => {
                    const newTheme = e.target.value;
                    localStorage.setItem('ums_theme', newTheme);
                    if (newTheme === 'dark') {
                        document.body.classList.add('dark-mode');
                    } else {
                        document.body.classList.remove('dark-mode');
                    }

                    // Re-render analytics dynamically if it is currently selected tab
                    const activeLink = document.querySelector('.sidebar-link.active');
                    const activeTargetId = activeLink ? activeLink.getAttribute('data-target') : '';
                    if (activeTargetId === 'analytics-tab' && appState.cachedGPAData && appState.cachedMyAccount) {
                        import('../components/AnalyticsRenderer.js').then(module => {
                            module.renderAnalytics('analytics-container', appState.cachedGPAData, appState.cachedMyAccount);
                        });
                    }
                });
            }
        }

        if (this.appWebVersionSpan) {
            this.appWebVersionSpan.textContent = appState.CURRENT_APP_VERSION;
        }

        if (this.fetchedVersion) return;
        try {
            const response = await fetch('/api/version');
            const data = await response.json();
            if (data.success) {
                this.fetchedVersion = data.version;
                if (this.appWebVersionSpan) {
                    this.appWebVersionSpan.textContent = this.fetchedVersion;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch app version from API, using local:', e);
        }
    }

    /**
     * Toggles dashboard active visual tab layouts.
     */
    async switchTab(targetId) {
        document.querySelectorAll('.sidebar-link').forEach(btn => btn.classList.remove('active'));
        const activeLink = document.querySelector(`[data-target="${targetId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            if (this.pageTitle) {
                this.pageTitle.textContent = activeLink.getAttribute('data-title');
            }
        }

        if (this.errorContainer) this.errorContainer.classList.add('hidden');
        if (this.yearWorkTab) this.yearWorkTab.classList.add('hidden');
        if (this.gpaTab) this.gpaTab.classList.add('hidden');
        if (this.predictorTab) this.predictorTab.classList.add('hidden');
        if (this.analyticsTab) this.analyticsTab.classList.add('hidden');
        if (this.settingsTab) this.settingsTab.classList.add('hidden');

        if (targetId === 'year-work-tab') {
            const container = document.getElementById('grades-container');
            if (container && container.children.length === 0) {
                await this.loadYearWorkGrades(this.yearSelect ? this.yearSelect.value : '');
            } else {
                if (this.yearWorkTab) this.yearWorkTab.classList.remove('hidden');
                this.updateNavCacheInfo(appState.yearWorkCacheTime, () => this.loadYearWorkGrades(this.yearSelect ? this.yearSelect.value : '', true));
            }
        } else if (targetId === 'gpa-tab') {
            const container = document.getElementById('gpa-container');
            if (container && container.children.length === 0) {
                await this.loadGPA();
            } else {
                if (this.gpaTab) this.gpaTab.classList.remove('hidden');
                this.updateNavCacheInfo(appState.gpaCacheTime, () => this.loadGPA(true));
            }
        } else if (targetId === 'predictor-tab') {
            await this.loadPredictorData();
        } else if (targetId === 'analytics-tab') {
            await this.loadAnalyticsData();
        } else if (targetId === 'settings-tab') {
            this.hideNavCacheInfo();
            await this.loadSettings();
            if (this.settingsTab) this.settingsTab.classList.remove('hidden');
        }
    }
}
