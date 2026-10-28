import { fetchQuestionnaires, fetchQuestionnaireForm, submitQuestionnaireAPI } from '../api.js';

const getBlockHost = (containerId, hasCachedData) => {
    const parent = document.getElementById(containerId);
    if (!parent) return null;
    if (!hasCachedData) {
        parent.innerHTML = '';
        return parent;
    }
    const hostId = `${containerId}-block-host`;
    let host = document.getElementById(hostId);
    if (!host) {
        host = document.createElement('div');
        host.id = hostId;
        host.style.marginBottom = '24px';
        parent.prepend(host);
    }
    return host;
};

/**
 * Renders the blocked-by-questionnaires state inside a grades/GPA/predictor container,
 * allowing the user to view pending questionnaires from /Questionnaires and solve them inline.
 *
 * @param {string} containerId - Target DOM container ID
 * @param {Array|null} initialQuestionnaires - Pre-fetched list of questionnaires (optional)
 * @param {Object} options - { onAllCompleted: Function, hasCachedData: boolean }
 */
export const renderQuestionnaireBlock = async (containerId, initialQuestionnaires = null, options = {}) => {
    const { onAllCompleted, hasCachedData = false } = options;
    const container = getBlockHost(containerId, hasCachedData);
    if (!container) return;

    const renderListState = async (questionnairesList = null, statusBanner = null) => {
        container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'questionnaire-block-wrapper';

        // Header / Alert Banner
        const banner = document.createElement('div');
        banner.className = 'questionnaire-alert-card';
        banner.innerHTML = `
            <div class="questionnaire-alert-header">
                <div class="questionnaire-alert-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        <path d="M9 14l2 2 4-4"></path>
                    </svg>
                </div>
                <div class="questionnaire-alert-text">
                    <h3>${hasCachedData ? 'تحديث الدرجات متوقف لحين استكمال الاستبيانات' : 'الدرجات محجوبة لحين استكمال الاستبيانات'}</h3>
                    <p>${hasCachedData
                        ? 'يتم عرض آخر بيانات محفوظة لديك بالأسفل. لتحديث الدرجات الجديدة من نظام UMS الرسمي، يتطلب النظام حل الاستبيانات التالية أولاً.'
                        : 'يتطلب نظام UMS الرسمي حل جميع الاستبيانات التالية أولاً حتى يتم إظهار الدرجات والسجل الأكاديمي.'}</p>
                </div>
            </div>
            <div class="questionnaire-alert-actions">
                <button type="button" class="secondary-btn sm-btn" id="${containerId}-refresh-q-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    تحديث القائمة / التحقق من الدرجات
                </button>
            </div>
        `;
        wrapper.appendChild(banner);

        if (statusBanner) {
            const toast = document.createElement('div');
            toast.className = `questionnaire-status-banner ${statusBanner.type === 'success' ? 'status-success' : 'status-error'}`;
            toast.textContent = statusBanner.message;
            wrapper.appendChild(toast);
        }

        const listContainer = document.createElement('div');
        listContainer.className = 'questionnaire-list-container';
        wrapper.appendChild(listContainer);
        container.appendChild(wrapper);

        const refreshBtn = document.getElementById(`${containerId}-refresh-q-btn`);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                listContainer.innerHTML = `
                    <div class="loader-container" style="padding: 24px 0;">
                        <div class="spinner"></div>
                        <p>جاري التحقق من الاستبيانات المتبقية...</p>
                    </div>
                `;
                try {
                    const res = await fetchQuestionnaires();
                    const json = await res.json();
                    const list = json.data?.questionnaires || [];
                    if (list.length === 0 && typeof onAllCompleted === 'function') {
                        await onAllCompleted();
                        return;
                    }
                    await renderListState(list);
                } catch (err) {
                    await renderListState([], { type: 'error', message: err.message || 'تعذر تحديث قائمة الاستبيانات.' });
                }
            });
        }

        // Fetch questionnaires if not provided
        let items = questionnairesList;
        if (!Array.isArray(items)) {
            listContainer.innerHTML = `
                <div class="loader-container" style="padding: 24px 0;">
                    <div class="spinner"></div>
                    <p>جاري جلب قائمة الاستبيانات المطلوبة...</p>
                </div>
            `;
            try {
                const res = await fetchQuestionnaires();
                const json = await res.json();
                items = json.data?.questionnaires || [];
            } catch (e) {
                items = [];
            }
        }

        if (!items || items.length === 0) {
            listContainer.innerHTML = `
                <div class="subject-card" style="text-align: center; padding: 24px;">
                    <p style="color: var(--text-secondary); margin-bottom: 14px;">لا توجد استبيانات متبقية حالياً. يمكنك الآن إعادة تحميل الدرجات.</p>
                    <button type="button" class="primary-btn" id="${containerId}-reload-grades-btn" style="max-width: 240px; margin: 0 auto;">
                        إظهار الدرجات الآن
                    </button>
                </div>
            `;
            const reloadBtn = document.getElementById(`${containerId}-reload-grades-btn`);
            if (reloadBtn && typeof onAllCompleted === 'function') {
                reloadBtn.addEventListener('click', () => onAllCompleted());
            }
            return;
        }

        listContainer.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'questionnaire-cards-grid';

        items.forEach((q) => {
            const card = document.createElement('div');
            card.className = 'subject-card questionnaire-item-card';
            card.innerHTML = `
                <div class="questionnaire-item-top">
                    <span class="term-badge questionnaire-cat-badge">${q.category || 'استبيان'}</span>
                    <h3 class="questionnaire-item-title">${q.title}</h3>
                </div>
                <button type="button" class="primary-btn questionnaire-solve-btn">
                    <span>حل الإستبيان</span>
                </button>
            `;

            const solveBtn = card.querySelector('.questionnaire-solve-btn');
            solveBtn.addEventListener('click', async () => {
                solveBtn.disabled = true;
                solveBtn.innerHTML = `<div class="btn-loader"></div><span>جاري فتح الاستبيان...</span>`;
                try {
                    const res = await fetchQuestionnaireForm(q.url || q.id);
                    const json = await res.json();
                    if (!json.success || !json.data) {
                        throw new Error(json.error || 'تعذر تحميل نموذج الاستبيان.');
                    }
                    renderFormState(json.data, items);
                } catch (err) {
                    solveBtn.disabled = false;
                    solveBtn.innerHTML = `<span>حل الإستبيان</span>`;
                    renderListState(items, { type: 'error', message: err.message || 'حدث خطأ أثناء تحميل الاستبيان.' });
                }
            });

            grid.appendChild(card);
        });

        listContainer.appendChild(grid);
    };

    const renderFormState = (formData, currentList) => {
        container.innerHTML = '';

        // State map: key -> { QuestionId, AnswerType, AnswerText, InstructorId, TAId }
        const answersMap = new Map();
        const getAnswerKey = (q) => `${q.questionId}_${q.instructorId ?? 'null'}_${q.taId ?? 'null'}`;

        const setAnswer = (q, answerText) => {
            const key = getAnswerKey(q);
            if (answerText === null || answerText === undefined || (q.inputType === 'textarea' && String(answerText).trim() === '' && !q.mandatory)) {
                answersMap.delete(key);
                return;
            }
            answersMap.set(key, {
                QuestionId: Number(q.questionId),
                AnswerType: Number(q.answerType),
                AnswerText: String(answerText),
                InstructorId: q.instructorId ?? null,
                TAId: q.taId ?? null
            });
        };

        const wrapper = document.createElement('div');
        wrapper.className = 'questionnaire-form-wrapper';

        // Top Navigation & Title Header
        const headerCard = document.createElement('div');
        headerCard.className = 'subject-card questionnaire-form-header';
        headerCard.innerHTML = `
            <div class="questionnaire-form-nav">
                <button type="button" class="secondary-btn sm-btn" id="${containerId}-back-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                    العودة لقائمة الاستبيانات
                </button>
                <span class="term-badge">رقم الاستبيان: #${formData.questionnaireId || ''}</span>
            </div>
            <h2 class="questionnaire-form-title">${formData.title}</h2>
            <input type="hidden" name="__RequestVerificationToken" value="${formData.requestVerificationToken || ''}">
        `;
        wrapper.appendChild(headerCard);

        const backBtn = headerCard.querySelector(`#${containerId}-back-btn`);
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                renderListState(currentList);
            });
        }

        // Keep references to question DOM updaters for one-tap select all
        const sectionElementUpdaters = new Map();
        const questionCardElements = new Map();

        (formData.sections || []).forEach((section, sIdx) => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'term-section questionnaire-section';

            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'questionnaire-section-header';

            const headerTop = document.createElement('div');
            headerTop.className = 'questionnaire-section-title-row';
            headerTop.innerHTML = `
                <h2>${section.title}</h2>
                <span class="term-badge">${section.questions.length} سؤال</span>
            `;
            sectionHeader.appendChild(headerTop);

            // Check if section has rating questions (بنود التقييم / answerType === 2)
            const ratingQuestions = section.questions.filter(
                (q) => q.answerType === 2 || (q.inputType === 'radio' && q.options.length === 5 && q.options.every((o, i) => o.value === String(i + 1)))
            );

            if (section.isEvaluationSection || ratingQuestions.length > 0) {
                const ratingValues = ratingQuestions[0]?.options?.map((o) => ({ value: o.value, label: o.label })) || [
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '3', label: '3' },
                    { value: '4', label: '4' },
                    { value: '5', label: '5' }
                ];

                const selectAllBar = document.createElement('div');
                selectAllBar.className = 'questionnaire-select-all-bar';
                selectAllBar.innerHTML = `
                    <div class="select-all-label">
                        <strong>تحديد الكل بنقرة واحدة (${section.title}):</strong>
                        <span>اختر تقييماً لتطبيقه على جميع البنود، ويمكنك تعديل أي بند منفرداً بعد ذلك</span>
                    </div>
                    <div class="select-all-buttons"></div>
                `;

                const btnsContainer = selectAllBar.querySelector('.select-all-buttons');
                const bulkBtns = [];

                ratingValues.forEach((opt) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'rating-pill-btn bulk-rating-btn';
                    btn.dataset.val = opt.value;
                    btn.textContent = opt.label;

                    btn.addEventListener('click', () => {
                        bulkBtns.forEach((b) => b.classList.remove('active'));
                        btn.classList.add('active');

                        const updaters = sectionElementUpdaters.get(sIdx) || [];
                        updaters.forEach((updateFn) => updateFn(opt.value));
                    });

                    bulkBtns.push(btn);
                    btnsContainer.appendChild(btn);
                });

                sectionHeader.appendChild(selectAllBar);
            }

            sectionEl.appendChild(sectionHeader);

            const questionsListEl = document.createElement('div');
            questionsListEl.className = 'questionnaire-questions-list';
            const updatersForSection = [];

            section.questions.forEach((q) => {
                const qCard = document.createElement('div');
                qCard.className = 'subject-card questionnaire-question-card';
                qCard.dataset.questionId = q.questionId;
                questionCardElements.set(q.questionId, qCard);

                const qHeader = document.createElement('div');
                qHeader.className = 'questionnaire-question-title';
                qHeader.innerHTML = `
                    <span>${q.text}</span>
                    ${q.mandatory ? '<span class="mandatory-star" title="سؤال إجباري">*</span>' : '<span class="optional-badge">اختياري</span>'}
                `;
                qCard.appendChild(qHeader);

                const controlsWrap = document.createElement('div');
                controlsWrap.className = 'questionnaire-question-controls';

                const isRatingQuestion = q.answerType === 2 || (q.inputType === 'radio' && q.options.length === 5 && q.options.every((o, i) => o.value === String(i + 1)));

                if (q.inputType === 'textarea') {
                    const textarea = document.createElement('textarea');
                    textarea.className = 'questionnaire-textarea';
                    textarea.rows = 3;
                    textarea.placeholder = 'اكتب آراءك أو ملاحظاتك هنا...';
                    textarea.addEventListener('input', (e) => {
                        setAnswer(q, e.target.value);
                        qCard.classList.remove('questionnaire-question-missing');
                    });
                    controlsWrap.appendChild(textarea);
                } else if (q.inputType === 'checkbox') {
                    const selectedSet = new Set();
                    const pillsWrap = document.createElement('div');
                    pillsWrap.className = 'questionnaire-options-pills';

                    q.options.forEach((opt) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'option-choice-btn';
                        btn.textContent = opt.label;
                        btn.addEventListener('click', () => {
                            if (selectedSet.has(opt.value)) {
                                selectedSet.delete(opt.value);
                                btn.classList.remove('active');
                            } else {
                                selectedSet.add(opt.value);
                                btn.classList.add('active');
                            }
                            if (selectedSet.size === 0) {
                                setAnswer(q, null);
                            } else {
                                const joined = Array.from(selectedSet).map((v) => `${v};`).join('');
                                setAnswer(q, joined);
                                qCard.classList.remove('questionnaire-question-missing');
                            }
                        });
                        pillsWrap.appendChild(btn);
                    });

                    controlsWrap.appendChild(pillsWrap);
                } else if (isRatingQuestion) {
                    const ratingRow = document.createElement('div');
                    ratingRow.className = 'questionnaire-rating-row';
                    const optionButtons = [];

                    q.options.forEach((opt) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'rating-pill-btn';
                        btn.dataset.val = opt.value;
                        btn.textContent = opt.label;

                        btn.addEventListener('click', () => {
                            optionButtons.forEach((b) => b.classList.remove('active'));
                            btn.classList.add('active');
                            setAnswer(q, opt.value);
                            qCard.classList.remove('questionnaire-question-missing');
                        });

                        optionButtons.push(btn);
                        ratingRow.appendChild(btn);
                    });

                    updatersForSection.push((targetVal) => {
                        const matchingBtn = optionButtons.find((b) => b.dataset.val === String(targetVal));
                        if (matchingBtn) {
                            optionButtons.forEach((b) => b.classList.remove('active'));
                            matchingBtn.classList.add('active');
                            setAnswer(q, String(targetVal));
                            qCard.classList.remove('questionnaire-question-missing');
                        }
                    });

                    controlsWrap.appendChild(ratingRow);

                    if (q.note) {
                        const noteEl = document.createElement('div');
                        noteEl.className = 'questionnaire-question-note';
                        noteEl.textContent = q.note;
                        controlsWrap.appendChild(noteEl);
                    }
                } else {
                    // Single-choice radio (e.g. المستوى in البيانات الاساسية)
                    // Provide both a quick pill grid AND a select dropdown synced together for maximum ease of use
                    const selectWrap = document.createElement('div');
                    selectWrap.className = 'questionnaire-choice-container';

                    const pillsGrid = document.createElement('div');
                    pillsGrid.className = 'questionnaire-options-pills';
                    const choiceBtns = [];

                    q.options.forEach((opt) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'option-choice-btn';
                        btn.dataset.val = opt.value;
                        btn.textContent = opt.label;

                        btn.addEventListener('click', () => {
                            choiceBtns.forEach((b) => b.classList.remove('active'));
                            btn.classList.add('active');
                            setAnswer(q, opt.value);
                            qCard.classList.remove('questionnaire-question-missing');
                        });

                        choiceBtns.push(btn);
                        pillsGrid.appendChild(btn);
                    });

                    selectWrap.appendChild(pillsGrid);
                    controlsWrap.appendChild(selectWrap);
                }

                qCard.appendChild(controlsWrap);
                questionsListEl.appendChild(qCard);
            });

            sectionElementUpdaters.set(sIdx, updatersForSection);
            sectionEl.appendChild(questionsListEl);
            wrapper.appendChild(sectionEl);
        });

        // Validation / Error Feedback Box
        const feedbackBox = document.createElement('div');
        feedbackBox.className = 'questionnaire-feedback-box hidden';
        wrapper.appendChild(feedbackBox);

        // Submit Footer
        const footerCard = document.createElement('div');
        footerCard.className = 'subject-card questionnaire-submit-footer';
        footerCard.innerHTML = `
            <button type="button" class="primary-btn" id="${containerId}-submit-q-btn" style="max-width: 320px;">
                <span>إرسال الاستبيان (Submit)</span>
            </button>
        `;
        wrapper.appendChild(footerCard);

        const submitBtn = footerCard.querySelector(`#${containerId}-submit-q-btn`);
        submitBtn.addEventListener('click', async () => {
            feedbackBox.classList.add('hidden');

            // ValidateQuestionnaire logic: ensure all mandatoryQuestionIds exist in AnswersList
            const answersList = Array.from(answersMap.values());
            const answeredQuestionIds = new Set(answersList.map((a) => a.QuestionId));

            const mandatoryIds = Array.isArray(formData.mandatoryQuestionIds) && formData.mandatoryQuestionIds.length > 0
                ? formData.mandatoryQuestionIds
                : (formData.sections || []).flatMap((s) => s.questions.filter((q) => q.mandatory).map((q) => q.questionId));

            const missingIds = mandatoryIds.filter((id) => !answeredQuestionIds.has(Number(id)));

            if (missingIds.length > 0) {
                let firstMissingEl = null;
                missingIds.forEach((id) => {
                    const cardEl = questionCardElements.get(Number(id));
                    if (cardEl) {
                        cardEl.classList.add('questionnaire-question-missing');
                        if (!firstMissingEl) firstMissingEl = cardEl;
                    }
                });

                feedbackBox.className = 'questionnaire-feedback-box status-error';
                feedbackBox.textContent = `برجاء الإجابة على جميع الأسئلة الإجبارية أولاً (متبقي ${missingIds.length} سؤال إجباري غير مجاب).`;
                feedbackBox.classList.remove('hidden');

                if (firstMissingEl) {
                    firstMissingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<div class="btn-loader"></div><span>جاري إرسال الاستبيان...</span>`;

            try {
                const payload = {
                    answersList,
                    questionnaireId: formData.questionnaireId,
                    courseId: formData.courseId ?? 0,
                    academicAdvisorId: formData.academicAdvisorId ?? null,
                    requestVerificationToken: formData.requestVerificationToken
                };

                const res = await submitQuestionnaireAPI(payload);
                const json = await res.json();

                if (!json.success) {
                    throw new Error(json.error || 'فشل في حفظ إجابات الاستبيان. يرجى المحاولة مرة أخرى.');
                }

                // Refresh questionnaires list to see if more remain
                const listRes = await fetchQuestionnaires();
                const listJson = await listRes.json();
                const remaining = listJson.data?.questionnaires || [];

                if (remaining.length === 0 && typeof onAllCompleted === 'function') {
                    await onAllCompleted();
                } else {
                    await renderListState(remaining, {
                        type: 'success',
                        message: 'تم إرسال الاستبيان بنجاح!'
                    });
                }
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>إرسال الاستبيان (Submit)</span>`;
                feedbackBox.className = 'questionnaire-feedback-box status-error';
                feedbackBox.textContent = err.message || 'حدث خطأ أثناء إرسال الاستبيان.';
                feedbackBox.classList.remove('hidden');
            }
        });

        container.appendChild(wrapper);
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    await renderListState(initialQuestionnaires);
};

