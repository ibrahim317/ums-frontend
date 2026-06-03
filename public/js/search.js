// search.js - Subject Search Module
// Fuzzy search across year work and GPA data with subject detail views

// --- Arabic Text Normalization ---
const cleanSubjectName = (name) => {
    return (name || '')
        .replace(/^\[[^\]]+\]\s*/, '')
        .trim();
};

const normalizeArabic = (text) => {
    return cleanSubjectName(text)
        .replace(/[\u0610-\u061A\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizeTermTitle = (title) => {
    if (!title) return '';
    if (title.includes('الخريف')) return 'فصل الخريف';
    if (title.includes('الربيع')) return 'فصل الربيع';
    if (title.includes('الصيف')) return 'فصل الصيف';
    if (title.includes('الأول') || title.includes('الاول')) return 'الفصل الدراسي الأول';
    if (title.includes('الثاني') || title.includes('الثاني')) return 'الفصل الدراسي الثاني';
    return title.replace(/\[.*\]/g, '').trim();
};

const getGradeRange = (grade) => {
    const g = (grade || '').trim().toUpperCase();
    if (g === 'A+' || g.includes('امتياز مرتفع') || g.includes('امتياز اول')) return { min: 97, max: 100 };
    if (g === 'A' || g.includes('امتياز')) return { min: 93, max: 96.9 };
    if (g === 'A-' || g.includes('امتياز منخفض')) return { min: 89, max: 92.9 };
    if (g === 'B+' || g.includes('جيد جدا مرتفع') || g.includes('جيد جداً مرتفع')) return { min: 84, max: 88.9 };
    if (g === 'B' || g.includes('جيد جدا') || g.includes('جيد جداً')) return { min: 80, max: 83.9 };
    if (g === 'B-' || g.includes('جيد جدا منخفض') || g.includes('جيد جداً منخفض')) return { min: 76, max: 79.9 };
    if (g === 'C+' || g.includes('جيد مرتفع')) return { min: 73, max: 75.9 };
    if (g === 'C' || g.includes('جيد')) return { min: 70, max: 72.9 };
    if (g === 'C-' || g.includes('جيد منخفض')) return { min: 67, max: 69.9 };
    if (g === 'D+' || g.includes('مقبول مرتفع')) return { min: 64, max: 66.9 };
    if (g === 'D' || g.includes('مقبول')) return { min: 60, max: 63.9 };
    if (g === 'F' || g === 'E' || g.includes('راسب')) return { min: 0, max: 59.9 };
    return null;
};

// --- Fuzzy Matching ---
const fuzzyScore = (query, text) => {
    const q = normalizeArabic(query);
    const t = normalizeArabic(text);
    if (!q) return 0;

    // Exact substring = highest score
    if (t.includes(q)) return 1000 + (q.length / t.length) * 100;

    // Subsequence match with consecutive bonus
    let qi = 0, consecutive = 0, score = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            consecutive++;
            score += consecutive * 10;
            qi++;
        } else {
            consecutive = 0;
        }
    }
    return qi === q.length ? score : 0;
};

// --- State ---
let searchIndex = [];
let gpaData = null;
let yearWorkEntries = []; // [{ yearLabel, data }]
let overlay = null;
let searchUnlocked = false;
let onUnlockCallback = null;
let openedFromCard = false;

// --- Index Building ---
export const setGPAData = (data) => {
    gpaData = data;
    rebuildIndex();
};

export const addYearWorkData = (yearLabel, data) => {
    if (!yearLabel || !data) return;
    const idx = yearWorkEntries.findIndex(e => e.yearLabel === yearLabel);
    if (idx >= 0) yearWorkEntries[idx] = { yearLabel, data };
    else yearWorkEntries.push({ yearLabel, data });
    rebuildIndex();
};

const rebuildIndex = () => {
    const subjectMap = new Map();

    const getOrCreate = (name) => {
        const cleanName = cleanSubjectName(name);
        const norm = normalizeArabic(name);
        if (!subjectMap.has(norm)) {
            subjectMap.set(norm, { displayName: cleanName, occurrences: new Map() });
        }
        return subjectMap.get(norm);
    };

    // Process GPA data (all years)
    if (gpaData?.years) {
        gpaData.years.forEach(year => {
            year.terms.forEach(term => {
                const normTerm = normalizeTermTitle(term.title);
                term.subjects.forEach(subject => {
                    const entry = getOrCreate(subject.name);
                    const key = `${year.year}||${normTerm}`;
                    const existing = entry.occurrences.get(key) || {
                        yearLabel: year.year, termTitle: normTerm,
                        yearWorkGrades: null, gpaInfo: null
                    };
                    existing.gpaInfo = {
                        grade: subject.grade,
                        points: subject.points,
                        hours: subject.hours
                    };
                    entry.occurrences.set(key, existing);
                });
            });
        });
    }

    // Process year work data
    yearWorkEntries.forEach(({ yearLabel, data }) => {
        if (!data?.terms) return;
        data.terms.forEach(term => {
            const normTerm = normalizeTermTitle(term.title);
            term.subjects.forEach(subject => {
                const entry = getOrCreate(subject.name);
                const key = `${yearLabel}||${normTerm}`;
                const existing = entry.occurrences.get(key) || {
                    yearLabel, termTitle: normTerm,
                    yearWorkGrades: null, gpaInfo: null
                };
                existing.yearWorkGrades = subject.grades;
                entry.occurrences.set(key, existing);
            });
        });
    });

    // Flatten to sorted array
    searchIndex = [];
    subjectMap.forEach((value, normalizedName) => {
        const occurrences = [...value.occurrences.values()];
        occurrences.sort((a, b) => b.yearLabel.localeCompare(a.yearLabel));
        searchIndex.push({ displayName: value.displayName, normalizedName, occurrences });
    });
};

// --- Search ---
const searchQuery = (query) => {
    if (!query || !query.trim()) return searchIndex.slice(0, 30);
    return searchIndex
        .map(item => ({ ...item, score: fuzzyScore(query, item.displayName) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
};

// --- UI Rendering ---
const renderResults = (query) => {
    const results = searchQuery(query);
    const container = document.getElementById('search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = `<div class="search-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <p>لا توجد نتائج</p>
        </div>`;
        return;
    }

    container.innerHTML = '';
    results.forEach(item => {
        const el = document.createElement('button');
        el.className = 'search-result-item';
        const count = item.occurrences.length;
        el.innerHTML = `
            <div class="search-result-name">${item.displayName}</div>
            <div class="search-result-meta">${count} ${count > 1 ? 'فصول' : 'فصل'}</div>
            <svg class="search-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
        `;
        el.addEventListener('click', () => showDetail(item));
        container.appendChild(el);
    });
};

const showDetail = (item) => {
    if (typeof item === 'string') {
        const norm = normalizeArabic(item);
        item = searchIndex.find(i => i.normalizedName === norm);
        if (!item) return;
    }

    const detail = document.getElementById('search-detail');
    const results = document.getElementById('search-results');
    if (!detail || !results) return;

    results.classList.add('hidden');
    detail.classList.remove('hidden');

    // Group by year
    const byYear = new Map();
    item.occurrences.forEach(occ => {
        if (!byYear.has(occ.yearLabel)) byYear.set(occ.yearLabel, []);
        byYear.get(occ.yearLabel).push(occ);
    });

    let html = `<h2 class="search-detail-title">${item.displayName}</h2>`;

    byYear.forEach((terms, yearLabel) => {
        html += `<div class="search-detail-year">
            <div class="search-detail-year-label">${yearLabel}</div>`;

        terms.forEach(occ => {
            html += `<div class="search-detail-term">
                <div class="search-detail-term-title">${occ.termTitle}</div>`;

            if (occ.yearWorkGrades?.length) {
                html += `<div class="search-detail-section">
                    <div class="search-detail-section-label">أعمال السنة</div>
                    <ul class="subject-grades">`;
                occ.yearWorkGrades.forEach(g => {
                    html += `<li><span class="grade-label">-</span><span class="grade-value">${g}</span></li>`;
                });
                html += `</ul></div>`;
            }

            if (occ.gpaInfo) {
                let finalEstimateHtml = '';
                let ywSum = 0;
                let ywMax = 0;
                let hasYearWork = false;
                
                if (occ.yearWorkGrades?.length) {
                    occ.yearWorkGrades.forEach(gradeStr => {
                        const match = gradeStr.match(/:\s*([\d.]+)\/([\d.]+)/);
                        if (match) {
                            ywSum += parseFloat(match[1]);
                            ywMax += parseFloat(match[2]);
                            hasYearWork = true;
                        }
                    });
                }

                if (hasYearWork && occ.gpaInfo.grade) {
                    const range = getGradeRange(occ.gpaInfo.grade);
                    if (range) {
                        const finalMaxPossible = 100 - ywMax;
                        let minFinal = Math.max(0, range.min - ywSum);
                        let maxFinal = Math.min(finalMaxPossible, range.max - ywSum);
                        
                        if (minFinal > finalMaxPossible) minFinal = finalMaxPossible;
                        if (maxFinal < 0) maxFinal = 0;
                        
                        if (minFinal <= maxFinal) {
                            finalEstimateHtml = `<li><span class="grade-label">الفاينال التقديري:</span><span class="grade-value" style="color:var(--accent-color); font-weight:700;">${minFinal.toFixed(1)} - ${maxFinal.toFixed(1)} / ${finalMaxPossible.toFixed(1)}</span></li>`;
                        }
                    }
                }

                html += `<div class="search-detail-section">
                    <div class="search-detail-section-label">الدرجة النهائية</div>
                    <ul class="subject-grades">
                        <li><span class="grade-label">ساعات المقرر:</span><span class="grade-value">${occ.gpaInfo.hours}</span></li>
                        <li><span class="grade-label">التقدير:</span><span class="grade-value">${occ.gpaInfo.grade}</span></li>
                        <li><span class="grade-label">النقاط:</span><span class="grade-value">${occ.gpaInfo.points}</span></li>
                        ${finalEstimateHtml}
                    </ul>
                </div>`;
            }

            if (!occ.yearWorkGrades && !occ.gpaInfo) {
                html += `<p style="text-align:center; color:var(--text-secondary); padding:12px;">لا توجد بيانات متاحة</p>`;
            }

            html += `</div>`;
        });
        html += `</div>`;
    });

    detail.innerHTML = html;
};

// --- Public API ---
export const setSearchUnlocked = (unlocked) => {
    searchUnlocked = unlocked;
    const banner = document.getElementById('search-lock-banner');
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    
    if (!banner || !input) return;
    
    if (unlocked) {
        banner.classList.add('hidden');
        input.disabled = false;
        input.placeholder = "ابحث عن مادة...";
        if (results) results.classList.remove('hidden');
    } else {
        banner.classList.remove('hidden');
        input.disabled = true;
        input.placeholder = "يرجى تفعيل المزامنة للبحث...";
        if (results) results.classList.add('hidden');
    }
};

export const setSearchSyncing = (syncing) => {
    const btn = document.getElementById('search-unlock-btn');
    if (!btn) return;
    if (syncing) {
        btn.disabled = true;
        btn.innerHTML = `<span class="btn-loader" style="margin: 0; display: inline-block; vertical-align: middle;"></span> جاري المزامنة...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = `مزامنة وتفعيل`;
    }
};

export const initSearch = (onUnlockRequested) => {
    onUnlockCallback = onUnlockRequested;
    overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'search-overlay hidden';
    overlay.innerHTML = `
        <div class="search-header">
            <button class="search-back-btn" id="search-back-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>
            <div class="search-input-wrapper">
                <svg class="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="search-input" class="search-input" placeholder="ابحث عن مادة..." autocomplete="off" />
            </div>
        </div>
        <div class="search-body" id="search-body">
            <div class="search-lock-banner hidden" id="search-lock-banner">
                <div class="search-lock-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <div class="search-lock-text">
                    <h3>البحث الشامل مغلق</h3>
                    <p>لتفعيل البحث في جميع السنوات الأكاديمية السابقة، يرجى مزامنة البيانات أولاً.</p>
                </div>
                <button class="search-unlock-btn" id="search-unlock-btn">مزامنة وتفعيل</button>
            </div>
            <div class="search-results" id="search-results"></div>
            <div class="search-detail hidden" id="search-detail"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('search-input').addEventListener('input', (e) => renderResults(e.target.value));
    document.getElementById('search-back-btn').addEventListener('click', () => {
        closeSearch();
    });

    const unlockBtn = document.getElementById('search-unlock-btn');
    if (unlockBtn) {
        unlockBtn.addEventListener('click', () => {
            if (onUnlockCallback) onUnlockCallback();
        });
    }
};

export const openSearch = () => {
    if (!overlay) return;
    openedFromCard = false;
    overlay.classList.remove('hidden');
    const input = document.getElementById('search-input');
    input.value = '';
    
    // Apply lock state on opening
    setSearchUnlocked(searchUnlocked);
    if (searchUnlocked) {
        input.focus();
    }
    
    document.getElementById('search-results').classList.remove('hidden');
    document.getElementById('search-detail').classList.add('hidden');
    renderResults('');
    document.body.style.overflow = 'hidden';
};

export const closeSearch = () => {
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
};

export const openSubjectByName = (name) => {
    if (!overlay) return;
    openedFromCard = true;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.getElementById('search-input').value = cleanSubjectName(name);
    document.getElementById('search-results').classList.add('hidden');
    document.getElementById('search-detail').classList.remove('hidden');
    showDetail(name);
};

export const clearSearchData = () => {
    gpaData = null;
    yearWorkEntries = [];
    searchIndex = [];
};
