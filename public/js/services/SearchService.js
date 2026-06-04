import { appState } from './AppState.js';
import { TextNormalizer } from '../utils/TextNormalizer.js';

/**
 * SearchService - Indexes GPA and Year Work grades to enable fast fuzzy search
 * across all academic terms.
 */
export class SearchService {
    /**
     * Sets GPA data and triggers index rebuild.
     */
    setGPAData(data) {
        appState.cachedGPAData = data;
        this.rebuildIndex();
    }

    /**
     * Adds or updates year work grades for a specific year, then rebuilds the index.
     */
    addYearWorkData(yearLabel, data) {
        if (!yearLabel || !data) return;
        const idx = appState.yearWorkEntries.findIndex(e => e.yearLabel === yearLabel);
        if (idx >= 0) {
            appState.yearWorkEntries[idx] = { yearLabel, data };
        } else {
            appState.yearWorkEntries.push({ yearLabel, data });
        }
        this.rebuildIndex();
    }

    /**
     * Rebuilds the search index using cached GPA and year-work entries.
     */
    rebuildIndex() {
        const subjectMap = new Map();

        const getOrCreate = (name) => {
            const cleanName = TextNormalizer.cleanSubjectName(name);
            const norm = TextNormalizer.normalizeArabic(name);
            if (!subjectMap.has(norm)) {
                subjectMap.set(norm, { displayName: cleanName, occurrences: new Map() });
            }
            return subjectMap.get(norm);
        };

        // Process GPA data (all years)
        if (appState.cachedGPAData?.years) {
            appState.cachedGPAData.years.forEach(year => {
                year.terms.forEach(term => {
                    const normTerm = TextNormalizer.normalizeTermTitle(term.title);
                    term.subjects.forEach(subject => {
                        const entry = getOrCreate(subject.name);
                        const key = `${year.year}||${normTerm}`;
                        const existing = entry.occurrences.get(key) || {
                            yearLabel: year.year, termTitle: normTerm,
                            yearWorkGrades: null, gpaInfo: null
                        };
                        existing.gpaInfo = {
                            grade: subject.grade,
                            points: subject.points,
                            hours: subject.hours
                        };
                        entry.occurrences.set(key, existing);
                    });
                });
            });
        }

        // Process year work data
        appState.yearWorkEntries.forEach(({ yearLabel, data }) => {
            if (!data?.terms) return;
            data.terms.forEach(term => {
                const normTerm = TextNormalizer.normalizeTermTitle(term.title);
                term.subjects.forEach(subject => {
                    const entry = getOrCreate(subject.name);
                    const key = `${yearLabel}||${normTerm}`;
                    const existing = entry.occurrences.get(key) || {
                        yearLabel, termTitle: normTerm,
                        yearWorkGrades: null, gpaInfo: null
                    };
                    existing.yearWorkGrades = subject.grades;
                    entry.occurrences.set(key, existing);
                });
            });
        });

        // Flatten to sorted array
        appState.searchIndex = [];
        subjectMap.forEach((value, normalizedName) => {
            const occurrences = [...value.occurrences.values()];
            occurrences.sort((a, b) => b.yearLabel.localeCompare(a.yearLabel));
            appState.searchIndex.push({ displayName: value.displayName, normalizedName, occurrences });
        });
    }

    /**
     * Searches the index for matching subjects using fuzzy scoring.
     */
    searchQuery(query) {
        if (!query || !query.trim()) return appState.searchIndex.slice(0, 30);
        return appState.searchIndex
            .map(item => ({ ...item, score: TextNormalizer.fuzzyScore(query, item.displayName) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);
    }
}
