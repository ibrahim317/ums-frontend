/**
 * CompletedHoursCalculator
 *
 * Calculates the total number of completed (passed) credit hours from GPA data.
 *
 * Business rules:
 *   1. A subject counts as "passed" if it is NOT "راسب" and NOT "غائب".
 *   2. If a student passed Subject A in one term, then retook it later and failed,
 *      the hours STILL count (the student earned the credit historically).
 *   3. "التدريب الصيفي" / "Summer Training" IS counted toward completed hours
 *      (but is excluded from CGPA elsewhere).
 *   4. "ناجح" (pass/fail) subjects with hours but no GPA points ARE counted.
 *
 * Design:
 *   - Uses a Strategy-like classification via SubjectStatus to avoid
 *     spaghetti if/else chains.
 *   - Iterates chronologically, tracking per-subject the *best* outcome:
 *     once a subject is passed, it stays passed regardless of later failures.
 */

// ─── Subject Status Enum ─────────────────────────────────────────────

const SubjectStatus = Object.freeze({
    PASSED: 'passed',
    FAILED: 'failed',
    ABSENT: 'absent',
});

// ─── Grade Classifier ────────────────────────────────────────────────

/**
 * Classifies a grade string into a SubjectStatus.
 * Centralises all pass/fail/absent detection in one place.
 *
 * @param {string} grade - The raw grade string from the GPA record.
 * @returns {SubjectStatus}
 */
const classifyGrade = (grade) => {
    if (!grade) return SubjectStatus.FAILED;

    const g = grade.trim();

    // Absent check
    if (g === 'غائب' || g.toLowerCase() === 'absent') {
        return SubjectStatus.ABSENT;
    }

    // Fail check
    if (g === 'راسب' || g === 'F' || g === 'E' || g.toLowerCase() === 'fail') {
        return SubjectStatus.FAILED;
    }

    // Everything else is a pass: letter grades (A+ through D), "ناجح", etc.
    return SubjectStatus.PASSED;
};

// ─── Name Normaliser ─────────────────────────────────────────────────

/**
 * Normalises a subject name so that the same course taken across terms
 * can be de-duplicated reliably.
 */
const normaliseSubjectName = (name) => {
    return (name || '')
        .replace(/^(المقرر:|Course:)\s*/i, '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .trim();
};

// ─── Chronological Ordering Helpers ──────────────────────────────────

const getTermRank = (title) => {
    const t = title || '';
    if (t.includes('الخريف') || t.includes('الأول') || t.includes('الاول') || t.includes('First') || t.toLowerCase().includes('fall')) return 1;
    if (t.includes('الربيع') || t.includes('الثاني') || t.toLowerCase().includes('spring')) return 2;
    if (t.includes('الصيف') || t.toLowerCase().includes('summer')) return 3;
    return 1;
};

const getYearStart = (yearStr) => {
    const cleanStr = (yearStr || '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const match = cleanStr.match(/\b(19|20)\d{2}\b/);
    if (match) return parseInt(match[0], 10) * 10;

    const lower = cleanStr.toLowerCase();
    if (lower.includes('الخامس') || lower.includes('خامسة') || lower.includes('خامسه') || lower.includes('fifth')) return 5;
    if (lower.includes('الرابع') || lower.includes('رابعة') || lower.includes('رابعه') || lower.includes('fourth')) return 4;
    if (lower.includes('الثالث') || lower.includes('ثالثة') || lower.includes('ثالثه') || lower.includes('third')) return 3;
    if (lower.includes('الثاني') || lower.includes('ثانية') || lower.includes('ثانيه') || lower.includes('second')) return 2;
    if (lower.includes('الأول') || lower.includes('الاول') || lower.includes('أولى') || lower.includes('اولى') || lower.includes('first')) return 1;
    return 0;
};

// ─── Core Calculator ─────────────────────────────────────────────────

export class CompletedHoursCalculator {
    /**
     * Calculates total completed credit hours from GPA data.
     *
     * @param {{ years: Array }} gpaData - Parsed GPA data from the API.
     * @returns {{ completedHours: number, details: Map<string, {hours: number, status: SubjectStatus}> }}
     */
    static calculate(gpaData) {
        if (!gpaData?.years?.length) {
            return { completedHours: 0, details: new Map() };
        }

        // Map<normalisedName → { hours, everPassed, latestYearStart, latestTermRank }>
        const subjectMap = new Map();

        // Walk every year → term → subject and build the subject map
        gpaData.years.forEach(year => {
            const yearStart = getYearStart(year.year);

            year.terms.forEach(term => {
                const termRank = getTermRank(term.title);

                term.subjects.forEach(subject => {
                    const name = normaliseSubjectName(subject.name);
                    const hours = parseFloat(subject.hours);
                    if (!name || isNaN(hours) || hours <= 0) return;

                    const status = classifyGrade(subject.grade);
                    const existing = subjectMap.get(name);

                    if (!existing) {
                        subjectMap.set(name, {
                            hours,
                            everPassed: status === SubjectStatus.PASSED,
                            latestYearStart: yearStart,
                            latestTermRank: termRank,
                        });
                        return;
                    }

                    // If the student ever passed, it stays passed (Rule 2)
                    if (status === SubjectStatus.PASSED) {
                        existing.everPassed = true;
                    }

                    // Track the latest attempt to keep the most recent hours value
                    const isLater = yearStart > existing.latestYearStart ||
                        (yearStart === existing.latestYearStart && termRank > existing.latestTermRank);

                    if (isLater) {
                        existing.hours = hours;
                        existing.latestYearStart = yearStart;
                        existing.latestTermRank = termRank;
                    }
                });
            });
        });

        // Sum up hours for subjects that were ever passed
        let completedHours = 0;
        const details = new Map();

        subjectMap.forEach((entry, name) => {
            if (entry.everPassed) {
                completedHours += entry.hours;
                details.set(name, {
                    hours: entry.hours,
                    status: SubjectStatus.PASSED,
                });
            }
        });

        return { completedHours, details };
    }
}
