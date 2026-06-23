/**
 * AppState - Shared state store for caching academic data, cache times,
 * search locks, and active revalidation callbacks.
 */
export class AppState {
    constructor() {
        this.CURRENT_APP_VERSION = '1.0.3';
        this.clearAll();
    }

    /**
     * Resets the entire app state to default values.
     */
    clearAll() {
        this.cachedAcademicYears = null;
        this.yearWorkCacheTime = null;
        this.gpaCacheTime = null;
        this.currentYearWorkGrades = null;
        this.currentYearWorkCacheTime = null;
        this.cachedGPAData = null;
        this.cachedYearWorkData = new Map(); // yearId -> { data, updatedAt }
        this.currentRevalidateCallback = null;

        // Search Engine State
        this.searchUnlocked = false;
        this.searchIndex = [];
        this.yearWorkEntries = []; // Array of { yearLabel, data }
        this.currentYearWorkLabel = '';

        this.cachedCurrentCourses = null;
        this.currentCoursesCacheTime = null;

        this.cachedMyAccount = null;
        this.myAccountCacheTime = null;
    }
}

// Export a singleton instance of AppState
export const appState = new AppState();
