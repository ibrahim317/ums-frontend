const axios = require('axios');
const cheerio = require('cheerio');

const hasQuestionnaireBlockLink = ($) => {
    let blocked = false;
    $('a[href]').each((i, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (/^\/Questionnaires(\/|$|\?)/i.test(href) || /ums\.asu\.edu\.eg\/Questionnaires(\/|$|\?)/i.test(href)) {
            blocked = true;
            return false;
        }
    });
    return blocked;
};

const parseQuestionnairesHtml = (html) => {
    const $ = cheerio.load(html);
    const questionnaires = [];
    const seenUrls = new Set();

    $('a[href]').each((i, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (!/\/Questionnaires\/solveQuestionnaire\//i.test(href)) return;
        if (seenUrls.has(href)) return;
        seenUrls.add(href);

        const idMatch = href.match(/solveQuestionnaire\/(\d+)/i);
        const id = idMatch ? idMatch[1] : href;

        const cardBody = $(el).closest('.card-body, .card-shadow');
        let title = cardBody.find('.card-title, h5, h4, h6').first().text().replace(/\s+/g, ' ').trim();
        if (!title) {
            title = `استبيان #${id}`;
        }

        let category = 'إستبيان';
        const tabContent = $(el).closest('.tabb-content');
        if (tabContent.hasClass('general')) category = 'إستبيانات العامة';
        else if (tabContent.hasClass('courses')) category = 'إستبيانات المقررات';
        else if (tabContent.hasClass('academicGuidence')) category = 'استبيان عن المرشد الأكاديمى';

        questionnaires.push({
            id,
            url: href.startsWith('http') ? new URL(href).pathname + new URL(href).search : (href.startsWith('/') ? href : `/${href}`),
            title,
            category
        });
    });

    return { questionnaires };
};

const fetchQuestionnaires = async (cookies) => {
    const url = 'https://ums.asu.edu.eg/Questionnaires';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://ums.asu.edu.eg/StudentGrades',
            'Cookie': cookies
        }
    });

    return parseQuestionnairesHtml(response.data);
};

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

