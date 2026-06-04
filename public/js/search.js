import { SearchService } from './services/SearchService.js';
import { SearchController } from './controllers/SearchController.js';
import { appState } from './services/AppState.js';

// Instantiate the singleton search service
const searchService = new SearchService();
let searchController = null;

/**
 * Initializes search controller UI.
 */
export const initSearch = (onUnlockRequested) => {
    searchController = new SearchController(searchService, onUnlockRequested);
    searchController.init();
};

/**
 * Opens search modal.
 */
export const openSearch = () => {
    if (searchController) searchController.openSearch();
};

/**
 * Links directly to details of a subject by name.
 */
export const openSubjectByName = (name) => {
    if (searchController) searchController.openSubjectByName(name);
};

/**
 * Indexes student academic record GPA.
 */
export const setGPAData = (data) => {
    searchService.setGPAData(data);
};

/**
 * Indexes year-work grades for search queries.
 */
export const addYearWorkData = (yearLabel, data) => {
    searchService.addYearWorkData(yearLabel, data);
};

/**
 * Clears cached indexed data.
 */
export const clearSearchData = () => {
    if (searchController) {
        searchController.clearSearch();
    } else {
        searchService.setGPAData(null);
        appState.yearWorkEntries = [];
        appState.searchIndex = [];
        appState.currentYearWorkGrades = null;
        appState.currentYearWorkLabel = '';
    }
};

/**
 * Visual unlock trigger control.
 */
export const setSearchUnlocked = (unlocked) => {
    if (searchController) searchController.setSearchUnlocked(unlocked);
};

/**
 * Toggle syncing loader animation.
 */
export const setSearchSyncing = (syncing) => {
    if (searchController) searchController.setSearchSyncing(syncing);
};

/**
 * Sets current term grades context (for predictions comparisons).
 */
export const setCurrentYearWorkGrades = (grades, label) => {
    appState.currentYearWorkGrades = grades;
    if (label) appState.currentYearWorkLabel = label;
};

// Export the underlying classes for direct OOP imports in controllers
export { SearchService, SearchController };
export const getSearchControllerInstance = () => searchController;
export const getSearchServiceInstance = () => searchService;
