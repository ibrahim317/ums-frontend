/**
 * TextNormalizer - Pure text normalization and grade analysis helpers.
 */
export class TextNormalizer {
    /**
     * Extracts a standardized course code (e.g. "CS305") from a subject name if present.
     */
    static extractCourseCode(name) {
        if (!name) return null;
        const bracketMatch = String(name).match(/\[\s*([A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?)\s*\]/);
        if (bracketMatch) return bracketMatch[1].replace(/\s+/g, '').toUpperCase();

        const leadMatch = String(name).match(/^(?:المقرر:|Course:)?\s*([A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?)\s*[-–—:]/i);
        if (leadMatch) return leadMatch[1].replace(/\s+/g, '').toUpperCase();

        const trailMatch = String(name).match(/(?:[-–—]|\()\s*([A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?)\s*\)?$/);
        if (trailMatch) return trailMatch[1].replace(/\s+/g, '').toUpperCase();

        return null;
    }

    /**
     * Cleans prefixes/suffixes like "[CS305]", "CS305 - ", or "المقرر: " from a subject name.
     */
    static cleanSubjectName(name) {
        return (name || '')
            .replace(/^(المقرر:|Course:)\s*/i, '')
            .replace(/^\[[^\]]+\]\s*/, '')
            .replace(/\s*\[[^\]]+\]$/, '')
            .replace(/^[A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?\s*[-–—:]\s*/, '')
            .replace(/\s*[-–—]\s*[A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?$/, '')
            .replace(/\s*\([A-Za-z]{2,6}\s*\d{2,4}[A-Za-z]?\)$/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Normalizes Arabic & English text for case-insensitive, diacritic-insensitive matching.
     */
    static normalizeArabic(text) {
        return this.cleanSubjectName(text)
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[-–—_]+/g, ' ')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Normalizes academic year labels (e.g. "2024 - 2025", "العام الأكاديمي 2024/2025")
     * into a canonical format like "2024-2025".
     */
    static normalizeYearLabel(yearLabel) {
        if (!yearLabel) return '';
        const latin = String(yearLabel).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        const rangeMatch = latin.match(/(20\d{2})\s*[-/–—]\s*(20\d{2})/);
        if (rangeMatch) {
            return `${rangeMatch[1]}-${rangeMatch[2]}`;
        }
        const singleYear = latin.match(/(20\d{2})/);
        if (singleYear) {
            return singleYear[1];
        }
        return latin.replace(/\s+/g, ' ').trim();
    }

    /**
     * Returns a canonical term key ('term_1', 'term_2', 'term_3') so Arabic/English
     * and Fall/First or Spring/Second labels merge cleanly between GPA and Year Work.
     */
    static normalizeTermKey(title) {
        if (!title) return '';
        const t = String(title)
            .replace(/\[.*?\]/g, '')
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, '')
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .toLowerCase()
            .trim();

        if (
            t.includes('خريف') ||
            t.includes('الاول') ||
            t.includes('اول') ||
            t.includes('يناير') ||
            t.includes('fall') ||
            t.includes('autumn') ||
            t.includes('first') ||
            t.includes('january') ||
            /\b(term|semester)\s*1\b/.test(t)
        ) {
            return 'term_1';
        }
        if (
            t.includes('ربيع') ||
            t.includes('الثاني') ||
            t.includes('ثاني') ||
            t.includes('مايو') ||
            t.includes('يونيو') ||
            t.includes('spring') ||
            t.includes('second') ||
            t.includes('may') ||
            t.includes('june') ||
            /\b(term|semester)\s*2\b/.test(t)
        ) {
            return 'term_2';
        }
        if (
            t.includes('صيف') ||
            t.includes('اغسطس') ||
            t.includes('سبتمبر') ||
            t.includes('summer') ||
            t.includes('third') ||
            t.includes('august') ||
            /\b(term|semester)\s*3\b/.test(t)
        ) {
            return 'term_3';
        }
        return t.replace(/\s+/g, ' ');
    }

    /**
     * Standardizes term titles for display while aligning Arabic & English variants.
     */
    static normalizeTermTitle(title) {
        if (!title) return '';
        const key = this.normalizeTermKey(title);
        if (key === 'term_1') return 'فصل الخريف';
        if (key === 'term_2') return 'فصل الربيع';
        if (key === 'term_3') return 'فصل الصيف';
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
