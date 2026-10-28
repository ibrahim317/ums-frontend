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

        if (parsedData.terms.length === 0 && this._hasQuestionnaireBlockLink(doc)) {
            parsedData.blockedByQuestionnaires = true;
        } else if (parsedData.terms.length === 0 && this._hasPaymentBlockLink(doc)) {
            parsedData.blockedByPayment = true;
            parsedData.paymentUrl = 'https://ums.asu.edu.eg/Home/Payment';
        }

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

        if (parsedData.years.length === 0 && this._hasQuestionnaireBlockLink(doc)) {
            parsedData.blockedByQuestionnaires = true;
        } else if (parsedData.years.length === 0 && this._hasPaymentBlockLink(doc)) {
            parsedData.blockedByPayment = true;
            parsedData.paymentUrl = 'https://ums.asu.edu.eg/Home/Payment';
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

    /**
     * Checks if a document contains a block link redirecting to /Questionnaires.
     * @param {Document} doc 
     * @returns {boolean}
     */
    _hasQuestionnaireBlockLink(doc) {
        const anchors = doc.querySelectorAll('a[href]');
        for (const a of anchors) {
            const href = (a.getAttribute('href') || '').trim();
            if (/^\/Questionnaires(\/|$|\?)/i.test(href) || /ums\.asu\.edu\.eg\/Questionnaires(\/|$|\?)/i.test(href)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if a document contains an unpaid fees block redirecting to /Home/Payment.
     * @param {Document} doc 
     * @returns {boolean}
     */
    _hasPaymentBlockLink(doc) {
        const bodyText = (doc.body?.textContent || '').replace(/\s+/g, ' ');
        if (bodyText.includes('مصاريف غير مسددة')) {
            return true;
        }
        const anchors = doc.querySelectorAll('.ums-grades a[href], .ums-banner a[href], .ums-payment-block a[href], .app_service_item a[href], .job_listing_area a[href]');
        for (const a of anchors) {
            const href = (a.getAttribute('href') || '').trim();
            if (/^\/Home\/Payment(\/|$|\?)/i.test(href) || /ums\.asu\.edu\.eg\/Home\/Payment(\/|$|\?)/i.test(href)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Parses the /Questionnaires page to extract pending questionnaires.
     * @param {string} htmlText 
     * @returns {Object} { questionnaires: Array<{ id, url, title, category }> }
     */
    parseQuestionnaires(htmlText) {
        const doc = this._getDoc(htmlText);
        const questionnaires = [];
        const seenUrls = new Set();

        const anchors = doc.querySelectorAll('a[href]');
        anchors.forEach((el) => {
            const href = (el.getAttribute('href') || '').trim();
            if (!/\/Questionnaires\/solveQuestionnaire\//i.test(href)) return;
            if (seenUrls.has(href)) return;
            seenUrls.add(href);

            const idMatch = href.match(/solveQuestionnaire\/(\d+)/i);
            const id = idMatch ? idMatch[1] : href;

            const cardBody = el.closest('.card-body, .card-shadow');
            let title = '';
            if (cardBody) {
                const titleEl = cardBody.querySelector('.card-title, h5, h4, h6');
                if (titleEl) title = titleEl.textContent.replace(/\s+/g, ' ').trim();
            }
            if (!title) title = `استبيان #${id}`;

            let category = 'إستبيان';
            const tabContent = el.closest('.tabb-content');
            if (tabContent) {
                if (tabContent.classList.contains('general')) category = 'إستبيانات العامة';
                else if (tabContent.classList.contains('courses')) category = 'إستبيانات المقررات';
                else if (tabContent.classList.contains('academicGuidence')) category = 'استبيان عن المرشد الأكاديمى';
            }

            let cleanUrl = href;
            if (href.startsWith('http')) {
                try {
                    const u = new URL(href);
                    cleanUrl = u.pathname + u.search;
                } catch (e) {}
            } else if (!href.startsWith('/')) {
                cleanUrl = `/${href}`;
            }

            questionnaires.push({
                id,
                url: cleanUrl,
                title,
                category
            });
        });

        return { questionnaires };
    }

    /**
     * Parses an individual questionnaire form page (/Questionnaires/solveQuestionnaire/:id).
     * @param {string} htmlText 
     * @param {string|number|null} fallbackId 
     * @returns {Object} Structured questionnaire form metadata and sections
     */
    parseQuestionnaireForm(htmlText, fallbackId = null) {
        const doc = this._getDoc(htmlText);

        const parseAddToAnswersAttr = (onchangeStr) => {
            if (!onchangeStr) return null;
            const m = onchangeStr.match(/AddToAnswers\(\s*(\d+)\s*,\s*(\d+)\s*,\s*this\.value\s*(?:,\s*([^,\s)]+))?\s*(?:,\s*([^,\s)]+))?\s*,?\s*\)/);
            if (!m) return null;
            const parseNullable = (val) => (!val || val === 'null' || val === 'undefined') ? null : (isNaN(Number(val)) ? val : Number(val));
            return {
                questionId: Number(m[1]),
                answerType: Number(m[2]),
                instructorId: parseNullable(m[3]),
                taId: parseNullable(m[4])
            };
        };

        const mainTitleEl = doc.querySelector('h3.main-title') || doc.querySelector('h1');
        const title = mainTitleEl ? mainTitleEl.textContent.replace(/\s+/g, ' ').trim() : 'حل الاستبيان';

        const tokenInput = doc.querySelector('input[name="__RequestVerificationToken"]');
        const requestVerificationToken = tokenInput ? (tokenInput.value || '') : '';

        let scriptText = '';
        doc.querySelectorAll('script').forEach((s) => {
            const t = s.textContent || '';
            if (t.includes('ValidateQuestionnaire') || t.includes('SaveAnswer')) {
                scriptText = t;
            }
        });

        const qIdMatch = scriptText.match(/QuestionnaireId\s*:\s*(\d+)/);
        const cIdMatch = scriptText.match(/CourseId\s*:\s*(\d+)/);
        const mandatoryMatch = scriptText.match(/mandatoryQuestionIds\s*=\s*\[([\d,\s]*)\]/);
        const advisorMatch = scriptText.match(/var\s+advisor\s*=\s*(\{[\s\S]*?\}|null)\s*;/);
        const advisorActiveMatch = scriptText.match(/var\s+AdvisorId\s*=\s*(\d+)\s*==\s*2/);

        let academicAdvisorId = null;
        if (advisorMatch && advisorMatch[1] && advisorMatch[1] !== 'null') {
            try {
                const adv = JSON.parse(advisorMatch[1]);
                if (!advisorActiveMatch || advisorActiveMatch[1] === '2') {
                    academicAdvisorId = adv?.MemberId ?? null;
                }
            } catch (e) {}
        }

        const mandatoryQuestionIds = mandatoryMatch
            ? mandatoryMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
            : [];
        const mandatorySet = new Set(mandatoryQuestionIds);
        const sections = [];

        doc.querySelectorAll('form .row.card-shadow').forEach((cardEl, sIdx) => {
            const headerEl = cardEl.querySelector('.section-header');
            const sectionTitle = headerEl ? headerEl.textContent.replace(/\s+/g, ' ').trim() : `القسم ${sIdx + 1}`;
            const questions = [];

            cardEl.querySelectorAll('.question-label').forEach((qLabelEl) => {
                const qText = qLabelEl.textContent.replace(/\s+/g, ' ').trim();
                const hasMandatoryIcon = !!qLabelEl.querySelector('.mandatory_icon');

                let questionMeta = null;
                let inputType = 'radio';
                const options = [];
                let note = '';

                let sib = qLabelEl.nextElementSibling;
                while (sib && !sib.classList.contains('question-label') && !sib.classList.contains('section-header')) {
                    const formChecks = sib.classList.contains('form-check')
                        ? [sib]
                        : Array.from(sib.querySelectorAll('.form-check'));

                    formChecks.forEach((fc) => {
                        const inp = fc.querySelector('input');
                        if (!inp) return;
                        const meta = parseAddToAnswersAttr(inp.getAttribute('onchange'));
                        if (meta && !questionMeta) questionMeta = meta;
                        inputType = (inp.getAttribute('type') || 'radio').toLowerCase();
                        const lblEl = fc.querySelector('label');
                        const label = lblEl ? lblEl.textContent.replace(/\s+/g, ' ').trim() : (inp.value || '');
                        options.push({
                            value: inp.value,
                            label
                        });
                    });

                    const textareas = sib.tagName.toLowerCase() === 'textarea'
                        ? [sib]
                        : Array.from(sib.querySelectorAll('textarea'));

                    textareas.forEach((ta) => {
                        const meta = parseAddToAnswersAttr(ta.getAttribute('onchange') || ta.getAttribute('oninput'));
                        if (meta && !questionMeta) questionMeta = meta;
                        inputType = 'textarea';
                    });

                    if (formChecks.length === 0 && textareas.length === 0) {
                        const pText = sib.textContent.replace(/\s+/g, ' ').trim();
                        if (pText) note = pText;
                    }

                    sib = sib.nextElementSibling;
                }

                if (questionMeta) {
                    const isMandatory = hasMandatoryIcon || mandatorySet.has(questionMeta.questionId);
                    questions.push({
                        ...questionMeta,
                        text: qText,
                        mandatory: isMandatory,
                        inputType,
                        options,
                        note
                    });
                }
            });

            if (questions.length > 0) {
                const isEvaluationSection = sectionTitle.includes('بنود التقييم') || questions.some(q => q.answerType === 2);
                sections.push({
                    title: sectionTitle,
                    isEvaluationSection,
                    questions
                });
            }
        });

        return {
            title,
            questionnaireId: qIdMatch ? parseInt(qIdMatch[1], 10) : (fallbackId ? parseInt(fallbackId, 10) : null),
            courseId: cIdMatch ? parseInt(cIdMatch[1], 10) : 0,
            academicAdvisorId,
            requestVerificationToken,
            mandatoryQuestionIds,
            sections
        };
    }

    _getDoc(htmlText) {
        const parser = new DOMParser();
        return parser.parseFromString(htmlText, 'text/html');
    }
}
