export const renderGPA = (containerId, data, onSubjectOpen) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!data || !data.years || data.years.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">لا يوجد سجل أكاديمي متاح حالياً.</p>';
        return;
    }

    // --- Calculate Overall GPA ---
    let totalPoints = 0;
    let totalHours = 0;

    data.years.forEach(year => {
        year.terms.forEach(term => {
            term.subjects.forEach(subject => {
                const name = subject.name || "";
                const pointsStr = subject.points || "";
                const hoursStr = subject.hours || "0";
                
                // Exclude rules based on user request
                if (name.includes("التدريب الصيفي")) return;
                if (pointsStr === "" || pointsStr === "لا يوجد") return;
                
                const points = parseFloat(pointsStr);
                const hours = parseFloat(hoursStr);
                
                if (!isNaN(points) && !isNaN(hours)) {
                    totalPoints += (points * hours);
                    totalHours += hours;
                }
            });
        });
    });

    const overallGPA = totalHours > 0 ? (totalPoints / totalHours).toFixed(3) : "N/A";

    const gpaWidget = document.createElement('div');
    gpaWidget.className = 'gpa-metric-card';
    gpaWidget.innerHTML = `
        <div class="metric-content">
            <div class="metric-label">المعدل التراكمي العام (Overall GPA)</div>
            <div class="metric-value">${overallGPA}</div>
            <div class="metric-subtext">مجموع الساعات المحتسبة: <strong>${totalHours}</strong> ساعة</div>
        </div>
        <div class="metric-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
            </svg>
        </div>
    `;
    container.appendChild(gpaWidget);

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

            const header = document.createElement('div');
            header.className = 'term-header';
            header.innerHTML = `
                <h2>${term.title}</h2>
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
                
                card.innerHTML = `
                    <h3>${subject.name}${openBtn}</h3>
                    <ul class="subject-grades">
                        <li><span class="grade-label">ساعات المقرر:</span> <span class="grade-value">${subject.hours}</span></li>
                        <li><span class="grade-label">التقدير:</span> <span class="grade-value">${subject.grade}</span></li>
                        <li><span class="grade-label">النقاط:</span> <span class="grade-value">${subject.points}</span></li>
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
