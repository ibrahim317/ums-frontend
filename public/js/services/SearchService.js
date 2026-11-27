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
        const normalizedYear = TextNormalizer.normalizeYearLabel(yearLabel);
        if (!normalizedYear || /جاري التحميل|غير متاح|لا توجد/.test(normalizedYear)) return;

        const idx = appState.yearWorkEntries.findIndex(
            e => TextNormalizer.normalizeYearLabel(e.yearLabel) === normalizedYear
        );
        if (idx >= 0) {
            appState.yearWorkEntries[idx] = { yearLabel: normalizedYear, data };
        } else {
            appState.yearWorkEntries.push({ yearLabel: normalizedYear, data });
        }
        this.rebuildIndex();
    }

    /**
     * Rebuilds the search index using cached GPA and year-work entries.
     */
    rebuildIndex() {
        const subjectMap = new Map();
        const codeToNorm = new Map();

        const getOrCreate = (name) => {
            const cleanName = TextNormalizer.cleanSubjectName(name);
            let norm = TextNormalizer.normalizeArabic(name);
            const code = TextNormalizer.extractCourseCode(name);

            if (!subjectMap.has(norm) && code && codeToNorm.has(code)) {
                norm = codeToNorm.get(code);
            }

            if (!subjectMap.has(norm)) {
                subjectMap.set(norm, {
                    displayName: cleanName || name,
                    codes: new Set(),
                    occurrences: new Map()
                });
            }

            const entry = subjectMap.get(norm);
            if (code) {
                entry.codes.add(code);
                codeToNorm.set(code, norm);
            }
            return entry;
        };

        // Process GPA data (all years)
        if (appState.cachedGPAData?.years) {
            appState.cachedGPAData.years.forEach(year => {
                const normYear = TextNormalizer.normalizeYearLabel(year.year) || year.year;
                year.terms.forEach(term => {
                    const termKey = TextNormalizer.normalizeTermKey(term.title);
                    const normTerm = TextNormalizer.normalizeTermTitle(term.title);
                    term.subjects.forEach(subject => {
                        const entry = getOrCreate(subject.name);
                        const key = `${normYear}||${termKey}`;
                        const existing = entry.occurrences.get(key) || {
                            yearLabel: normYear,
                            termKey,
                            termTitle: normTerm,
                            yearWorkGrades: null,
                            gpaInfo: null
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
            const normYear = TextNormalizer.normalizeYearLabel(yearLabel) || yearLabel;
            data.terms.forEach(term => {
                const termKey = TextNormalizer.normalizeTermKey(term.title);
                const normTerm = TextNormalizer.normalizeTermTitle(term.title);
                term.subjects.forEach(subject => {
                    const entry = getOrCreate(subject.name);
                    let key = `${normYear}||${termKey}`;

                    // Fallback: if exact termKey wasn't found in this year, check if there is a
                    // single GPA-only occurrence in the same academic year and merge into it.
                    if (!entry.occurrences.has(key)) {
                        const sameYearWithoutYW = [...entry.occurrences.entries()].filter(
                            ([, occ]) => occ.yearLabel === normYear && !occ.yearWorkGrades
                        );
                        if (sameYearWithoutYW.length === 1) {
                            key = sameYearWithoutYW[0][0];
                        }
                    }

                    const existing = entry.occurrences.get(key) || {
                        yearLabel: normYear,
                        termKey,
                        termTitle: normTerm,
                        yearWorkGrades: null,
                        gpaInfo: null
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
            appState.searchIndex.push({
                displayName: value.displayName,
                normalizedName,
                codes: [...value.codes],
                occurrences
            });
        });
    }

    /**
     * Searches the index for matching subjects using fuzzy scoring (name + course code).
     */
    searchQuery(query) {
        if (!query || !query.trim()) return appState.searchIndex.slice(0, 30);
        return appState.searchIndex
            .map(item => {
                let score = TextNormalizer.fuzzyScore(query, item.displayName);
                if (Array.isArray(item.codes)) {
                    for (const code of item.codes) {
                        score = Math.max(score, TextNormalizer.fuzzyScore(query, code));
                    }
                }
                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20);
    }
}
