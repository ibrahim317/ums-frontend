const axios = require('axios');
const cheerio = require('cheerio');

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

    $('.academic-year-accordion').each((i, yearEl) => {
        const yearTitle = $(yearEl).find('.academic-year-header span').first().text().replace(/\s+/g, ' ').trim();
        if (!yearTitle) return;

        const yearObj = {
            year: yearTitle,
            terms: []
        };

        // There might be multiple exam rounds (e.g. دور يناير) per year, but usually it's wrapped in .year-content
        // Actually, we'll just extract all .faq-item inside this year
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

                // Iterate through the rows to extract Hours, Grade, Points
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

    return parsedData;
};

module.exports = {
    fetchAcademicYears,
    fetchYearWorkGrades,
    fetchGPA
};
