/**
 * UmsParser handles parsing of raw HTML responses from the UMS portal.
 * It uses the browser's native DOMParser to navigate and extract data.
 */
export class UmsParser {
    /**
     * Extracts the verification token required for login.
     * @param {string} htmlText 
     * @returns {string|null} Token or null if not found
     */
    parseRequestVerificationToken(htmlText) {
        const doc = this._getDoc(htmlText);
        return doc.querySelector('input[name="__RequestVerificationToken"]')?.value || null;
    }

    /**
     * Parses the student's year-work grades page.
     * @param {string} htmlText 
     * @returns {Object} Structured year work grades data
     */
    parseYearWorkGrades(htmlText) {
        const doc = this._getDoc(htmlText);
        const parsedData = { terms: [] };

        const faqItems = doc.querySelectorAll('.faq-item');
        faqItems.forEach((termEl) => {
            const button = termEl.querySelector('.faq-title button');
            if (!button) return;
            const termTitleRaw = button.textContent.replace(/\s+/g, ' ').trim();
            const termTitle = termTitleRaw.replace(/^\d+/, '').trim();
            
            if (!termTitle) return;

            const termObj = {
                title: termTitle,
                subjects: []
            };

            const subjectEls = termEl.querySelectorAll('.price-table-box2');
            subjectEls.forEach((subjectEl) => {
                const span = subjectEl.querySelector('span');
                if (!span) return;
                const subjectName = span.textContent.replace(/\s+/g, ' ').trim();
                const grades = [];
                
                const gradeEls = subjectEl.querySelectorAll('ul li');
                gradeEls.forEach((gradeEl) => {
                    grades.push(gradeEl.textContent.trim().replace(/\s+/g, ' '));
                });

                termObj.subjects.push({
                    name: subjectName,
                    grades: grades
                });
            });

            if (termObj.subjects.length > 0) {
                parsedData.terms.push(termObj);
            }
        });

        return parsedData;
    }

    /**
     * Parses the student's overall GPA and term history page.
     * @param {string} htmlText 
     * @returns {Object} Structured GPA history
     */
    parseGPA(htmlText) {
        const doc = this._getDoc(htmlText);
        const parsedData = { years: [] };

        const yearEls = doc.querySelectorAll('.academic-year-accordion');
        yearEls.forEach((yearEl) => {
            const span = yearEl.querySelector('.academic-year-header span');
            if (!span) return;
            const yearTitle = span.textContent.replace(/\s+/g, ' ').trim();
            if (!yearTitle) return;

            const yearObj = {
                year: yearTitle,
                terms: []
            };

            const termEls = yearEl.querySelectorAll('.faq-item');
            termEls.forEach((termEl) => {
                const button = termEl.querySelector('.faq-title button');
                if (!button) return;
                const termTitleRaw = button.textContent.replace(/\s+/g, ' ').trim();
                const termTitle = termTitleRaw.replace(/^\d+/, '').trim();

                if (!termTitle) return;

                const termObj = {
                    title: termTitle,
                    subjects: []
                };

                const subjectEls = termEl.querySelectorAll('.price-table-box2');
                subjectEls.forEach((subjectEl) => {
                    const h5 = subjectEl.querySelector('h5');
                    if (!h5) return;
                    const subjectNameRaw = h5.textContent.replace(/\s+/g, ' ').trim();
                    const subjectName = subjectNameRaw.replace(/^المقرر:\s*/, '').trim();

                    let hours = '', grade = '', points = '';

                    const rowEls = subjectEl.querySelectorAll('.row');
                    rowEls.forEach((rowEl) => {
                        const rowH5 = rowEl.querySelector('h5');
                        const rowP = rowEl.querySelector('p');
                        if (!rowH5 || !rowP) return;
                        const label = rowH5.textContent.replace(/\s+/g, ' ').trim();
                        const value = rowP.textContent.replace(/\s+/g, ' ').trim();

                        if (label.includes('ساعات المقرر')) hours = value;
                        else if (label.includes('التقدير')) grade = value;
                        else if (label.includes('النقاط')) points = value;
                    });

                    termObj.subjects.push({
                        name: subjectName,
                        hours: hours,
                        grade: grade,
                        points: points
                    });
                });

                if (termObj.subjects.length > 0) {
                    yearObj.terms.push(termObj);
                }
            });

            if (yearObj.terms.length > 0) {
                parsedData.years.push(yearObj);
            }
        });

        return parsedData;
    }

    _getDoc(htmlText) {
        const parser = new DOMParser();
        return parser.parseFromString(htmlText, 'text/html');
    }
}
