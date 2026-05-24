export const renderPredictor = (containerId, data) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!data || !data.terms || data.terms.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">لا يوجد بيانات حالية لحساب التوقعات.</p>';
        return;
    }

    // Use the last term as the "current" semester
    const currentTerm = data.terms[data.terms.length - 1];
    
    const infoHeader = document.createElement('div');
    infoHeader.className = 'predictor-info';
    infoHeader.innerHTML = `
        <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">توقعات نهاية الفصل الدراسي: ${currentTerm.title}</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">حساب الدرجات المطلوبة في الفاينال للوصول إلى التقديرات المختلفة (بافتراض أن المجموع الكلي 100).</p>
    `;
    container.appendChild(infoHeader);

    const thresholds = [
        { label: 'A+', min: 97, color: '#10B981' }, // Emerald
        { label: 'A', min: 93, color: '#10B981' },
        { label: 'A-', min: 89, color: '#10B981' },
        { label: 'B+', min: 84, color: '#3B82F6' }, // Blue
        { label: 'B', min: 80, color: '#3B82F6' },
        { label: 'B-', min: 76, color: '#3B82F6' },
        { label: 'C+', min: 73, color: '#F59E0B' }, // Amber
        { label: 'C', min: 70, color: '#F59E0B' },
        { label: 'C-', min: 67, color: '#F59E0B' },
        { label: 'D+', min: 64, color: '#EF4444' }, // Red
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

        // Assume total subject score is 100
        const finalTotal = 100 - maxYearWork;
        
        const card = document.createElement('div');
        card.className = 'subject-card predictor-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        
        let predictionHTML = `<div style="flex: 1;">`;
        
        // Find requirements
        let hasPossibility = false;
        
        thresholds.forEach(t => {
            const needed = t.min - currentScore;
            
            if (needed <= 0) {
                // Already achieved!
                predictionHTML += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                    <span style="font-weight: 700; color: ${t.color};">${t.label}</span>
                    <span style="color: var(--text-secondary);">لقد حققت هذا التقدير!</span>
                </div>`;
                hasPossibility = true;
            } else if (needed <= finalTotal) {
                // Possible
                predictionHTML += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed var(--border-color); font-size: 0.85rem;">
                    <span style="font-weight: 700; color: ${t.color};">${t.label}</span>
                    <span style="color: var(--text-primary); font-weight: 600;">تحتاج <span style="color: ${t.color};">${needed.toFixed(1)}</span> من ${finalTotal}</span>
                </div>`;
                hasPossibility = true;
            } else {
                // Impossible
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

    container.appendChild(grid);
};
