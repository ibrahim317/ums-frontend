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

        // --- New UMS HTML structure (2025+): .ums-year > .ums-round > .ums-term > .ums-course ---
        const newYearEls = doc.querySelectorAll('.ums-year');
        newYearEls.forEach((yearEl) => {
            const titleEl = yearEl.querySelector('.ums-year__header-title');
            if (!titleEl) return;
            const yearTitle = titleEl.textContent.replace(/\s+/g, ' ').trim();
            if (!yearTitle) return;

            const yearObj = {
                year: yearTitle,
                terms: []
            };

            // Each year can have multiple rounds (e.g. دور يناير, دور مايو)
            const roundEls = yearEl.querySelectorAll('.ums-round');
            roundEls.forEach((roundEl) => {
                const termEls = roundEl.querySelectorAll('.ums-term');
                termEls.forEach((termEl) => {
                    const nameEl = termEl.querySelector('.ums-term__name');
                    if (!nameEl) return;
                    const termName = nameEl.textContent.replace(/\s+/g, ' ').trim();
                    if (!termName) return;

                    const termObj = {
                        title: termName,
                        subjects: []
                    };

                    const courseEls = termEl.querySelectorAll('.ums-course');
                    courseEls.forEach((courseEl) => {
                        const codeEl = courseEl.querySelector('.ums-course__code');
                        const titleEl = courseEl.querySelector('.ums-course__title');
                        const courseCode = codeEl ? codeEl.textContent.replace(/\s+/g, ' ').trim() : '';
                        const courseTitle = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
                        const subjectName = courseCode ? `[${courseCode}] ${courseTitle}` : courseTitle;

                        let hours = '', grade = '', points = '';

                        const rowEls = courseEl.querySelectorAll('.ums-course__row');
                        rowEls.forEach((rowEl) => {
                            const labelEl = rowEl.querySelector('.ums-course__row-label');
                            const valueEl = rowEl.querySelector('.ums-course__row-value');
                            if (!labelEl || !valueEl) return;
                            const label = labelEl.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                            const value = valueEl.textContent.replace(/\s+/g, ' ').trim();

                            if (label.includes('ساعات المقرر') || label.includes('hours')) hours = value;
                            else if (label.includes('التقدير') || label.includes('grade')) grade = value;
                            else if (label.includes('النقاط') || label.includes('points')) points = value;
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
            });

            if (yearObj.terms.length > 0) {
                parsedData.years.push(yearObj);
            }
        });

        // --- Fallback: Old UMS HTML structure (.academic-year-accordion) ---
        if (parsedData.years.length === 0) {
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
                        const subjectName = subjectNameRaw
                            .replace(/^(المقرر:|Course:)\s*/i, '')
                            .replace(/^\[.*?\]\s*/, '')
                            .trim();

                        let hours = '', grade = '', points = '';

                        const rowEls = subjectEl.querySelectorAll('.row');
                        rowEls.forEach((rowEl) => {
                            const rowH5 = rowEl.querySelector('h5');
                            const rowP = rowEl.querySelector('p');
                            if (!rowH5 || !rowP) return;
                            const label = rowH5.textContent.replace(/\s+/g, ' ').trim().toLowerCase();
                            const value = rowP.textContent.replace(/\s+/g, ' ').trim();

                            if (label.includes('ساعات المقرر') || label.toLowerCase().includes('hours')) hours = value;
                            else if (label.includes('التقدير') || label.toLowerCase().includes('grade')) grade = value;
                            else if (label.includes('النقاط') || label.toLowerCase().includes('points')) points = value;
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
        }

        return parsedData;
    }

    /**
     * Parses the current courses page.
     * @param {string} htmlText 
     * @returns {Object} Structured current courses
     */
    parseCurrentCourses(htmlText) {
        const doc = this._getDoc(htmlText);
        const courses = [];

        const subjectEls = doc.querySelectorAll('.price-table-box2');
        subjectEls.forEach((subjectEl) => {
            const h5 = subjectEl.querySelector('h5.text-dark');
            if (!h5) return;
            const subjectNameRaw = h5.textContent.replace(/\s+/g, ' ').trim();
            if (subjectNameRaw) {
                courses.push({
                    name: subjectNameRaw
                });
            }
        });

        return { courses };
    }

    /**
     * Parses the My Account page.
     * @param {string} htmlText 
     * @returns {Object} Structured account info
     */
    parseMyAccountInfo(htmlText) {
        const doc = this._getDoc(htmlText);
        let highestLevel = null;

        const progressEls = doc.querySelectorAll('.sidebar-box .progress .lead');
        progressEls.forEach((el) => {
            const text = el.textContent.replace(/\s+/g, ' ').trim();
            if (text && !highestLevel) {
                highestLevel = text;
            }
        });

        return { levelText: highestLevel };
    }

    _getDoc(htmlText) {
        const parser = new DOMParser();
        return parser.parseFromString(htmlText, 'text/html');
    }
}
