import { fetchGPA, fetchYearWorkGrades } from './api.js';
import { appState } from './services/AppState.js';
import { UpdaterService } from './services/UpdaterService.js';
import {
    initSearch,
    setSearchSyncing,
    setGPAData,
    addYearWorkData,
    getSearchControllerInstance,
    getSearchServiceInstance
} from './search.js';
import { SavedAccountsController } from './controllers/SavedAccountsController.js';
import { AuthController } from './controllers/AuthController.js';
import { DashboardController } from './controllers/DashboardController.js';
import { Dialog } from './utils/Dialog.js';

/**
 * Main Application Bootstrapper
 * Orchestrates instantiating OOP controllers, initializing state,
 * and linking DOM event listeners on load.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize confirmation dialog controls
    Dialog.init();

    // 2. Instantiate application logic services
    const updaterService = new UpdaterService();
    const savedAccountsController = new SavedAccountsController();

    // 3. Initialize the Subject Search engine
    initSearch(async () => {
        setSearchSyncing(true);
        try {
            // Fetch GPA if not cached
            if (!appState.cachedGPAData) {
                const response = await fetchGPA(false);
                const data = await response.json();
                if (data.success) {
                    appState.cachedGPAData = data.data;
                    appState.gpaCacheTime = data.updatedAt;
                    setGPAData(data.data);
                    
                    const searchController = getSearchControllerInstance();
                    if (searchController) searchController.setSearchUnlocked(true);
                } else {
                    throw new Error(data.error || 'فشلت مزامنة السجل الأكاديمي.');
                }
            } else {
                const searchController = getSearchControllerInstance();
                if (searchController) searchController.setSearchUnlocked(true);
            }

            // Prefetch other academic years to search index
            if (appState.cachedAcademicYears && Array.isArray(appState.cachedAcademicYears)) {
                for (const year of appState.cachedAcademicYears) {
                    if (!appState.cachedYearWorkData.has(year.Value)) {
                        const response = await fetchYearWorkGrades(year.Value, false);
                        const data = await response.json();
                        if (data.success) {
                            appState.cachedYearWorkData.set(year.Value, { data: data.data, updatedAt: data.updatedAt });
                            addYearWorkData(year.Text, data.data);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('مزامنة البحث فشلت:', err);
            alert('فشلت المزامنة: ' + (err.message || String(err) || 'خطأ غير معروف'));
        } finally {
            setSearchSyncing(false);
        }
    });

    const searchController = getSearchControllerInstance();
    const searchService = getSearchServiceInstance();

    // 4. Instantiate Auth & Dashboard Controllers
    const authController = new AuthController(
        savedAccountsController,
        // OnAuthSuccess callback
        () => {
            dashboardController.initializeDashboard();
        },
        // OnLogout callback
        () => {
            dashboardController.resetUI();
        }
    );

    const dashboardController = new DashboardController(
        searchService,
        updaterService,
        () => authController.performLogout(),
        searchController
    );

    // 5. Initialize event listeners inside controllers
    authController.init();
    dashboardController.init();

    // 6. Bind search button events in navigation header
    const searchNavBtn = document.getElementById('search-nav-btn');
    if (searchNavBtn && searchController) {
        searchNavBtn.addEventListener('click', () => searchController.openSearch());
    }

    // 7. Render saved credentials list
    savedAccountsController.render();

    // 8. Boot page check auth status
    authController.checkAuthStatus();
});
