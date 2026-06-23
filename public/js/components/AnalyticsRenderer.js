import { CompletedHoursCalculator } from '../utils/CompletedHoursCalculator.js';
import { CGPACalculator, getPointsFromGrade } from '../utils/CGPACalculator.js';

export const renderAnalytics = (containerId, gpaData, myAccountData) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!gpaData || !gpaData.years || gpaData.years.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">لا يوجد سجل أكاديمي متاح للتحليل.</p>';
        return;
    }

    // 1. Calculate Core Metrics
    const { completedHours, details } = CompletedHoursCalculator.calculate(gpaData);
    const { cgpa } = CGPACalculator.calculate(gpaData);
    const finalCgpa = parseFloat(cgpa || 0);

    // Calculate level based on rules
    let calculatedLevel = "المستوى الأول (Freshman)";
    if (completedHours >= 104) calculatedLevel = "المستوى الرابع (Senior)";
    else if (completedHours >= 69) calculatedLevel = "المستوى الثالث (Junior)";
    else if (completedHours >= 36) calculatedLevel = "المستوى الثاني (Sophomore)";

    const officialLevel = myAccountData?.levelText || "غير متوفر";

    // Max Registration Hours Rules
    let maxRegistration = 21;
    let registrationMessage = "تهانينا! يمكنك تسجيل حتى 21 ساعة معتمدة.";
    let registrationClass = "status-success";
    
    if (finalCgpa < 2.0) {
        maxRegistration = 14;
        registrationMessage = "تحذير أكاديمي: مسموح لك بتسجيل 14 ساعة معتمدة كحد أقصى (أو 5 مقررات).";
        registrationClass = "status-danger";
    } else if (finalCgpa < 3.0) {
        maxRegistration = 18;
        registrationMessage = "يمكنك تسجيل 18 ساعة معتمدة كحد أقصى.";
        registrationClass = "status-warning";
    }

    // Summer Training Count
    let summerTrainingCount = 0;
    details.forEach((val, name) => {
        if (name.includes('التدريب الصيفي')) {
            summerTrainingCount++;
        }
    });

    // Grade Distribution & Term GPAs
    const gradeCounts = {};
    const termLabels = [];
    const termGpas = [];

    gpaData.years.forEach(year => {
        year.terms.forEach(term => {
            let termTotalPoints = 0;
            let termGpaHours = 0;

            term.subjects.forEach(subject => {
                // Grade Counts
                const g = (subject.grade || '').trim();
                if (g && g !== 'غائب' && g !== 'راسب' && g !== 'F' && g !== 'E' && g !== 'ناجح') {
                    // Normalize text grades to letters for the chart
                    let shortGrade = g;
                    if (g.includes('امتياز مرتفع') || g.includes('امتياز اول')) shortGrade = 'A+';
                    else if (g.includes('امتياز منخفض')) shortGrade = 'A-';
                    else if (g.includes('امتياز')) shortGrade = 'A';
                    else if (g.includes('جيد جدا مرتفع')) shortGrade = 'B+';
                    else if (g.includes('جيد جدا منخفض')) shortGrade = 'B-';
                    else if (g.includes('جيد جدا')) shortGrade = 'B';
                    else if (g.includes('جيد مرتفع')) shortGrade = 'C+';
                    else if (g.includes('جيد منخفض')) shortGrade = 'C-';
                    else if (g.includes('جيد')) shortGrade = 'C';
                    else if (g.includes('مقبول مرتفع')) shortGrade = 'D+';
                    else if (g.includes('مقبول')) shortGrade = 'D';

                    gradeCounts[shortGrade] = (gradeCounts[shortGrade] || 0) + 1;
                }

                // Term GPA
                const hours = parseFloat(subject.hours) || 0;
                if (hours > 0 && g !== 'ناجح' && !subject.name.includes('التدريب الصيفي')) {
                    let points = parseFloat(subject.points);
                    if (isNaN(points)) points = getPointsFromGrade(g);
                    if (points !== null && !isNaN(points)) {
                        termTotalPoints += points * hours;
                        termGpaHours += hours;
                    }
                }
            });

            if (termGpaHours > 0) {
                const termTitle = term.title.replace(/\[.*\]/g, '').trim();
                termLabels.push(`${year.year} ${termTitle}`);
                termGpas.push((termTotalPoints / termGpaHours).toFixed(2));
            }
        });
    });

    // 2. Build UI HTML
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '20px';

    const insightsGrid = document.createElement('div');
    insightsGrid.style.display = 'grid';
    insightsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    insightsGrid.style.gap = '15px';

    // Widget Helper
    const createWidget = (title, value, subtext, iconSvg, extraClass = '') => `
        <div class="gpa-metric-card ${extraClass}" style="flex:1; margin:0;">
            <div class="metric-content">
                <div class="metric-label" style="font-weight:600;">${title}</div>
                <div class="metric-value" style="font-size: 1.8rem;">${value}</div>
                <div class="metric-subtext">${subtext}</div>
            </div>
            <div class="metric-icon">${iconSvg}</div>
        </div>
    `;

    // A. Academic Level Widget
    insightsGrid.innerHTML += createWidget(
        "المستوى الأكاديمي",
        calculatedLevel.split(' ')[0] + ' ' + calculatedLevel.split(' ')[1],
        `مسجل بالنظام: <strong>${officialLevel}</strong>`,
        `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l10 6.5-10 6.5-10-6.5L12 2z"></path><path d="M22 8.5v7.5l-10 6.5-10-6.5v-7.5"></path></svg>`
    );

    // B. Graduation Project Readiness
    const projReady = completedHours >= 94;
    const projMissing = Math.max(0, 94 - completedHours);
    insightsGrid.innerHTML += createWidget(
        "مشروع التخرج",
        projReady ? "جاهز للتسجيل" : `متبقي ${projMissing} ساعة`,
        projReady ? "لقد أتممت 94 ساعة فأكثر!" : "يجب إتمام 94 ساعة لتسجيل المشروع",
        `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
        projReady ? 'status-success' : ''
    );

    // C. Next Semester Limits
    insightsGrid.innerHTML += createWidget(
        "تسجيل الفصل القادم",
        `${maxRegistration} ساعة`,
        registrationMessage,
        `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        registrationClass
    );

    // D. Summer Training
    insightsGrid.innerHTML += createWidget(
        "التدريب الصيفي",
        `${summerTrainingCount} / 2 مكتمل`,
        summerTrainingCount >= 2 ? "تم استيفاء متطلب التدريب" : `متبقي ${2 - summerTrainingCount} تدريب صيفي`,
        `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
    );

    wrapper.appendChild(insightsGrid);

    // 3. Charts Section
    const chartsWrapper = document.createElement('div');
    chartsWrapper.style.display = 'grid';
    chartsWrapper.style.gridTemplateColumns = 'repeat(auto-fit, minmax(350px, 1fr))';
    chartsWrapper.style.gap = '20px';
    chartsWrapper.style.marginTop = '10px';

    // Chart A: GPA Trend
    const trendCard = document.createElement('div');
    trendCard.className = 'subject-card';
    trendCard.style.padding = '20px';
    trendCard.innerHTML = `
        <h3 style="margin-bottom: 15px;">منحنى المعدل الفصلي</h3>
        <canvas id="gpaTrendChart"></canvas>
    `;
    chartsWrapper.appendChild(trendCard);

    // Chart B: Grade Distribution
    const distCard = document.createElement('div');
    distCard.className = 'subject-card';
    distCard.style.padding = '20px';
    distCard.innerHTML = `
        <h3 style="margin-bottom: 15px;">توزيع التقديرات المكتسبة</h3>
        <canvas id="gradeDistChart"></canvas>
    `;
    chartsWrapper.appendChild(distCard);

    wrapper.appendChild(chartsWrapper);
    container.appendChild(wrapper);

    // 4. Initialize Chart.js
    if (window.Chart) {
        // Line Chart
        const trendCtx = document.getElementById('gpaTrendChart').getContext('2d');
        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: termLabels,
                datasets: [{
                    label: 'المعدل الفصلي',
                    data: termGpas,
                    borderColor: '#002147',
                    backgroundColor: 'rgba(0, 33, 71, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#c8a048',
                    pointBorderColor: '#fff',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { min: 0, max: 4 }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        // Pie/Doughnut Chart
        const distCtx = document.getElementById('gradeDistChart').getContext('2d');
        const sortedGrades = Object.keys(gradeCounts).sort();
        const distData = sortedGrades.map(k => gradeCounts[k]);
        const colors = sortedGrades.map(g => {
            if (g.startsWith('A')) return '#28a745'; // Green
            if (g.startsWith('B')) return '#007bff'; // Blue
            if (g.startsWith('C')) return '#ffc107'; // Yellow
            if (g.startsWith('D')) return '#fd7e14'; // Orange
            return '#dc3545'; // Red
        });

        new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: sortedGrades,
                datasets: [{
                    data: distData,
                    backgroundColor: colors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });
    } else {
        console.warn('Chart.js is not loaded.');
    }
};
