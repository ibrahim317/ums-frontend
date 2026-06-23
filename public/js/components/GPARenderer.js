import { CompletedHoursCalculator } from '../utils/CompletedHoursCalculator.js';
import { CGPACalculator, getPointsFromGrade } from '../utils/CGPACalculator.js';

export const renderGPA = (containerId, data, onSubjectOpen) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!data || !data.years || data.years.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">لا يوجد سجل أكاديمي متاح حالياً.</p>';
        return;
    }

    const { cgpa } = CGPACalculator.calculate(data);
    const overallGPA = cgpa > 0 ? cgpa.toFixed(3) : "N/A";

    const gpaWidget = document.createElement('div');
    gpaWidget.className = 'gpa-metric-card';
    gpaWidget.innerHTML = `
        <div class="metric-content">
            <div class="metric-label">المعدل التراكمي العام (Cumulative GPA)</div>
            <div class="metric-value">${overallGPA}</div>
        </div>
        <div class="metric-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
        </div>
    `;
    container.appendChild(gpaWidget);

    // --- Completed Hours Widget (separate from CGPA) ---
    const { completedHours } = CompletedHoursCalculator.calculate(data);
    const hoursWidget = document.createElement('div');
    hoursWidget.className = 'gpa-metric-card';
    hoursWidget.innerHTML = `
        <div class="metric-content">
            <div class="metric-label">الساعات المكتملة (Completed Hours)</div>
            <div class="metric-value" style="white-space:nowrap;font-size:clamp(1.4rem,5vw,2rem)">140 / ${completedHours} </div>
            <div class="metric-subtext">متبقي <strong>${Math.max(0, 140 - completedHours)}</strong> ساعة للتخرج</div>
        </div>
        <div class="metric-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        </div>
    `;
    container.appendChild(hoursWidget);

    data.years.forEach(year => {
        const yearCard = document.createElement('div');
        yearCard.className = 'academic-year-card';

        const yearTitle = document.createElement('div');
        yearTitle.className = 'academic-year-title';
        yearTitle.textContent = year.year;
        yearCard.appendChild(yearTitle);

        year.terms.forEach(term => {
            const section = document.createElement('div');
            section.className = 'term-section';

            // --- Clean the term title: strip embedded [التقدير:X] / [Grade:X] / [GPA:X] ---
            const cleanTitle = (term.title || '')
                .replace(/\[(?:التقدير|Grade)\s*:[^\]]*\]/gi, '')
                .replace(/\[\s*GPA\s*:[^\]]*\]/gi, '')
                .trim();

            // --- Calculate per-term GPA and completed hours ---
            let termTotalPoints = 0;
            let termGpaHours = 0;
            let termCompletedHours = 0;

            term.subjects.forEach(subject => {
                const grade = (subject.grade || '').trim();
                const hours = parseFloat(subject.hours) || 0;
                if (hours <= 0) return;

                const isFail = grade === 'راسب' || grade === 'F' || grade === 'E' || grade.toLowerCase() === 'fail';
                const isAbsent = grade === 'غائب' || grade.toLowerCase() === 'absent';
                const isPassed = !isFail && !isAbsent && grade !== '';

                if (isPassed) termCompletedHours += hours;

                // For GPA: skip pass/fail subjects (ناجح) and summer training
                const isPassFail = grade === 'ناجح' || grade.toLowerCase() === 'pass';
                const isSummerTraining = (subject.name || '').includes('التدريب الصيفي') || (subject.name || '').toLowerCase().includes('summer training');
                if (isPassFail || isSummerTraining) return;

                let points = parseFloat(subject.points);
                if (isNaN(points)) {
                    const derived = getPointsFromGrade(grade);
                    if (derived !== null) points = derived;
                }
                if (isNaN(points)) return;

                termTotalPoints += points * hours;
                termGpaHours += hours;
            });

            const termGPA = termGpaHours > 0 ? (termTotalPoints / termGpaHours).toFixed(3) : null;

            // --- Build term header with optional badges ---
            let badgesHtml = '';
            if (termGPA !== null || termCompletedHours > 0) {
                const gpaBadge = termGPA !== null
                    ? `<span class="term-badge">GPA: ${termGPA}</span>`
                    : '';
                const hoursBadge = termCompletedHours > 0
                    ? `<span class="term-badge">${termCompletedHours} hr</span>`
                    : '';
                badgesHtml = `<div class="term-badges">${gpaBadge}${hoursBadge}</div>`;
            }

            const header = document.createElement('div');
            header.className = 'term-header';
            header.innerHTML = `
                <div class="term-header-content">
                    <h2>${cleanTitle}</h2>
                    ${badgesHtml}
                </div>
                <svg class="term-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;

            const content = document.createElement('div');
            content.className = 'term-content';

            term.subjects.forEach(subject => {
                const card = document.createElement('div');
                card.className = 'subject-card';

                const openBtn = onSubjectOpen ? `<button class="subject-open-btn" data-subject="${subject.name}">فتح</button>` : '';

                let displayedPoints = subject.points;
                if (!displayedPoints || displayedPoints === "لا يوجد" || isNaN(parseFloat(displayedPoints))) {
                    const derived = getPointsFromGrade(subject.grade);
                    if (derived !== null) {
                        displayedPoints = `${derived} (تقديري)`;
                    }
                }

                card.innerHTML = `
                    <h3>${subject.name}${openBtn}</h3>
                    <ul class="subject-grades">
                        <li><span class="grade-label">ساعات المقرر:</span> <span class="grade-value">${subject.hours}</span></li>
                        <li><span class="grade-label">التقدير:</span> <span class="grade-value">${subject.grade}</span></li>
                        <li><span class="grade-label">النقاط:</span> <span class="grade-value">${displayedPoints}</span></li>
                    </ul>
                `;

                if (onSubjectOpen) {
                    const btn = card.querySelector('.subject-open-btn');
                    if (btn) btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onSubjectOpen(subject.name);
                    });
                }

                content.appendChild(card);
            });

            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
            });

            section.appendChild(header);
            section.appendChild(content);
            yearCard.appendChild(section);
        });

        container.appendChild(yearCard);
    });
};