const parseQuestionnaireFormHtml = (html, fallbackId = null) => {
    const $ = cheerio.load(html);

    const title = $('h3.main-title').first().text().replace(/\s+/g, ' ').trim() ||
        $('h1').first().text().replace(/\s+/g, ' ').trim() ||
        'حل الاستبيان';

    const requestVerificationToken = $('input[name="__RequestVerificationToken"]').first().val() || '';

    let scriptText = '';
    $('script').each((i, el) => {
        const t = $(el).html() || '';
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
        } catch (e) {
            // ignore JSON parse error
        }
    }

    const mandatoryQuestionIds = mandatoryMatch
        ? mandatoryMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        : [];

    const mandatorySet = new Set(mandatoryQuestionIds);
    const sections = [];

    $('form .row.card-shadow').each((sIdx, cardEl) => {
        const sectionTitle = $(cardEl).find('.section-header').first().text().replace(/\s+/g, ' ').trim() || `القسم ${sIdx + 1}`;
        const questions = [];

        $(cardEl).find('.question-label').each((qIdx, qLabelEl) => {
            const qText = $(qLabelEl).text().replace(/\s+/g, ' ').trim();
            const hasMandatoryIcon = $(qLabelEl).find('.mandatory_icon').length > 0;

            let questionMeta = null;
            let inputType = 'radio';
            const options = [];
            let note = '';

            let sib = $(qLabelEl).next();
            while (sib.length && !sib.hasClass('question-label') && !sib.hasClass('section-header')) {
                const formChecks = sib.hasClass('form-check') ? sib : sib.find('.form-check');
                formChecks.each((j, fc) => {
                    const inp = $(fc).find('input').first();
                    if (!inp.length) return;
                    const meta = parseAddToAnswersAttr(inp.attr('onchange'));
                    if (meta && !questionMeta) questionMeta = meta;
                    inputType = (inp.attr('type') || 'radio').toLowerCase();
                    const label = $(fc).find('label').text().replace(/\s+/g, ' ').trim() || inp.val();
                    options.push({
                        value: inp.val(),
                        label
                    });
                });

                const textareas = sib.is('textarea') ? sib : sib.find('textarea');
                textareas.each((j, ta) => {
                    const meta = parseAddToAnswersAttr($(ta).attr('onchange') || $(ta).attr('oninput'));
                    if (meta && !questionMeta) questionMeta = meta;
                    inputType = 'textarea';
                });

                if (formChecks.length === 0 && textareas.length === 0) {
                    const pText = sib.text().replace(/\s+/g, ' ').trim();
                    if (pText) note = pText;
                }

                sib = sib.next();
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
};

const fetchQuestionnaireForm = async (cookies, urlOrId) => {
    let pathUrl = String(urlOrId || '').trim();
    if (/^\d+$/.test(pathUrl)) {
        pathUrl = `/Questionnaires/solveQuestionnaire/${pathUrl}`;
    } else if (!pathUrl.startsWith('/')) {
        pathUrl = `/${pathUrl}`;
    }
    const idMatch = pathUrl.match(/solveQuestionnaire\/(\d+)/i);
    const fallbackId = idMatch ? idMatch[1] : null;

    const fullUrl = `https://ums.asu.edu.eg${pathUrl}`;
    const response = await axios.get(fullUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://ums.asu.edu.eg/Questionnaires',
            'Cookie': cookies
        }
    });

    const form = parseQuestionnaireFormHtml(response.data, fallbackId);
    return {
        form,
        setCookieHeader: response.headers['set-cookie'] || null
    };
};

const submitQuestionnaire = async (cookies, payload) => {
    const {
        answersList,
        questionnaireId,
        courseId = 0,
        academicAdvisorId = null,
        requestVerificationToken
    } = payload;

    const params = new URLSearchParams();
    params.append('AnswersList', typeof answersList === 'string' ? answersList : JSON.stringify(answersList || []));
    params.append('QuestionnaireId', String(questionnaireId));
    params.append('CourseId', String(courseId ?? 0));
    params.append('AcademicAdvisorId', academicAdvisorId != null ? String(academicAdvisorId) : '');
    params.append('__RequestVerificationToken', requestVerificationToken || '');

    const response = await axios.post('https://ums.asu.edu.eg/Questionnaires/SaveAnswer', params.toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://ums.asu.edu.eg',
            'Referer': `https://ums.asu.edu.eg/Questionnaires/solveQuestionnaire/${questionnaireId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': cookies
        }
    });

    return response.data;
};

const fetchAcademicYears = async (cookies) => {
    const url = 'https://ums.asu.edu.eg/StudentGrades/GetAllStudentAcademicYears';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent',
            'Cookie': cookies,
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    return response.data; // Expected: [{Disabled: false, Text: "2025-2026", Value: "124"}, ...]
};

const fetchYearWorkGrades = async (cookies, yearId) => {
    let url = 'https://ums.asu.edu.eg/YearWorkGradesForStudent/StudentYearWorkGrades';
    let response;

    if (yearId) {
        // Fetch specific year via POST
        response = await axios.post(url, `AcademicYearId=${yearId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent',
                'Cookie': cookies
            }
        });
    } else {
        // Default fetch via GET
        url = 'https://ums.asu.edu.eg/YearWorkGradesForStudent';
        response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Referer': 'https://ums.asu.edu.eg/UserInformation/MyAccount',
                'Cookie': cookies
            }
        });
    }

    const $ = cheerio.load(response.data);
    const parsedData = { terms: [] };

    $('.faq-item').each((i, termEl) => {
        const termTitleRaw = $(termEl).find('.faq-title button').text().replace(/\s+/g, ' ').trim();
        const termTitle = termTitleRaw.replace(/^\d+/, '').trim();

        if (!termTitle) return;

        const termObj = {
            title: termTitle,
            subjects: []
        };

        $(termEl).find('.price-table-box2').each((j, subjectEl) => {
            const subjectName = $(subjectEl).find('span').first().text().replace(/\s+/g, ' ').trim();
            const grades = [];

            $(subjectEl).find('ul li').each((k, gradeEl) => {
                grades.push($(gradeEl).text().trim().replace(/\s+/g, ' '));
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

    if (parsedData.terms.length === 0 && hasQuestionnaireBlockLink($)) {
        parsedData.blockedByQuestionnaires = true;
        try {
            const qData = await fetchQuestionnaires(cookies);
            parsedData.questionnaires = qData.questionnaires || [];
        } catch (err) {
            console.warn('Failed to auto-fetch questionnaires on blocked year work:', err.message);
            parsedData.questionnaires = [];
        }
    }

    return parsedData;
};

const fetchGPA = async (cookies) => {
    const url = 'https://ums.asu.edu.eg/StudentGrades';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://ums.asu.edu.eg/YearWorkGradesForStudent/StudentYearWorkGrades',
            'Cookie': cookies
        }
    });

    const $ = cheerio.load(response.data);
    const parsedData = { years: [] };

    // --- New UMS HTML structure (2025+): .ums-year > .ums-round > .ums-term > .ums-course ---
    $('.ums-year').each((i, yearEl) => {
        const yearTitle = $(yearEl).find('.ums-year__header-title').first().text().replace(/\s+/g, ' ').trim();
        if (!yearTitle) return;

        const yearObj = {
            year: yearTitle,
            terms: []
        };

        // Each year can have multiple rounds (e.g. دور يناير, دور مايو)
        $(yearEl).find('.ums-round').each((j, roundEl) => {
            $(roundEl).find('.ums-term').each((k, termEl) => {
                const termName = $(termEl).find('.ums-term__name').first().text().replace(/\s+/g, ' ').trim();
                if (!termName) return;

                const termObj = {
                    title: termName,
                    subjects: []
                };

                $(termEl).find('.ums-course').each((l, courseEl) => {
                    const courseCode = $(courseEl).find('.ums-course__code').text().replace(/\s+/g, ' ').trim();
                    const courseTitle = $(courseEl).find('.ums-course__title').text().replace(/\s+/g, ' ').trim();
                    const subjectName = courseCode ? `[${courseCode}] ${courseTitle}` : courseTitle;

                    let hours = '', grade = '', points = '';

                    $(courseEl).find('.ums-course__row').each((m, rowEl) => {
                        const label = $(rowEl).find('.ums-course__row-label').text().replace(/\s+/g, ' ').trim().toLowerCase();
                        const value = $(rowEl).find('.ums-course__row-value').text().replace(/\s+/g, ' ').trim();

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
        $('.academic-year-accordion').each((i, yearEl) => {
            const yearTitle = $(yearEl).find('.academic-year-header span').first().text().replace(/\s+/g, ' ').trim();
            if (!yearTitle) return;

            const yearObj = {
                year: yearTitle,
                terms: []
            };

            $(yearEl).find('.faq-item').each((j, termEl) => {
                const termTitleRaw = $(termEl).find('.faq-title button').text().replace(/\s+/g, ' ').trim();
                const termTitle = termTitleRaw.replace(/^\d+/, '').trim();

                if (!termTitle) return;

                const termObj = {
                    title: termTitle,
                    subjects: []
                };

                $(termEl).find('.price-table-box2').each((k, subjectEl) => {
                    const subjectNameRaw = $(subjectEl).find('h5').first().text().replace(/\s+/g, ' ').trim();
                    const subjectName = subjectNameRaw
                        .replace(/^(المقرر:|Course:)\s*/i, '')
                        .replace(/^\[.*?\]\s*/, '')
                        .trim();

                    let hours = '', grade = '', points = '';

                    $(subjectEl).find('.row').each((l, rowEl) => {
                        const label = $(rowEl).find('h5').text().replace(/\s+/g, ' ').trim().toLowerCase();
                        const value = $(rowEl).find('p').text().replace(/\s+/g, ' ').trim();

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

    if (parsedData.years.length === 0 && hasQuestionnaireBlockLink($)) {
        parsedData.blockedByQuestionnaires = true;
        try {
            const qData = await fetchQuestionnaires(cookies);
            parsedData.questionnaires = qData.questionnaires || [];
        } catch (err) {
            console.warn('Failed to auto-fetch questionnaires on blocked GPA:', err.message);
            parsedData.questionnaires = [];
        }
    }

    return parsedData;
}

const fetchCurrentCourses = async (cookies) => {
    const url = 'https://ums.asu.edu.eg/UserInformation/CurrentCourse';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://ums.asu.edu.eg/UserInformation/MyAccount',
            'Cookie': cookies
        }
    });

    const $ = cheerio.load(response.data);
    const courses = [];

    $('.price-table-box2').each((i, subjectEl) => {
        const subjectNameRaw = $(subjectEl).find('h5.text-dark').first().text().replace(/\s+/g, ' ').trim();
        if (subjectNameRaw) {
            courses.push({
                name: subjectNameRaw
            });
        }
    });

    return { courses };
};

const fetchMyAccountInfo = async (cookies) => {
    const url = 'https://ums.asu.edu.eg/UserInformation/MyAccount';
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cookie': cookies
        }
    });

    const $ = cheerio.load(response.data);
    let highestLevel = null;

    $('.sidebar-box .progress .lead').each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
            // Pick the first one we find as it's usually ordered, but let's just collect all and sort or just grab them
            // "المستوى الثالث - دور يناير"
            // Let's just return all of them or the highest.
            // The user said "highest Level he have in this sidebar".
            if (!highestLevel) highestLevel = text; // Usually the first one is the latest
        }
    });

    return { levelText: highestLevel };
};

module.exports = {
    fetchAcademicYears,
    fetchYearWorkGrades,
    fetchGPA,
    fetchCurrentCourses,
    fetchMyAccountInfo,
    fetchQuestionnaires,
    fetchQuestionnaireForm,
    submitQuestionnaire,
    parseQuestionnairesHtml,
    parseQuestionnaireFormHtml,
    hasQuestionnaireBlockLink
};
