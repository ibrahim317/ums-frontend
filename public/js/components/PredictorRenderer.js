import { appState } from '../services/AppState.js';
import { CGPACalculator } from '../utils/CGPACalculator.js';

export const renderPredictor = (containerId, yearWorkData, currentCoursesData) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '30px';

    // 1. GPA Predictor Section
    const gpaSection = document.createElement('div');
    gpaSection.className = 'predictor-section';
    gpaSection.innerHTML = `
        <div class="predictor-info">
            <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">توقعات المعدل التراكمي (GPA Predictor)</h2>
            <p style="color: var(--text-secondary); margin-bottom: 16px;">أدخل عدد الساعات والتقدير المتوقع لكل مادة لحساب المعدل الفصلي والتراكمي.</p>
        </div>
    `;

    if (!currentCoursesData || !currentCoursesData.courses || currentCoursesData.courses.length === 0) {
        gpaSection.innerHTML += '<p style="text-align:center; padding: 20px;">لا يوجد مقررات حالية مسجلة.</p>';
    } else {
        const coursesGrid = document.createElement('div');
        coursesGrid.style.display = 'grid';
        coursesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
        coursesGrid.style.gap = '15px';

        const gradeOptions = [
            { label: 'A+ (4.0)', val: 4.0 }, { label: 'A (3.7)', val: 3.7 }, { label: 'A- (3.3)', val: 3.3 },
            { label: 'B+ (3.0)', val: 3.0 }, { label: 'B (2.7)', val: 2.7 }, { label: 'B- (2.3)', val: 2.3 },
            { label: 'C+ (2.0)', val: 2.0 }, { label: 'C (1.7)', val: 1.7 }, { label: 'C- (1.3)', val: 1.3 },
            { label: 'D+ (1.0)', val: 1.0 }, { label: 'D (0.7)', val: 0.7 }, { label: 'F (0.0)', val: 0.0 }
        ].map(opt => `<option value="${opt.val}">${opt.label}</option>`).join('');

        const courseInputs = [];

        currentCoursesData.courses.forEach((course, idx) => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '10px';

            const nameEl = document.createElement('h3');
            nameEl.style.fontSize = '1.05rem';
            nameEl.style.fontWeight = '700';
            nameEl.style.margin = '0';
            nameEl.textContent = course.name;

            const flexRow = document.createElement('div');
            flexRow.style.display = 'flex';
            flexRow.style.gap = '10px';

            const hoursWrapper = document.createElement('div');
            hoursWrapper.style.flex = '1';
            hoursWrapper.innerHTML = `
                <label style="display:block; font-size: 0.85rem; margin-bottom: 4px;">الساعات</label>
                <input type="number" id="pred-hours-${idx}" value="3" min="1" max="6" style="width:100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary);">
            `;

            const gradeWrapper = document.createElement('div');
            gradeWrapper.style.flex = '2';
            gradeWrapper.innerHTML = `
                <label style="display:block; font-size: 0.85rem; margin-bottom: 4px;">التقدير المتوقع</label>
                <select id="pred-grade-${idx}" style="width:100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-secondary); color: var(--text-primary);">
                    ${gradeOptions}
                </select>
            `;

            flexRow.appendChild(hoursWrapper);
            flexRow.appendChild(gradeWrapper);
            card.appendChild(nameEl);
            card.appendChild(flexRow);
            coursesGrid.appendChild(card);
            
            courseInputs.push({ idx, name: course.name, hoursId: `pred-hours-${idx}`, gradeId: `pred-grade-${idx}` });
        });

        gpaSection.appendChild(coursesGrid);

        // Result & Calculate Action
        const actionsRow = document.createElement('div');
        actionsRow.style.marginTop = '20px';
        actionsRow.style.display = 'flex';
        actionsRow.style.flexDirection = 'column';
        actionsRow.style.gap = '15px';
        actionsRow.style.alignItems = 'center';

        const calcBtn = document.createElement('button');
        calcBtn.className = 'primary-btn';
        calcBtn.textContent = 'احسب المعدل (Calculate)';
        calcBtn.style.width = '100%';
        calcBtn.style.maxWidth = '300px';

        const resultBox = document.createElement('div');
        resultBox.style.display = 'none';
        resultBox.style.width = '100%';
        resultBox.style.padding = '15px';
        resultBox.style.borderRadius = '8px';
        resultBox.style.backgroundColor = 'var(--bg-secondary)';
        resultBox.style.border = '1px solid var(--border-color)';
        resultBox.style.textAlign = 'center';
        resultBox.style.gap = '20px';
        resultBox.style.justifyContent = 'center';

        calcBtn.addEventListener('click', () => {
            let semesterHours = 0;
            let semesterQualityPoints = 0;
            const additionalSubjects = [];

            courseInputs.forEach(input => {
                const hours = parseFloat(document.getElementById(input.hoursId).value) || 0;
                const grade = parseFloat(document.getElementById(input.gradeId).value) || 0;
                semesterHours += hours;
                semesterQualityPoints += (hours * grade);
                
                additionalSubjects.push({
                    name: input.name,
                    hours: hours,
                    points: grade
                });
            });

            const semesterGPA = semesterHours > 0 ? (semesterQualityPoints / semesterHours) : 0;
            const { cgpa } = CGPACalculator.calculate(appState.cachedGPAData, additionalSubjects);

            resultBox.style.display = 'flex';
            resultBox.innerHTML = `
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">المعدل الفصلي المتوقع</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-color);">${semesterGPA.toFixed(3)}</div>
                </div>
                <div style="border-left: 1px solid var(--border-color); margin: 0 10px;"></div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">المعدل التراكمي (CGPA) المتوقع</div>
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--gold);">${cgpa.toFixed(3)}</div>
                </div>
            `;
        });

        actionsRow.appendChild(calcBtn);
        actionsRow.appendChild(resultBox);
        gpaSection.appendChild(actionsRow);
    }
    
    // 2. Final Predictor Section
    const finalSection = document.createElement('div');
    finalSection.className = 'predictor-section';

    if (!yearWorkData || !yearWorkData.terms || yearWorkData.terms.length === 0) {
        finalSection.innerHTML = `
            <div class="predictor-info">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">توقعات درجات الفاينال</h2>
            </div>
            <p style="text-align:center; padding: 20px;">لا يوجد بيانات حالية لحساب التوقعات.</p>
        `;
    } else {
        const currentTerm = yearWorkData.terms[yearWorkData.terms.length - 1];
        
        finalSection.innerHTML = `
            <div class="predictor-info">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">توقعات الفاينال: ${currentTerm.title}</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">حساب الدرجات المطلوبة في الفاينال للوصول إلى التقديرات المختلفة (بافتراض أن المجموع الكلي 100).</p>
            </div>
        `;

        const thresholds = [
            { label: 'A+', min: 97, color: '#10B981' },
            { label: 'A', min: 93, color: '#10B981' },
            { label: 'A-', min: 89, color: '#10B981' },
            { label: 'B+', min: 84, color: '#3B82F6' },
            { label: 'B', min: 80, color: '#3B82F6' },
            { label: 'B-', min: 76, color: '#3B82F6' },
            { label: 'C+', min: 73, color: '#F59E0B' },
            { label: 'C', min: 70, color: '#F59E0B' },
            { label: 'C-', min: 67, color: '#F59E0B' },
            { label: 'D+', min: 64, color: '#EF4444' },
            { label: 'D', min: 60, color: '#EF4444' }
        ];

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
        grid.style.gap = '20px';

        currentTerm.subjects.forEach(subject => {
            let maxYearWork = 0;
            let currentScore = 0;

            subject.grades.forEach(gradeStr => {
                const match = gradeStr.match(/:\s*([\d.]+)\/([\d.]+)/);
                if (match) {
                    currentScore += parseFloat(match[1]);
                    maxYearWork += parseFloat(match[2]);
                }
            });

            const finalTotal = 100 - maxYearWork;
            
            const card = document.createElement('div');
            card.className = 'subject-card predictor-card';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            
            let predictionHTML = `<div style="flex: 1;">`;
            
            thresholds.forEach(t => {
                const needed = t.min - currentScore;
                
                if (needed <= 0) {
                    predictionHTML += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                        <span style="font-weight: 700; color: ${t.color};">${t.label}</span>
                        <span style="color: var(--text-secondary);">لقد حققت هذا التقدير!</span>
                    </div>`;
                } else if (needed <= finalTotal) {
                    predictionHTML += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                        <span style="font-weight: 700; color: ${t.color};">${t.label}</span>
                        <span style="color: var(--text-primary); font-weight: 600;">تحتاج <span style="color: ${t.color};">${needed.toFixed(1)}</span> من ${finalTotal}</span>
                    </div>`;
                } else {
                    predictionHTML += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem; opacity: 0.4;">
                        <span style="font-weight: 700;">${t.label}</span>
                        <span>مستحيل (تحتاج ${needed.toFixed(1)})</span>
                    </div>`;
                }
            });
            
            predictionHTML += `</div>`;

            card.innerHTML = `
                <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 12px;">
                    <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; border: none; padding: 0;">${subject.name}</h3>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span style="color: var(--text-secondary);">المجموع الحالي:</span>
                        <span style="font-weight: 700; color: var(--accent-color);">${currentScore.toFixed(1)} / ${maxYearWork.toFixed(1)}</span>
                    </div>
                </div>
                ${predictionHTML}
            `;
            
            grid.appendChild(card);
        });

        finalSection.appendChild(grid);
    }
    
    wrapper.appendChild(finalSection);

    // Separator
    const sep = document.createElement('hr');
    sep.style.border = 'none';
    sep.style.borderTop = '1px solid var(--border-color)';
    wrapper.appendChild(sep);

    wrapper.appendChild(gpaSection);
    container.appendChild(wrapper);
};
