export const renderYearWorkGrades = (containerId, data) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (!data || !data.terms || data.terms.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px;">لا توجد درجات متاحة لهذا العام الأكاديمي.</p>';
        return;
    }

    data.terms.forEach(term => {
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
            
            let gradesHtml = '<ul class="subject-grades">';
            subject.grades.forEach(grade => {
                gradesHtml += `
                    <li>
                        <span class="grade-label">-</span>
                        <span class="grade-value">${grade}</span>
                    </li>
                `;
            });
            gradesHtml += '</ul>';

            card.innerHTML = `
                <h3>${subject.name}</h3>
                ${gradesHtml}
            `;
            content.appendChild(card);
        });

        header.addEventListener('click', () => {
            section.classList.toggle('collapsed');
        });

        section.appendChild(header);
        section.appendChild(content);
        container.appendChild(section);
    });
};