/**
 * Renders the blocked-by-payment state inside a grades/GPA/predictor container,
 * informing the student why grades are blocked and providing a direct link to the official UMS payment page.
 *
 * @param {string} containerId - Target DOM container ID
 * @param {string} paymentUrl - Official UMS payment URL
 * @param {Object} options - { onRetry: Function }
 */
export const renderPaymentBlock = (containerId, paymentUrl = 'https://ums.asu.edu.eg/Home/Payment', options = {}) => {
    const { onRetry, hasCachedData = false } = options;
    const container = getBlockHost(containerId, hasCachedData);
    if (!container) return;

    const targetUrl = paymentUrl || 'https://ums.asu.edu.eg/Home/Payment';

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'questionnaire-block-wrapper';

    const banner = document.createElement('div');
    banner.className = 'questionnaire-alert-card';
    banner.innerHTML = `
        <div class="questionnaire-alert-header">
            <div class="questionnaire-alert-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
            </div>
            <div class="questionnaire-alert-text">
                <h3>${hasCachedData ? 'تحديث الدرجات متوقف لوجود مصاريف غير مسددة' : 'الدرجات محجوبة لوجود مصاريف غير مسددة'}</h3>
                <p>${hasCachedData
                    ? 'يتم عرض آخر بيانات محفوظة لديك بالأسفل. لتحديث الدرجات الجديدة من نظام UMS الرسمي، لديك مصاريف غير مسددة؛ يرجى التوجه إلى صفحة المدفوعات في الموقع الرسمي لسداد المبلغ، أو التوجه إلى شئون الطلاب لمزيد من المعلومات.'
                    : 'لديك مصاريف غير مسددة في نظام UMS الرسمي تمنع إظهار الدرجات والسجل الأكاديمي. يرجى التوجه إلى صفحة المدفوعات في الموقع الرسمي لسداد المبلغ، أو التوجه إلى شئون الطلاب لمزيد من المعلومات.'}</p>
            </div>
        </div>
        <div class="questionnaire-alert-actions" style="gap: 10px; flex-wrap: wrap;">
            <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="primary-btn sm-btn" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; width: auto; padding: 10px 18px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                <span>الذهاب لصفحة الدفع (UMS الرسمي)</span>
            </a>
            <button type="button" class="secondary-btn sm-btn" id="${containerId}-retry-payment-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                إعادة التحقق من الدرجات
            </button>
        </div>
    `;

    wrapper.appendChild(banner);
    container.appendChild(wrapper);

    const retryBtn = document.getElementById(`${containerId}-retry-payment-btn`);
    if (retryBtn && typeof onRetry === 'function') {
        retryBtn.addEventListener('click', async () => {
            retryBtn.disabled = true;
            await onRetry();
        });
    }
};
