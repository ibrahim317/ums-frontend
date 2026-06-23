export const getPointsFromGrade = (gradeStr) => {
    if (!gradeStr) return null;
    const g = gradeStr.trim().toUpperCase();
    if (g === 'A+' || g.includes('امتياز مرتفع') || g.includes('امتياز اول')) return 4.0;
    if (g === 'A' || g.includes('امتياز')) return 4.0;
    if (g === 'A-' || g.includes('امتياز منخفض')) return 3.7;
    if (g === 'B+' || g.includes('جيد جدا مرتفع') || g.includes('جيد جداً مرتفع')) return 3.3;
    if (g === 'B' || g.includes('جيد جدا') || g.includes('جيد جداً')) return 3.0;
    if (g === 'B-' || g.includes('جيد جدا منخفض') || g.includes('جيد جداً منخفض')) return 2.7;
    if (g === 'C+' || g.includes('جيد مرتفع')) return 2.3;
    if (g === 'C' || g.includes('جيد')) return 2.0;
    if (g === 'C-' || g.includes('جيد منخفض')) return 1.7;
    if (g === 'D+' || g.includes('مقبول مرتفع')) return 1.3;
    if (g === 'D' || g.includes('مقبول')) return 1.0;
    if (g === 'F' || g === 'E' || g.includes('راسب')) return 0.0;
    return null;
};

export class CGPACalculator {
    static getTermRank(title) {
        const t = title || "";
        if (t.includes("الخريف") || t.includes("الأول") || t.includes("الاول") || t.includes("First") || t.toLowerCase().includes("fall")) return 1;
        if (t.includes("الربيع") || t.includes("الثاني") || t.toLowerCase().includes("spring")) return 2;
        if (t.includes("الصيف") || t.toLowerCase().includes("summer")) return 3;
        if (t === "CurrentSemesterPrediction") return 99; // Force override
        return 1;
    }

    static getYearStart(yearStr) {
        const cleanStr = (yearStr || "")
            .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
        const match = cleanStr.match(/\b(19|20)\d{2}\b/);
        if (match) {
            return parseInt(match[0], 10) * 10;
        }
        if (yearStr === "FuturePredictionYear") return 99999; // Force override
        const lower = cleanStr.toLowerCase();
        if (lower.includes("الخامس") || lower.includes("خامسة") || lower.includes("خامسه") || lower.includes("fifth")) return 5;
        if (lower.includes("الرابع") || lower.includes("رابعة") || lower.includes("رابعه") || lower.includes("fourth")) return 4;
        if (lower.includes("الثالث") || lower.includes("ثالثة") || lower.includes("ثالثه") || lower.includes("third")) return 3;
        if (lower.includes("الثاني") || lower.includes("ثانية") || lower.includes("ثانيه") || lower.includes("second")) return 2;
        if (lower.includes("الأول") || lower.includes("الاول") || lower.includes("أولى") || lower.includes("اولى") || lower.includes("first")) return 1;
        return 0;
    }

    static cleanSubjectName(name) {
        return (name || '')
            .replace(/^(المقرر:|Course:)\s*/i, '')
            .replace(/^\[[^\]]+\]\s*/, '')
            .trim();
    }

    /**
     * @param {Object} gpaData - the cached GPA data
     * @param {Array} additionalSubjects - array of { name, hours, points }
     */
    static calculate(gpaData, additionalSubjects = []) {
        const latestSubjects = new Map();

        // 1. Process Historical Data
        if (gpaData && gpaData.years) {
            gpaData.years.forEach(year => {
                const yearStart = this.getYearStart(year.year);
                year.terms.forEach(term => {
                    const termRank = this.getTermRank(term.title);
                    term.subjects.forEach(subject => {
                        const name = subject.name || "";
                        if (name.includes("التدريب الصيفي")) return;

                        let points = parseFloat(subject.points);
                        if (isNaN(points)) {
                            const derived = getPointsFromGrade(subject.grade);
                            if (derived !== null) points = derived;
                        }
                        if (isNaN(points)) return;

                        const hours = parseFloat(subject.hours);
                        if (isNaN(hours)) return;

                        const cleanName = this.cleanSubjectName(name);
                        const currentEntry = latestSubjects.get(cleanName);
                        const isLater = !currentEntry ||
                            yearStart > currentEntry.yearStart ||
                            (yearStart === currentEntry.yearStart && termRank > currentEntry.termRank);

                        if (isLater) {
                            latestSubjects.set(cleanName, { points, hours, yearStart, termRank });
                        }
                    });
                });
            });
        }

        // 2. Process Predicted Subjects
        const predYearStart = this.getYearStart("FuturePredictionYear");
        const predTermRank = this.getTermRank("CurrentSemesterPrediction");

        additionalSubjects.forEach(subject => {
            const name = subject.name || "";
            if (name.includes("التدريب الصيفي")) return;

            const points = parseFloat(subject.points);
            const hours = parseFloat(subject.hours);

            if (isNaN(points) || isNaN(hours)) return;

            const cleanName = this.cleanSubjectName(name);
            latestSubjects.set(cleanName, { points, hours, yearStart: predYearStart, termRank: predTermRank });
        });

        // 3. Calculate Overall GPA
        let totalPoints = 0;
        let totalHours = 0;
        latestSubjects.forEach(sub => {
            totalPoints += (sub.points * sub.hours);
            totalHours += sub.hours;
        });

        const cgpa = totalHours > 0 ? (totalPoints / totalHours) : 0;
        return { cgpa, totalHours, totalPoints };
    }
}
