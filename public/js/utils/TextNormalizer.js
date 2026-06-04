/**
 * TextNormalizer - Pure text normalization and grade analysis helpers.
 */
export class TextNormalizer {
    /**
     * Cleans prefixes like "[Prefix]" or "المقرر: " from a subject name.
     */
    static cleanSubjectName(name) {
        return (name || '')
            .replace(/^(المقرر:|Course:)\s*/i, '')
            .replace(/^\[[^\]]+\]\s*/, '')
            .trim();
    }

    /**
     * Normalizes Arabic text by removing diacritics and standardizing specific characters.
     */
    static normalizeArabic(text) {
        return this.cleanSubjectName(text)
            .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Standardizes term titles like "الخريف" or "الربيع".
     */
    static normalizeTermTitle(title) {
        if (!title) return '';
        if (title.includes('الخريف')) return 'فصل الخريف';
        if (title.includes('الربيع')) return 'فصل الربيع';
        if (title.includes('الصيف')) return 'فصل الصيف';
        if (title.includes('الأول') || title.includes('الاول')) return 'الفصل الدراسي الأول';
        if (title.includes('الثاني') || title.includes('الثاني')) return 'الفصل الدراسي الثاني';
        return title.replace(/\[.*\]/g, '').trim();
    }

    /**
     * Returns the min/max grade range for a given GPA grade.
     */
    static getGradeRange(grade) {
        const g = (grade || '').trim().toUpperCase();
        if (g === 'A+' || g.includes('امتياز مرتفع') || g.includes('امتياز اول')) return { min: 97, max: 100 };
        if (g === 'A' || g.includes('امتياز')) return { min: 93, max: 96.9 };
        if (g === 'A-' || g.includes('امتياز منخفض')) return { min: 89, max: 92.9 };
        if (g === 'B+' || g.includes('جيد جدا مرتفع') || g.includes('جيد جداً مرتفع')) return { min: 84, max: 88.9 };
        if (g === 'B' || g.includes('جيد جدا') || g.includes('جيد جداً')) return { min: 80, max: 83.9 };
        if (g === 'B-' || g.includes('جيد جدا منخفض') || g.includes('جيد جداً منخفض')) return { min: 76, max: 79.9 };
        if (g === 'C+' || g.includes('جيد مرتفع')) return { min: 73, max: 75.9 };
        if (g === 'C' || g.includes('جيد')) return { min: 70, max: 72.9 };
        if (g === 'C-' || g.includes('جيد منخفض')) return { min: 67, max: 69.9 };
        if (g === 'D+' || g.includes('مقبول مرتفع')) return { min: 64, max: 66.9 };
        if (g === 'D' || g.includes('مقبول')) return { min: 60, max: 63.9 };
        if (g === 'F' || g === 'E' || g.includes('راسب')) return { min: 0, max: 59.9 };
        return null;
    }

    /**
     * Performs fuzzy sequence matching between a query and subject text.
     */
    static fuzzyScore(query, text) {
        const q = this.normalizeArabic(query);
        const t = this.normalizeArabic(text);
        if (!q) return 0;

        // Exact substring = highest score
        if (t.includes(q)) return 1000 + (q.length / t.length) * 100;

        // Subsequence match with consecutive bonus
        let qi = 0, consecutive = 0, score = 0;
        for (let ti = 0; ti < t.length && qi < q.length; ti++) {
            if (t[ti] === q[qi]) {
                consecutive++;
                score += consecutive * 10;
                qi++;
            } else {
                consecutive = 0;
            }
        }
        return qi === q.length ? score : 0;
    }
}
