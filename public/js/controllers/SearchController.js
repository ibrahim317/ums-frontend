import { getPointsFromGrade } from '../components/GPARenderer.js';
import { TextNormalizer } from '../utils/TextNormalizer.js';
import { appState } from '../services/AppState.js';

/**
 * SearchController - Controls the search modal overlay rendering, processes
 * search keyboard input filters, and displays detailed grade comparisons/predictions.
 */
export class SearchController {
    constructor(searchService, onUnlockRequested) {
        this.searchService = searchService;
        this.onUnlockRequested = onUnlockRequested;
        this.overlay = null;
        this.openedFromCard = false;
    }

    /**
     * Creates and appends search overlay modal HTML to document.body, then binds keyup and clicks.
     */
    init() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'search-overlay';
        this.overlay.className = 'search-overlay hidden';
        this.overlay.innerHTML = `
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
        document.body.appendChild(this.overlay);

        const input = document.getElementById('search-input');
        if (input) {
            input.addEventListener('input', (e) => this.renderResults(e.target.value));
        }

        const backBtn = document.getElementById('search-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeSearch());
        }

        const unlockBtn = document.getElementById('search-unlock-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                if (this.onUnlockRequested) this.onUnlockRequested();
            });
        }
    }

    /**
     * Controls lock/unlock visual states of the search interface.
     */
    setSearchUnlocked(unlocked) {
        appState.searchUnlocked = unlocked;
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
    }

    /**
     * Toggles lock/unlock button loading spinners during data synchronization.
     */
    setSearchSyncing(syncing) {
        const btn = document.getElementById('search-unlock-btn');
        if (!btn) return;
        if (syncing) {
            btn.disabled = true;
            btn.innerHTML = `<span class="btn-loader" style="margin: 0; display: inline-block; vertical-align: middle;"></span> جاري المزامنة...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `مزامنة وتفعيل`;
        }
    }

    /**
     * Opens search view overlay and clears input.
     */
    openSearch() {
        if (!this.overlay) return;
        this.openedFromCard = false;
        this.overlay.classList.remove('hidden');
        const input = document.getElementById('search-input');
        if (input) {
            input.value = '';

            this.setSearchUnlocked(appState.searchUnlocked);
            if (appState.searchUnlocked) {
                input.focus();
            }
        }

        const results = document.getElementById('search-results');
        const detail = document.getElementById('search-detail');
        if (results) results.classList.remove('hidden');
        if (detail) detail.classList.add('hidden');
        this.renderResults('');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Closes search view overlay.
     */
    closeSearch() {
        if (!this.overlay) return;
        this.overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * Deep-links to subject detail card directly (e.g. when clicking subject cards from GPA tab).
     */
    openSubjectByName(name) {
        if (!this.overlay) return;
        this.openedFromCard = true;
        this.overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        const input = document.getElementById('search-input');
        if (input) {
            input.value = TextNormalizer.cleanSubjectName(name);
        }

        const results = document.getElementById('search-results');
        const detail = document.getElementById('search-detail');
        if (results) results.classList.add('hidden');
        if (detail) detail.classList.remove('hidden');
        this.showDetail(name);
    }

    /**
     * Clear search indexed entries.
     */
    clearSearch() {
        this.searchService.setGPAData(null);
        appState.yearWorkEntries = [];
        appState.searchIndex = [];
        appState.currentYearWorkGrades = null;
        appState.currentYearWorkLabel = '';
    }

    /**
     * Renders filtered list of subject entries matching typed input.
     */
    renderResults(query) {
        const results = this.searchService.searchQuery(query);
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
            el.addEventListener('click', () => this.showDetail(item));
            container.appendChild(el);
        });
    }

    /**
     * Renders the details drawer of occurrences, predictive grades, and final estimates.
     */
    showDetail(item) {
        if (typeof item === 'string') {
            const norm = TextNormalizer.normalizeArabic(item);
            item = appState.searchIndex.find(i => i.normalizedName === norm);
            if (!item) return;
        }

        const detail = document.getElementById('search-detail');
        const results = document.getElementById('search-results');
        if (!detail || !results) return;

        results.classList.add('hidden');
        detail.classList.remove('hidden');

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

                // Predictions logic
                let predictorSubject = null;
                if (appState.currentYearWorkGrades && appState.currentYearWorkGrades.terms && appState.currentYearWorkGrades.terms.length > 0) {
                    const currentTerm = appState.currentYearWorkGrades.terms[appState.currentYearWorkGrades.terms.length - 1];
                    const currentTermNorm = TextNormalizer.normalizeTermTitle(currentTerm.title);

                    if (yearLabel === appState.currentYearWorkLabel && occ.termTitle === currentTermNorm) {
                        const targetNormName = TextNormalizer.normalizeArabic(item.displayName);
                        predictorSubject = currentTerm.subjects.find(sub => TextNormalizer.normalizeArabic(sub.name) === targetNormName);
                    }
                }

                if (predictorSubject) {
                    let maxYearWork = 0;
                    let currentScore = 0;

                    predictorSubject.grades.forEach(gradeStr => {
                        const match = gradeStr.match(/:\s*([\d.]+)\/([\d.]+)/);
                        if (match) {
                            currentScore += parseFloat(match[1]);
                            maxYearWork += parseFloat(match[2]);
                        }
                    });

                    const finalTotal = 100 - maxYearWork;

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

                    let predictionHTML = `<div class="search-detail-section" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                        <div class="search-detail-section-label">توقعات نهاية الفصل الدراسي</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                            المجموع الحالي: <span style="font-weight: 700; color: var(--accent-color);">${currentScore.toFixed(1)} / ${maxYearWork.toFixed(1)}</span>
                        </div>
                        <ul class="subject-grades">`;

                    thresholds.forEach(t => {
                        const needed = t.min - currentScore;
                        if (needed <= 0) {
                            predictionHTML += `<li>
                                <span class="grade-label" style="font-weight: 700; color: ${t.color};">${t.label}:</span>
                                <span class="grade-value" style="color: ${t.color};">لقد حققت هذا التقدير!</span>
                            </li>`;
                        } else if (needed <= finalTotal) {
                            predictionHTML += `<li>
                                <span class="grade-label" style="font-weight: 700; color: ${t.color};">${t.label}:</span>
                                <span class="grade-value" style="color: var(--text-primary);">تحتاج <span style="color: ${t.color}; font-weight: 700;">${needed.toFixed(1)}</span> من ${finalTotal}</span>
                            </li>`;
                        } else {
                            predictionHTML += `<li style="opacity: 0.4;">
                                <span class="grade-label" style="font-weight: 700;">${t.label}:</span>
                                <span class="grade-value">مستحيل (تحتاج ${needed.toFixed(1)})</span>
                            </li>`;
                        }
                    });

                    predictionHTML += `</ul></div>`;
                    html += predictionHTML;
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
                        const range = TextNormalizer.getGradeRange(occ.gpaInfo.grade);
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

                    let displayedPoints = occ.gpaInfo.points;
                    if (!displayedPoints || displayedPoints === "لا يوجد" || isNaN(parseFloat(displayedPoints))) {
                        const derived = getPointsFromGrade(occ.gpaInfo.grade);
                        if (derived !== null) {
                            displayedPoints = `${derived} (تقديري)`;
                        }
                    }

                    html += `<div class="search-detail-section">
                        <div class="search-detail-section-label">الدرجة النهائية</div>
                        <ul class="subject-grades">
                            <li><span class="grade-label">ساعات المقرر:</span><span class="grade-value">${occ.gpaInfo.hours}</span></li>
                            <li><span class="grade-label">التقدير:</span><span class="grade-value">${occ.gpaInfo.grade}</span></li>
                            <li><span class="grade-label">النقاط:</span><span class="grade-value">${displayedPoints}</span></li>
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
    }
}
