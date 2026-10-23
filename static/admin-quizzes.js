/* ==========================================================
   QUIZ MANAGEMENT · Complete Rewritten Version
   ========================================================== */

let allQuizzes = [];
let currentQuizSubject = null;
let parsedWord = null;
let editingQuizId = null;
let currentQuizDetailsId = null;

/* ---------- Auto-refresh state ---------- */
let _qzPollInterval = null;
let _qzPollHash = '';

/* ---------- Helpers ---------- */
async function getSubjects() {
    try {
        if (typeof allData !== 'undefined' && allData && Array.isArray(allData.subjects) && allData.subjects.length) {
            return allData.subjects;
        }
    } catch(e) {}
    try {
        const r = await fetch('/api/admin-data');
        const d = await r.json();
        if (d.status === 'success' && Array.isArray(d.subjects)) {
            try {
                if (typeof allData !== 'undefined') {
                    allData.subjects = d.subjects;
                    allData.sessions = d.sessions || [];
                    allData.staff = d.staff || [];
                }
            } catch(e) {}
            return d.subjects;
        }
    } catch(e) {}
    return [];
}

function esc(s) {
    return String(s||'').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

/* ---------- Navigation ---------- */
window.showQuizListView = function() {
    stopQuizDetailsPoll();
    currentQuizDetailsId = null;

    const listView = document.getElementById('quiz-list-view');
    const detailsView = document.getElementById('quiz-details-view');
    const uploadView = document.getElementById('quiz-upload-view');

    if (listView) listView.style.display = 'block';
    if (detailsView) detailsView.style.display = 'none';
    if (uploadView) uploadView.style.display = 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadQuizzes();
};

async function loadQuizzes() {
    const c = document.getElementById('quizzes-container');
    if (!c) return;
    if (currentQuizDetailsId) return;
    const uploadView = document.getElementById('quiz-upload-view');
    if (uploadView && uploadView.style.display === 'block') return;

    if (currentQuizSubject === null) await renderQuizSubjectsGrid();
    else await renderQuizListForSubject(currentQuizSubject);
}

/* ==========================================================
   View 1: Subjects Grid
   ========================================================== */
async function renderQuizSubjectsGrid() {
    const c = document.getElementById('quizzes-container');
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#8b93a7;">
        <i class="fas fa-spinner fa-spin fa-2x"></i></div>`;
    const subjects = await getSubjects();
    if (!subjects.length) {
        c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:#8b93a7;
            background:rgba(20,26,40,.5);border-radius:20px;border:1px dashed rgba(255,255,255,.12);">
            <i class="fas fa-book fa-3x" style="opacity:.4;margin-bottom:15px;"></i>
            <h3 style="color:#fff;">لا توجد مواد</h3>
            <p style="font-size:12px;margin-top:6px;">أضف مواد من تاب "إدارة المقررات" الأول</p>
        </div>`;
        return;
    }
    c.innerHTML = subjects.map(sub => {
        const safeName = (sub.name || '').replace(/'/g, "\\'");
        return `
            <div class="admin-subject-card" onclick="openQuizSubject('${sub.id}', '${safeName}')">
                <img src="${sub.image || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'}" alt="${sub.name}">
                <h3>${sub.name}</h3>
                <p>${sub.year || ''}${sub.department ? ' · ' + sub.department : ''}</p>
            </div>`;
    }).join('');
}

window.openQuizSubject = function(subId, subName) {
    currentQuizSubject = { id: subId, name: subName };
    loadQuizzes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.backToQuizSubjects = function() {
    currentQuizSubject = null;
    loadQuizzes();
};

/* ==========================================================
   View 2: Quizzes for Subject
   ========================================================== */
async function renderQuizListForSubject(subj) {
    const c = document.getElementById('quizzes-container');
    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#8b93a7;">
        <i class="fas fa-spinner fa-spin fa-2x"></i></div>`;
    try {
        const r = await fetch('/api/admin-quizzes');
        const d = await r.json();
        if (d.status !== 'success') {
            c.innerHTML = `<div style="grid-column:1/-1;color:#f87171;text-align:center;padding:20px;">فشل التحميل</div>`;
            return;
        }
        allQuizzes = (d.quizzes || []).filter(q => q.subject_id === subj.id);
        renderQuizListUI(subj);
    } catch(e) {
        c.innerHTML = `<div style="grid-column:1/-1;color:#f87171;text-align:center;padding:20px;">تعذر الاتصال</div>`;
    }
}

function renderQuizListUI(subj) {
    const c = document.getElementById('quizzes-container');
    const header = `
        <div style="grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;
             gap:12px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button class="btn btn-outline" onclick="backToQuizSubjects()"
                    style="padding:10px 14px;font-size:12px;">
                    <i class="fas fa-arrow-right"></i> رجوع
                </button>
                <h3 style="color:var(--nx-gold);margin:0;font-size:16px;font-weight:900;">
                    📚 ${subj.name}
                </h3>
            </div>
            <button class="btn btn-green" onclick="openQuizUploadModal(null)"
                style="padding:10px 16px;font-size:12px;">
                <i class="fas fa-file-word"></i> رفع كويز من Word
            </button>
        </div>`;

    if (!allQuizzes.length) {
        c.innerHTML = header + `
            <div style="grid-column:1/-1;text-align:center;padding:50px;color:#8b93a7;">
                <i class="fas fa-file-word fa-3x" style="opacity:.4;margin-bottom:15px;"></i>
                <h3 style="color:#fff;">لا يوجد كويزات</h3>
                <p style="font-size:12px;margin-top:6px;">ارفع ملف Word عشان تبدا</p>
            </div>`;
        return;
    }

    c.innerHTML = header + allQuizzes.map(q => {
        const expectedQ = q.expected_questions || (q.questions ? q.questions.length : 0);
        return `
            <div class="admin-subject-card" onclick="openQuizDetails('${q.id}')">
                <div style="width:70px;height:70px;border-radius:50%;display:flex;align-items:center;
                     justify-content:center;background:rgba(255,179,0,.15);border:2px solid rgba(255,179,0,.4);
                     color:#FFB300;font-size:28px;margin-bottom:12px;">
                    <i class="fas fa-file-pen"></i>
                </div>
                <h3 style="font-size:15px;">${q.title}</h3>
                <p style="font-size:11px;">${expectedQ} سؤال · ${q.total_points || 0} درجة</p>
                <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:10px;">
                    <span style="font-size:10px;padding:3px 8px;border-radius:8px;
                        background:${q.is_open ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};
                        color:${q.is_open ? '#10B981' : '#f87171'};
                        border:1px solid ${q.is_open ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'};">
                        ${q.is_open ? 'مفتوح' : 'مغلق'}
                    </span>
                    <span style="font-size:10px;padding:3px 8px;border-radius:8px;
                        background:rgba(59,130,246,.15);color:#60A5FA;border:1px solid rgba(59,130,246,.4);">
                        ⏱ ${q.duration} دقيقة
                    </span>
                </div>
            </div>`;
    }).join('');
}

/* ==========================================================
   View 3: Quiz Details (NEW CLEAN LAYOUT)
   ========================================================== */
window.openQuizDetails = async function(quizId) {
    stopQuizDetailsPoll();
    currentQuizDetailsId = quizId;

    document.getElementById('quiz-list-view').style.display = 'none';
    document.getElementById('quiz-upload-view').style.display = 'none';
    const detailsView = document.getElementById('quiz-details-view');
    detailsView.style.display = 'block';
    detailsView.innerHTML = `<div style="text-align:center;padding:50px;color:#8b93a7;">
        <i class="fas fa-spinner fa-spin fa-3x"></i></div>`;

    try {
        const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
        const d = await r.json();
        if (d.status !== 'success') {
            detailsView.innerHTML = `<div style="color:#f87171;text-align:center;padding:20px;">فشل تحميل البيانات</div>`;
            return;
        }

        const quiz = d.quiz;
        const attempts = d.attempts || [];
        const blocks = d.blocks || [];
        const sectionsConfig = quiz.sections_config || [];
        const expectedQ = quiz._expected_questions || 0;
        const isRandom = quiz._is_random_mode || false;
        const isLinked = quiz.broadcast_active || false;

        const completed = attempts.filter(a => a.status === 'completed');
        const blockedCount = blocks.length;

        let avg = 0;
        if (completed.length > 0) {
            const totalScores = completed.reduce((s, a) => s + (parseFloat(a.score) || 0), 0);
            avg = (totalScores / completed.length).toFixed(1);
        }

        _qzPollHash = _qzAttemptsHash(attempts, blocks);

        const studentsHtml = qzBuildStudentsHtml(attempts, quizId);
        const blockedHtml = qzBuildBlockedHtml(blocks, quizId);
        const questionsHtml = qzBuildQuestionsHtml(quiz, sectionsConfig);

        detailsView.innerHTML = `
            <div class="qz-detail-shell">

                <!-- ============ HEADER ============ -->
                <div class="qz-detail-header">
                    <button class="qz-back-btn" onclick="showQuizListView()">
                        <i class="fas fa-arrow-right"></i>
                        <span>رجوع للكويزات</span>
                    </button>
                    <div class="qz-header-actions">
                        <button class="qz-action-chip" onclick="editQuizMeta('${quiz.id}')">
                            <i class="fas fa-pen"></i><span>تعديل</span>
                        </button>
                        <button class="qz-action-chip ${quiz.is_open ? 'red' : 'green'}" onclick="toggleQuizOpen('${quiz.id}', ${!quiz.is_open})">
                            <i class="fas fa-${quiz.is_open ? 'lock' : 'lock-open'}"></i>
                            <span>${quiz.is_open ? 'إغلاق' : 'فتح'}</span>
                        </button>
                        <button class="qz-action-chip ${isLinked ? 'linked' : 'cyan'}" onclick="linkQuizScreen('${quiz.id}', ${isLinked})">
                            <i class="fas fa-tv"></i>
                            <span>${isLinked ? 'مربوط' : 'ربط'}</span>
                        </button>
                        <button class="qz-action-chip" onclick="downloadQuizExcel('${quiz.id}')">
                            <i class="fas fa-file-excel"></i><span>إكسل</span>
                        </button>
                        <button class="qz-action-chip danger" onclick="deleteQuiz('${quiz.id}')">
                            <i class="fas fa-trash"></i><span>حذف</span>
                        </button>
                    </div>
                </div>

                <!-- ============ TITLE ============ -->
                <div class="qz-title-card">
                    <div class="qz-title-icon"><i class="fas fa-file-pen"></i></div>
                    <div class="qz-title-body">
                        <h2 class="qz-main-title">${esc(quiz.title)}</h2>
                        <div class="qz-title-meta">
                            <span><i class="fas fa-book"></i> ${esc(quiz.subject_name || '')}</span>
                            <span><i class="fas fa-clock"></i> ${quiz.duration} دقيقة</span>
                            <span><i class="fas fa-question-circle"></i> ${expectedQ} سؤال</span>
                            ${isRandom ? `<span class="meta-badge purple"><i class="fas fa-dice"></i> عشوائي</span>` : ''}
                            ${isLinked ? `<span class="meta-badge green"><i class="fas fa-tv"></i> الشاشة مربوطة</span>` : ''}
                        </div>
                    </div>
                </div>

                <!-- ============ STATS ============ -->
                <div class="qz-stats-grid">
                    <div class="qz-stat-card blue">
                        <div class="qz-stat-icon-wrap blue"><i class="fas fa-users"></i></div>
                        <div class="qz-stat-content">
                            <div class="qz-stat-value" data-qz-attempts="${quiz.id}">${attempts.length}</div>
                            <div class="qz-stat-label">طالب دخل</div>
                        </div>
                    </div>
                    <div class="qz-stat-card green">
                        <div class="qz-stat-icon-wrap green"><i class="fas fa-check-circle"></i></div>
                        <div class="qz-stat-content">
                            <div class="qz-stat-value">${completed.length}</div>
                            <div class="qz-stat-label">أكمل</div>
                        </div>
                    </div>
                    <div class="qz-stat-card gold">
                        <div class="qz-stat-icon-wrap gold"><i class="fas fa-chart-line"></i></div>
                        <div class="qz-stat-content">
                            <div class="qz-stat-value" data-qz-avg="${quiz.id}">${avg}</div>
                            <div class="qz-stat-label">متوسط الدرجات</div>
                        </div>
                    </div>
                    <div class="qz-stat-card red">
                        <div class="qz-stat-icon-wrap red"><i class="fas fa-ban"></i></div>
                        <div class="qz-stat-content">
                            <div class="qz-stat-value">${blockedCount}</div>
                            <div class="qz-stat-label">محظور</div>
                        </div>
                    </div>
                </div>

                <!-- ============ TABS ============ -->
                <div class="qz-tabs-bar">
                    <button class="qz-tab active" onclick="qzNavSwitch('${quiz.id}', 'students', this)">
                        <i class="fas fa-users"></i>
                        <span>الطلاب</span>
                        <span class="qz-tab-badge">${attempts.length}</span>
                    </button>
                    <button class="qz-tab" onclick="qzNavSwitch('${quiz.id}', 'blocked', this)">
                        <i class="fas fa-ban"></i>
                        <span>المحظورين</span>
                        ${blockedCount > 0 ? `<span class="qz-tab-badge red">${blockedCount}</span>` : ''}
                    </button>
                    <button class="qz-tab" onclick="qzNavSwitch('${quiz.id}', 'questions', this)">
                        <i class="fas fa-list"></i>
                        <span>الأسئلة</span>
                        <span class="qz-tab-badge">${sectionsConfig.length} شيت</span>
                    </button>
                </div>

                <!-- ============ CONTENT ============ -->
                <div class="qz-content-area">
                    <div class="qz-view active" id="qz-view-students-${quiz.id}">${studentsHtml}</div>
                    <div class="qz-view" id="qz-view-blocked-${quiz.id}">${blockedHtml}</div>
                    <div class="qz-view" id="qz-view-questions-${quiz.id}">${questionsHtml}</div>
                </div>
            </div>
        `;

        _qzPollInterval = setInterval(() => _qzRefreshQuizDetails(quizId), 5000);

    } catch (e) {
        console.error(e);
        detailsView.innerHTML = `<div style="color:#f87171;text-align:center;padding:20px;">تعذر الاتصال بالسيرفر</div>`;
    }
};

/* ==========================================================
   AUTO-REFRESH HELPERS
   ========================================================== */
function stopQuizDetailsPoll() {
    if (_qzPollInterval) {
        clearInterval(_qzPollInterval);
        _qzPollInterval = null;
    }
    _qzPollHash = '';
}

function _qzAttemptsHash(attempts, blocks) {
    const atk = (attempts || []).map(a => `${a.attempt_id || ''}|${a.status || ''}|${a.score ?? ''}|${a.total_points ?? ''}`).join('~');
    const blk = (blocks || []).map(b => `${b.student_id || ''}|${b.reason || ''}`).join(',');
    return atk + '||' + blk;
}

/* ---------- Build students tab ---------- */
function qzBuildStudentsHtml(attempts, quizId) {
    if (!attempts || attempts.length === 0) {
        return `<div class="qz-empty-state">
            <div class="qz-empty-icon">👥</div>
            <h3>لا يوجد طلاب</h3>
            <p>لم يدخل أي طالب للامتحان بعد</p>
        </div>`;
    }
    return `<div class="qz-students-list">${attempts.map(a => {
        const st = a.status;
        const avatarText = (a.student_name || '?').trim().charAt(0).toUpperCase();
        const safeName = (a.student_name || '').replace(/'/g, "\\'");

        let scoreHtml = '';
        let statusLabel = '';
        let statusClass = '';

        if (st === 'completed') {
            const score = parseFloat(a.score) || 0;
            const total = parseFloat(a.total_points) || 1;
            const pct = (score / total) * 100;
            const cls = pct >= 70 ? 'good' : (pct >= 50 ? 'mid' : 'bad');
            scoreHtml = `<div class="qz-score-badge ${cls}">
                <span class="qz-score-num">${score}</span>
                <span class="qz-score-total">/ ${total}</span>
            </div>`;
            statusLabel = 'أكمل';
            statusClass = 'completed';
        } else if (st === 'cancelled') {
            scoreHtml = `<div class="qz-score-badge cheat">غش</div>`;
            statusLabel = 'غش';
            statusClass = 'cancelled';
        } else {
            scoreHtml = `<div class="qz-score-badge pending">جاري</div>`;
            statusLabel = 'جاري';
            statusClass = 'in_progress';
        }

        return `<div class="qz-student-item ${statusClass}">
            <div class="qz-student-avatar ${statusClass}">${esc(avatarText)}</div>
            <div class="qz-student-body">
                <div class="qz-student-name">${esc(a.student_name || 'غير معروف')}</div>
                <div class="qz-student-meta">
                    <span class="qz-mono">${a.student_id}</span>
                    <span class="qz-status-chip ${statusClass}">${statusLabel}</span>
                </div>
            </div>
            ${scoreHtml}
            <button class="qz-retake-btn" onclick="event.stopPropagation(); retakeStudent('${quizId}','${a.student_id}','${safeName}')" title="إعادة الامتحان">
                <i class="fas fa-redo"></i>
            </button>
        </div>`;
    }).join('')}</div>`;
}

/* ---------- Build blocked tab ---------- */
function qzBuildBlockedHtml(blocks, quizId) {
    if (!blocks || blocks.length === 0) {
        return `<div class="qz-empty-state">
            <div class="qz-empty-icon">✅</div>
            <h3>لا يوجد محظورين</h3>
            <p>كل الطلاب بخير</p>
        </div>`;
    }
    return `<div class="qz-students-list">${blocks.map(b => {
        const avatarText = (b.student_name || '?').trim().charAt(0).toUpperCase();
        const safeName = (b.student_name || '').replace(/'/g, "\\'");
        return `<div class="qz-student-item cancelled">
            <div class="qz-student-avatar cancelled">${esc(avatarText)}</div>
            <div class="qz-student-body">
                <div class="qz-student-name">${esc(b.student_name || 'غير معروف')}</div>
                <div class="qz-student-meta">
                    <span class="qz-mono">${b.student_id}</span>
                    <span class="qz-status-chip cancelled">🚫 ${esc(b.reason || '')}</span>
                </div>
            </div>
            <button class="qz-retake-btn" onclick="event.stopPropagation(); retakeStudent('${quizId}','${b.student_id}','${safeName}')">
                <i class="fas fa-redo"></i> إعادة
            </button>
        </div>`;
    }).join('')}</div>`;
}

/* ---------- Build questions tab (INLINE SHEETS) ---------- */
function qzBuildQuestionsHtml(quiz, sectionsConfig) {
    if (sectionsConfig.length === 0) {
        return `<div class="qz-empty-state">
            <div class="qz-empty-icon">📝</div>
            <h3>لا يوجد شيتات</h3>
            <p>ارفع ملف Word عشان تضيف شيت للكويز</p>
            <button class="btn btn-green" onclick="addQuizQuestionsWord('${quiz.id}')" style="margin-top:16px;">
                <i class="fas fa-file-word"></i> رفع Word جديد
            </button>
        </div>`;
    }

    return `
        <div class="qz-toolbar-bar">
            <div class="qz-toolbar-info">
                <i class="fas fa-layer-group"></i>
                <span>${sectionsConfig.length} شيت · ${quiz._expected_questions || 0} سؤال</span>
            </div>
            <button class="btn btn-green" onclick="addQuizQuestionsWord('${quiz.id}')">
                <i class="fas fa-plus"></i> رفع Word
            </button>
        </div>
        <div class="qz-sheets-list">
            ${sectionsConfig.map((s, idx) => qzBuildSheetCard(quiz, s, idx)).join('')}
        </div>`;
}

function qzBuildSheetCard(quiz, s, idx) {
    const totalQ = (s.all_questions || []).length;
    const pick = s.num_to_pick || 0;
    const safeName = (s.name || '').replace(/'/g, "\\'");

    const questionsHtml = (s.all_questions || []).map((q, qidx) => {
        const opts = q.options || [];
        const isTF = q.type === 'tf';
        const correctIdx = ['a','b','c','d'].indexOf(q.correct);
        const optCount = isTF ? 2 : opts.length;

        const optsHtml = opts.slice(0, optCount).map((opt, i) => {
            if (!opt) return '';
            const letter = String.fromCharCode(65 + i);
            const isC = i === correctIdx;
            return `<div class="qz-q-option ${isC ? 'correct' : ''}">
                <span class="qz-q-opt-letter">${letter}</span>
                <span class="qz-q-opt-text">${esc(opt)}</span>
                ${isC ? '<i class="fas fa-check" style="color:#10B981;font-size:11px;"></i>' : ''}
            </div>`;
        }).join('');

        return `<div class="qz-question-item">
            <div class="qz-q-header">
                <span class="qz-q-num">Q${qidx + 1}</span>
                <span class="qz-q-type ${isTF ? 'tf' : 'mcq'}">${isTF ? 'T/F' : 'MCQ'}</span>
                <div class="qz-q-actions">
                    <button class="qz-q-action-btn" onclick="event.stopPropagation(); qzEditQuestionInSection('${quiz.id}', ${idx}, ${qidx})" title="تعديل">✏️</button>
                    <button class="qz-q-action-btn danger" onclick="event.stopPropagation(); qzDeleteQuestionInSection('${quiz.id}', ${idx}, ${qidx})" title="حذف">🗑️</button>
                </div>
            </div>
            <div class="qz-q-text">${esc(q.text)}</div>
            <div class="qz-q-options">${optsHtml}</div>
        </div>`;
    }).join('');

    return `<div class="qz-sheet-card" data-sheet-idx="${idx}">
        <div class="qz-sheet-header" onclick="qzToggleSheet(${idx})">
            <div class="qz-sheet-icon">📁</div>
            <div class="qz-sheet-info">
                <div class="qz-sheet-name">${esc(s.name)}</div>
                <div class="qz-sheet-meta">
                    <span><b>${totalQ}</b> سؤال</span>
                    <span class="qz-dot">·</span>
                    <span><b>${pick}</b> مسحوب</span>
                    <span class="qz-dot">·</span>
                    <span class="qz-pts-mcq">${s.mcq_points || 1} pt MCQ</span>
                    <span class="qz-dot">·</span>
                    <span class="qz-pts-tf">${s.tf_points || 1} pt T/F</span>
                </div>
            </div>
            <div class="qz-sheet-actions">
                <button class="qz-q-action-btn" onclick="event.stopPropagation(); qzEditSectionMeta('${quiz.id}', ${idx})" title="تعديل الشيت">✏️</button>
                <button class="qz-q-action-btn danger" onclick="event.stopPropagation(); qzDeleteSectionConfirm('${quiz.id}', ${idx}, '${safeName}')" title="حذف الشيت">🗑️</button>
                <span class="qz-expand-icon"><i class="fas fa-chevron-down"></i></span>
            </div>
        </div>
        <div class="qz-sheet-questions" id="qz-sheet-questions-${idx}">
            ${questionsHtml || '<div class="qz-empty-state small"><p>لا يوجد أسئلة</p></div>'}
        </div>
    </div>`;
}

/* ---------- Toggle sheet open/close ---------- */
window.qzToggleSheet = function(idx) {
    const el = document.getElementById(`qz-sheet-questions-${idx}`);
    const card = el?.closest('.qz-sheet-card');
    if (!el) return;
    const isOpen = el.classList.contains('open');
    if (isOpen) {
        el.classList.remove('open');
        card?.classList.remove('expanded');
    } else {
        el.classList.add('open');
        card?.classList.add('expanded');
    }
};

/* ---------- Reopen a specific sheet after any operation ---------- */
async function qzReopenSheetInline(quizId, sectionIndex) {
    await openQuizDetails(quizId);
    const tabBtn = document.querySelector(`.qz-tabs-bar .qz-tab:nth-child(3)`);
    if (tabBtn) qzNavSwitch(quizId, 'questions', tabBtn);
    const el = document.getElementById(`qz-sheet-questions-${sectionIndex}`);
    const card = el?.closest('.qz-sheet-card');
    if (el) { el.classList.add('open'); card?.classList.add('expanded'); }
}

/* ---------- Refresh (polling) ---------- */
async function _qzRefreshQuizDetails(quizId) {
    if (document.hidden || currentQuizDetailsId !== quizId) return;
    try {
        const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
        const d = await r.json();
        if (d.status !== 'success') return;

        const attempts = d.attempts || [];
        const blocks = d.blocks || [];
        const newHash = _qzAttemptsHash(attempts, blocks);
        if (newHash === _qzPollHash) return;
        _qzPollHash = newHash;

        const studentsEl = document.getElementById(`qz-view-students-${quizId}`);
        const blockedEl = document.getElementById(`qz-view-blocked-${quizId}`);

        if (studentsEl) studentsEl.innerHTML = qzBuildStudentsHtml(attempts, quizId);
        if (blockedEl) blockedEl.innerHTML = qzBuildBlockedHtml(blocks, quizId);

        const attemptsEl = document.querySelector(`[data-qz-attempts="${quizId}"]`);
        if (attemptsEl) attemptsEl.textContent = attempts.length;

        const avgEl = document.querySelector(`[data-qz-avg="${quizId}"]`);
        if (avgEl) {
            const completed = attempts.filter(a => a.status === 'completed');
            let avg = 0;
            if (completed.length > 0) {
                const totalScores = completed.reduce((s, a) => s + (parseFloat(a.score) || 0), 0);
                avg = (totalScores / completed.length).toFixed(1);
            }
            avgEl.textContent = avg;
        }

        // Update tabs badges
        const studentsTab = document.querySelector(`.qz-tabs-bar .qz-tab:nth-child(1) .qz-tab-badge`);
        if (studentsTab) studentsTab.textContent = attempts.length;

        const blockedTab = document.querySelector(`.qz-tabs-bar .qz-tab:nth-child(2)`);
        if (blockedTab) {
            const existingBadge = blockedTab.querySelector('.qz-tab-badge');
            if (blocks.length > 0) {
                if (existingBadge) {
                    existingBadge.textContent = blocks.length;
                    existingBadge.classList.add('red');
                } else {
                    const span = document.createElement('span');
                    span.className = 'qz-tab-badge red';
                    span.textContent = blocks.length;
                    blockedTab.appendChild(span);
                }
            } else if (existingBadge && existingBadge.classList.contains('red')) {
                existingBadge.remove();
            }
        }
    } catch(e) {}
}

/* ---------- Tab switching ---------- */
window.qzNavSwitch = function(quizId, viewName, btn) {
    document.querySelectorAll(`[id^="qz-view-"][id$="-${quizId}"]`).forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`qz-view-${viewName}-${quizId}`);
    if (view) view.classList.add('active');
    const tabsBar = btn.closest('.qz-tabs-bar');
    if (tabsBar) {
        tabsBar.querySelectorAll('.qz-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
};

async function reopenQuizQuestionsTab(quizId) {
    Swal.close();
    await openQuizDetails(quizId);
    const btn = document.querySelector(`.qz-tabs-bar .qz-tab:nth-child(3)`);
    if (btn) qzNavSwitch(quizId, 'questions', btn);
}

/* ==========================================================
   RETAKE STUDENT
   ========================================================== */
async function retakeStudent(quizId, studentId, studentName) {
    Swal.close();
    const c = await Swal.fire({
        icon: 'question',
        title: '🔄 إعادة الامتحان؟',
        html: `
            <div style="text-align:center;font-family:'Cairo',sans-serif;line-height:1.8;">
                <p style="color:#fff;margin-bottom:10px;">هيتم حذف محاولة الطالب السابقة نهائياً</p>
                <p style="color:#FFD54F;font-weight:900;font-size:16px;margin-bottom:14px;padding:8px 14px;background:rgba(255,179,0,0.1);border:1px solid rgba(255,179,0,0.3);border-radius:10px;display:inline-block;">
                    ${esc(studentName || studentId)}
                </p>
                <div style="padding:10px 14px;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.3);border-radius:10px;font-size:12px;color:#22d3ee;text-align:right;margin-top:8px;">
                    <i class="fas fa-info-circle"></i> الطالب هيرجع يقدر يدخل الامتحان من الأول
                    <br>لو كان محظور → هيتفك الحظر
                    <br>لو كان جوه الامتحان → هيتقفل امتحانه الحالي
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-redo"></i> نعم، إعادة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#FFB300',
        cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff',
        reverseButtons: true
    });
    if (!c.isConfirmed) return;

    Swal.fire({ title: 'جاري الإعادة...', background: '#1a2136', color: '#fff', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const r = await fetch('/api/admin-quiz-retake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quiz_id: quizId, student_id: studentId })
        });
        const d = await r.json();
        if (d.status === 'success') {
            Swal.fire({ icon: 'success', title: 'تمت الإعادة', timer: 1400, showConfirmButton: false, background: '#1a2136', color: '#fff' });
            openQuizDetails(quizId);
            loadQuizzes();
        } else {
            Swal.fire({ icon: 'error', text: d.message || 'فشلت الإعادة', background: '#1a2136', color: '#fff' });
        }
    } catch(e) {
        Swal.fire({ icon: 'error', text: 'تعذر الاتصال بالسيرفر', background: '#1a2136', color: '#fff' });
    }
}

async function unblockStudent(quizId, studentId) {
    return retakeStudent(quizId, studentId, studentId);
}

/* ==========================================================
   SECTION META / QUESTION MANAGEMENT (inline)
   ========================================================== */
window.qzEditSectionMeta = async function(quizId, sectionIndex) {
    Swal.close();
    stopQuizDetailsPoll();

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const section = sections[sectionIndex];
    if (!section) return;

    const totalQ = (section.all_questions || []).length;

    const result = await Swal.fire({
        title: '✏️ تعديل الشيت',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">📝 اسم الشيت</label>
                <input id="sec-name" value="${esc(section.name)}"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">🎯 عدد الأسئلة المسحوبة (من ${totalQ})</label>
                <input id="sec-pick" type="number" min="1" max="${totalQ}" value="${section.num_to_pick || totalQ}"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:6px;outline:none;">
                <p style="font-size:11px;color:#8b93a7;margin-bottom:12px;">الطالب هيشوف ${section.num_to_pick || totalQ} سؤال عشوائي من أصل ${totalQ}</p>
                <div style="display:flex;gap:10px;">
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⭐ درجة MCQ</label>
                        <input id="sec-mcq" type="number" min="0.25" step="0.25" value="${section.mcq_points || 1}"
                            style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;outline:none;text-align:center;">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⭐ درجة T/F</label>
                        <input id="sec-tf" type="number" min="0.25" step="0.25" value="${section.tf_points || 1}"
                            style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;outline:none;text-align:center;">
                    </div>
                </div>
            </div>
        `,
        background: '#1a2136', color: '#fff', width: 520,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        preConfirm: () => {
            const name = document.getElementById('sec-name').value.trim();
            const pick = parseInt(document.getElementById('sec-pick').value);
            const mcq = parseFloat(document.getElementById('sec-mcq').value);
            const tf = parseFloat(document.getElementById('sec-tf').value);
            if (!name) return Swal.showValidationMessage('اكتب اسم الشيت');
            if (!pick || pick < 1) return Swal.showValidationMessage('عدد الأسئلة 1 على الأقل');
            if (pick > totalQ) return Swal.showValidationMessage(`الحد الأقصى ${totalQ}`);
            if (!mcq || mcq < 0.25) return Swal.showValidationMessage('درجة MCQ غير صالحة');
            if (!tf || tf < 0.25) return Swal.showValidationMessage('درجة T/F غير صالحة');
            return { name, pick, mcq, tf };
        }
    });

    if (!result.isConfirmed) return;

    const newSections = sections.map((s, i) => {
        if (i === sectionIndex) {
            return { ...s, name: result.value.name, num_to_pick: result.value.pick, mcq_points: result.value.mcq, tf_points: result.value.tf };
        }
        return s;
    });

    await saveQuizSections(quizId, quiz, newSections, () => qzReopenSheetInline(quizId, sectionIndex));
};

window.qzDeleteSectionConfirm = async function(quizId, sectionIndex, sectionName) {
    Swal.close();
    stopQuizDetailsPoll();

    const c = await Swal.fire({
        icon: 'warning', title: 'حذف الشيت؟',
        html: `<div style="text-align:center;">
            <p style="color:#fff;margin-bottom:10px;">هيتم حذف الشيت كامل مع كل أسئلته:</p>
            <p style="color:#FFD54F;font-weight:900;font-size:14px;padding:8px 14px;background:rgba(255,179,0,.1);border-radius:10px;display:inline-block;">${esc(sectionName)}</p>
        </div>`,
        showCancelButton: true, confirmButtonText: '<i class="fas fa-trash"></i> حذف', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444', cancelButtonColor: '#374151', background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const newSections = sections.filter((_, i) => i !== sectionIndex);

    if (newSections.length === 0) {
        return Swal.fire({ icon: 'error', title: 'لا يمكن حذف آخر شيت', text: 'الكويز لازم يكون فيه شيت واحد على الأقل.', background: '#1a2136', color: '#fff' });
    }
    await saveQuizSections(quizId, quiz, newSections, () => reopenQuizQuestionsTab(quizId));
};

window.qzAddQuestionToSection = async function(quizId, sectionIndex) {
    Swal.close();
    stopQuizDetailsPoll();

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const section = sections[sectionIndex];
    if (!section) return;

    const result = await Swal.fire({
        title: '➕ إضافة سؤال',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <div style="padding:8px 12px;background:rgba(6,182,212,0.08);border:1px solid rgba(6,182,212,0.3);border-radius:10px;margin-bottom:12px;font-size:12px;color:#22d3ee;font-weight:800;">
                    📁 ${esc(section.name)} — ${(section.all_questions || []).length} سؤال موجود
                </div>
                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">نوع السؤال</label>
                <select id="new-q-type" onchange="qzToggleNewQType()"
                    style="width:100%;padding:11px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none;">
                    <option value="mcq">MCQ</option>
                    <option value="tf">True / False</option>
                </select>
                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">نص السؤال</label>
                <textarea id="new-q-text" rows="3" placeholder="Type the question..."
                    style="width:100%;padding:11px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none;resize:vertical;direction:ltr;text-align:left;"></textarea>
                <div id="new-q-opts-mcq">
                    <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">الاختيارات</label>
                    <input id="new-q-a" type="text" placeholder="A) ..." style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-b" type="text" placeholder="B) ..." style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-c" type="text" placeholder="C) ..." style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-d" type="text" placeholder="D) ..." style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                </div>
                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;margin-top:10px;font-weight:800;">الإجابة الصحيحة</label>
                <select id="new-q-correct" style="width:100%;padding:11px;background:rgba(0,0,0,.5);border:1.5px solid rgba(16,185,129,.4);border-radius:10px;color:#10B981;font-size:13px;font-family:'Cairo',sans-serif;outline:none;">
                    <option value="a">A / True</option>
                    <option value="b">B / False</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                </select>
            </div>
        `,
        background: '#1a2136', color: '#fff', width: 520,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        didOpen: () => {
            window.qzToggleNewQType = function() {
                const type = document.getElementById('new-q-type').value;
                const mcqBox = document.getElementById('new-q-opts-mcq');
                const correctSel = document.getElementById('new-q-correct');
                if (!mcqBox || !correctSel) return;
                if (type === 'tf') {
                    mcqBox.style.display = 'none';
                    correctSel.innerHTML = `<option value="a">A / True</option><option value="b">B / False</option>`;
                } else {
                    mcqBox.style.display = 'block';
                    correctSel.innerHTML = `<option value="a">A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option>`;
                }
            };
        },
        preConfirm: () => {
            const type = document.getElementById('new-q-type').value;
            const text = document.getElementById('new-q-text').value.trim();
            const correct = document.getElementById('new-q-correct').value;
            if (!text) return Swal.showValidationMessage('اكتب نص السؤال');
            let options;
            if (type === 'tf') {
                options = ['True', 'False', '', ''];
            } else {
                const a = document.getElementById('new-q-a').value.trim();
                const b = document.getElementById('new-q-b').value.trim();
                const c = document.getElementById('new-q-c').value.trim();
                const dd = document.getElementById('new-q-d').value.trim();
                if (!a || !b || !c || !dd) return Swal.showValidationMessage('كمل كل الاختيارات');
                options = [a, b, c, dd];
            }
            return { text, type, options, correct };
        }
    });

    if (!result.isConfirmed) return;

    const updatedSection = {
        ...section,
        all_questions: [...(section.all_questions || []), {
            text: result.value.text, type: result.value.type, options: result.value.options, correct: result.value.correct
        }],
        num_to_pick: Math.max(section.num_to_pick || 0, 1)
    };
    const newSections = sections.map((s, i) => i === sectionIndex ? updatedSection : s);
    await saveQuizSections(quizId, quiz, newSections, () => qzReopenSheetInline(quizId, sectionIndex));
};

window.qzEditQuestionInSection = async function(quizId, sectionIndex, qIdx) {
    stopQuizDetailsPoll();
    const qid = `s${sectionIndex}_q${qIdx}`;
    await editQuizQuestion(quizId, qid, () => qzReopenSheetInline(quizId, sectionIndex));
};

window.qzDeleteQuestionInSection = async function(quizId, sectionIndex, qIdx) {
    Swal.close();
    stopQuizDetailsPoll();

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const section = sections[sectionIndex];
    if (!section || !section.all_questions[qIdx]) return;
    const q = section.all_questions[qIdx];

    const c = await Swal.fire({
        icon: 'warning', title: 'حذف السؤال؟',
        html: `<div style="text-align:right;"><div style="direction:ltr;text-align:left;font-size:12px;color:#8b93a7;padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;margin-bottom:10px;">${esc(q.text).substring(0, 120)}${q.text.length > 120 ? '...' : ''}</div></div>`,
        showCancelButton: true, confirmButtonText: '<i class="fas fa-trash"></i> حذف', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444', cancelButtonColor: '#374151', background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    const newQuestions = [...(section.all_questions || [])];
    newQuestions.splice(qIdx, 1);

    let newSections;
    if (newQuestions.length === 0) {
        newSections = sections.filter((_, i) => i !== sectionIndex);
        if (newSections.length === 0) {
            return Swal.fire({ icon: 'error', title: 'لا يمكن حذف آخر سؤال', text: 'الكويز لازم يكون فيه سؤال واحد على الأقل', background: '#1a2136', color: '#fff' });
        }
    } else {
        newSections = sections.map((s, i) => {
            if (i === sectionIndex) {
                const pick = Math.min(s.num_to_pick || newQuestions.length, newQuestions.length);
                return { ...s, all_questions: newQuestions, num_to_pick: Math.max(pick, 1) };
            }
            return s;
        });
    }

    const returnFn = newQuestions.length > 0
        ? () => qzReopenSheetInline(quizId, sectionIndex)
        : () => reopenQuizQuestionsTab(quizId);

    await saveQuizSections(quizId, quiz, newSections, returnFn);
};

/* ---------- Save sections (shared helper) ---------- */
async function saveQuizSections(quizId, quiz, sections, onSuccess) {
    const sectionsConfig = sections.map(s => {
        const totalQ = (s.all_questions || []).length;
        let pick = s.num_to_pick || totalQ;
        if (pick < 1) pick = totalQ;
        if (pick > totalQ) pick = totalQ;
        return { name: s.name, questions: s.all_questions, num_to_pick: pick, mcq_points: s.mcq_points || 1, tf_points: s.tf_points || 1 };
    });

    Swal.fire({ title: 'جاري الحفظ...', background: '#1a2136', color: '#fff', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const save = await fetch('/api/admin-save-quiz-word', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quizId, title: quiz.title, subject_id: quiz.subject_id, duration: quiz.duration, sections: sectionsConfig })
        });
        const sd = await save.json();
        if (sd.status === 'success') {
            Swal.fire({ icon: 'success', title: 'تم الحفظ', timer: 800, showConfirmButton: false, background: '#1a2136', color: '#fff' });
            loadQuizzes();
            if (typeof onSuccess === 'function') onSuccess();
            else openQuizDetails(quizId);
        } else {
            Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) {
        Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }
}

/* ---------- Edit single question (internal) ---------- */
async function editQuizQuestion(quizId, qid, onSuccess) {
    stopQuizDetailsPoll();
    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const allQ = quiz._admin_flat_questions || quiz.questions || [];
    const q = allQ.find(x => x.id === qid);
    if (!q) return;

    const isTF = q.type === 'tf';
    const opts = q.options || ['', '', '', ''];
    const isRandom = quiz._is_random_mode || false;

    const html = `
        <div style="text-align:right;">
            ${isRandom ? `<div style="padding:8px 12px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.4);border-radius:10px;margin-bottom:10px;font-size:11px;color:#a78bfa;font-weight:800;">🎲 وضع عشوائي — التعديل هيأثر على الطلاب الجدد بس</div>` : ''}
            <textarea id="eq-text" rows="3" placeholder="نص السؤال" style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none;resize:vertical;direction:ltr;text-align:left;">${esc(q.text)}</textarea>
            ${!isTF ? `
                <input id="eq-a" type="text" value="${esc(opts[0]||'')}" placeholder="A" style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-b" type="text" value="${esc(opts[1]||'')}" placeholder="B" style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-c" type="text" value="${esc(opts[2]||'')}" placeholder="C" style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-d" type="text" value="${esc(opts[3]||'')}" placeholder="D" style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
            ` : ''}
            <div style="display:flex;gap:8px;margin-top:10px;">
                <select id="eq-correct" style="flex:1;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(16,185,129,.4);border-radius:8px;color:#10B981;font-family:'Cairo',sans-serif;outline:none;">
                    ${isTF
                        ? `<option value="a" ${q.correct==='a'?'selected':''}>True</option><option value="b" ${q.correct==='b'?'selected':''}>False</option>`
                        : `<option value="a" ${q.correct==='a'?'selected':''}>A</option><option value="b" ${q.correct==='b'?'selected':''}>B</option><option value="c" ${q.correct==='c'?'selected':''}>C</option><option value="d" ${q.correct==='d'?'selected':''}>D</option>`}
                </select>
                ${!isRandom ? `<input id="eq-points" type="number" value="${q.points}" min="0.25" step="0.25" style="width:90px;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-family:'Cairo',sans-serif;outline:none;text-align:center;">` : ''}
            </div>
        </div>`;

    const result = await Swal.fire({
        title: '✏️ تعديل السؤال', html, width: 620, background: '#1a2136', color: '#fff',
        showCancelButton: true, confirmButtonText: '<i class="fas fa-save"></i> حفظ', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        preConfirm: () => {
            const text = document.getElementById('eq-text').value.trim();
            if (!text) return Swal.showValidationMessage('اكتب نص السؤال');
            let options;
            if (isTF) options = ['True', 'False', '', ''];
            else {
                options = [document.getElementById('eq-a').value.trim(), document.getElementById('eq-b').value.trim(), document.getElementById('eq-c').value.trim(), document.getElementById('eq-d').value.trim()];
                if (options.some(o => !o)) return Swal.showValidationMessage('كمل كل الاختيارات');
            }
            const ptsEl = document.getElementById('eq-points');
            return { text, options, correct: document.getElementById('eq-correct').value, points: ptsEl ? (parseFloat(ptsEl.value) || 1) : (q.points || 1) };
        }
    });

    if (!result.isConfirmed) return;
    const save = await fetch('/api/quiz-edit-question', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({quiz_id: quizId, qid, ...result.value})
    });
    const sd = await save.json();
    if (sd.status === 'success') {
        Swal.fire({icon:'success', timer:800, showConfirmButton:false, background: '#1a2136', color: '#fff'});
        loadQuizzes();
        if (typeof onSuccess === 'function') onSuccess();
        else openQuizDetails(quizId);
    } else {
        Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
    }
}

/* ==========================================================
   UPLOAD / EDIT QUIZ PAGE
   ========================================================== */
window.openQuizUploadModal = async function(quizId) {
    editingQuizId = quizId;
    parsedWord = null;

    document.getElementById('quiz-list-view').style.display = 'none';
    document.getElementById('quiz-details-view').style.display = 'none';
    const uploadView = document.getElementById('quiz-upload-view');
    uploadView.style.display = 'block';

    let existingQuiz = null;
    if (quizId) {
        try {
            const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
            const d = await r.json();
            if (d.status === 'success') existingQuiz = d.quiz;
        } catch(e) {}
    }

    const subjects = await getSubjects();
    if (!subjects.length) {
        uploadView.innerHTML = `<div style="color:#f87171;text-align:center;padding:20px;">لا توجد مواد. أضف مادة أولاً.</div>`;
        return;
    }

    const preSubjectId = existingQuiz?.subject_id || currentQuizSubject?.id;
    const subOpts = subjects.map(s => `<option value="${s.id}" ${s.id === preSubjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

    uploadView.innerHTML = `
        <style>
            .uq-container { max-width: 800px; margin: 0 auto; background: var(--bg-card); padding: 30px; border-radius: 20px; border: 1px solid var(--border); }
            .uq-input { width:100%; padding:14px 18px; background:rgba(0,0,0,.5); border:1.5px solid rgba(255,255,255,.15); border-radius:12px; color:#fff; font-size:14px; font-family:'Cairo',sans-serif; margin-bottom:16px; outline:none; transition: all .3s; }
            .uq-input:focus { border-color:var(--nx-gold); box-shadow: 0 0 15px rgba(255,179,0,0.2); }
            .uq-file { padding:30px; border:2px dashed rgba(255,179,0,.5); border-radius:16px; background:rgba(255,179,0,.05); text-align:center; cursor:pointer; transition:all .25s; margin-bottom:20px; }
            .uq-file:hover { background:rgba(255,179,0,.1); border-color:#FFB300; }
            .uq-sheet-card { background:linear-gradient(160deg,rgba(20,26,40,.9),rgba(11,15,26,.96)); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:18px; margin-bottom:14px; }
            .uq-sheet-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,.08); }
            .uq-sheet-title { color:#FFD54F; font-weight:900; font-size:14px; }
            .uq-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
            .uq-grid label { display:block; font-size:11px; color:#8b93a7; margin-bottom:6px; font-weight:800; }
            .uq-num { width:100%; padding:10px; background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.15); border-radius:8px; color:#fff; font-size:13px; font-weight:800; text-align:center; outline:none; }
            .uq-btn-row { display:flex; gap:12px; margin-top:20px; }
        </style>

        <div class="uq-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; border-bottom:1px solid var(--border); padding-bottom:16px;">
                <h2 style="color:var(--nx-gold); font-size:18px; font-weight:900; margin:0;">
                    <i class="fas fa-file-word"></i> ${quizId ? 'تحديث كويز' : 'إنشاء كويز جديد'}
                </h2>
                <button class="btn btn-outline" onclick="showQuizListView()" style="padding:8px 14px;font-size:12px;">إلغاء والرجوع</button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label style="display:block; font-size:12px; color:#8b93a7; margin-bottom:6px; font-weight:800;">عنوان الكويز</label>
                    <input id="uq-title" class="uq-input" placeholder="مثال: Quiz 1" value="${esc(existingQuiz?.title || '')}">
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#8b93a7; margin-bottom:6px; font-weight:800;">المادة</label>
                    <select id="uq-subject" class="uq-input">${subOpts}</select>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                    <label style="display:block; font-size:12px; color:#8b93a7; margin-bottom:6px; font-weight:800;">المدة (بالدقائق)</label>
                    <input id="uq-duration" class="uq-input" type="number" min="1" max="300" value="${existingQuiz?.duration || 30}">
                </div>
                <div>
                    <label style="display:block; font-size:12px; color:#8b93a7; margin-bottom:6px; font-weight:800;">الملفات (Word)</label>
                    <div class="uq-file" onclick="document.getElementById('uq-file-input').click()" style="padding:14px;margin-bottom:0;">
                        <i class="fas fa-cloud-upload-alt" style="font-size:24px;color:#2B579A;margin-bottom:4px;"></i>
                        <div style="color:#fff;font-weight:900;font-size:13px;">اختر ملفات Word</div>
                        <div id="uq-filename" style="color:#FFB300;font-size:11px;margin-top:4px;font-weight:700;"></div>
                    </div>
                    <input type="file" id="uq-file-input" accept=".docx" multiple style="display:none;" onchange="handleWordFiles(this)">
                </div>
            </div>
            <div id="uq-sheets-container" style="margin-top:20px;"></div>
            <div style="margin-top:24px; padding:16px; background:rgba(6,182,212,.08); border:1px solid rgba(6,182,212,.3); border-radius:12px; font-size:12px; color:#8b93a7; line-height:1.8;">
                <b style="color:#22d3ee;">📋 صيغة Word المطلوبة:</b><br>
                <span style="font-family:monospace;color:#FFD54F;display:block;margin-top:6px;direction:ltr;text-align:left;">
1. Question text<br>A. Option 1<br>B. Option 2<br>C. Option 3<br>D. Option 4<br>Correct Answer: A
                </span>
            </div>
            <div class="uq-btn-row">
                <button class="btn btn-green" onclick="saveQuizFromUpload()" style="flex:1; padding:14px; font-size:15px; border-radius:12px;">
                    <i class="fas fa-save"></i> حفظ الكويز
                </button>
                <button class="btn btn-outline" onclick="showQuizListView()" style="flex:1; padding:14px; font-size:15px; border-radius:12px;">
                    إلغاء
                </button>
            </div>
        </div>
    `;
};

window.handleWordFiles = async function(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const invalid = files.find(f => !f.name.toLowerCase().endsWith('.docx'));
    if (invalid) return Swal.fire({icon:'error', text:'كل الملفات لازم تكون .docx', background: '#1a2136', color: '#fff'});

    const filenameEl = document.getElementById('uq-filename');
    if (filenameEl) filenameEl.textContent = `📎 ${files.length} ملف مختار`;

    const container = document.getElementById('uq-sheets-container');
    if (container) container.innerHTML = `<div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#FFB300;"></i><div style="color:#8b93a7;font-size:12px;margin-top:10px;">جاري قراءة الملفات...</div></div>`;

    try {
        const filesData = [];
        for (const file of files) {
            const b64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            filesData.push({ name: file.name, content: b64 });
        }
        const r = await fetch('/api/admin-parse-word', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ files: filesData })
        });
        const d = await r.json();
        if (d.status !== 'success') {
            container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">${esc(d.message)}</div>`;
            parsedWord = null;
            return;
        }
        parsedWord = { files: d.files };
        renderSectionsConfig(d.files);
    } catch(e) {
        container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">فشل قراءة الملفات</div>`;
        parsedWord = null;
    }
};

function renderSectionsConfig(files) {
    const container = document.getElementById('uq-sheets-container');
    const fileNames = Object.keys(files).filter(name => files[name].count > 0);
    if (!fileNames.length) {
        container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">لا توجد أسئلة صالحة</div>`;
        return;
    }
    container.innerHTML = `
        <div style="margin:14px 0 10px;color:#FFB300;font-weight:900;font-size:14px;">📑 الملفات المكتشفة (${fileNames.length})</div>
        ${fileNames.map(name => {
            const s = files[name];
            const displayName = name.replace(/\.docx$/i, '');
            return `
                <div class="uq-sheet-card" data-sheet="${esc(name)}">
                    <div class="uq-sheet-header">
                        <span class="uq-sheet-title">📄 ${esc(displayName)}</span>
                        <span style="background:rgba(16,185,129,.15);color:#6EE7B7;padding:3px 10px;border-radius:8px;font-size:11px;font-weight:800;border:1px solid rgba(16,185,129,.4);">${s.count} سؤال</span>
                    </div>
                    <div class="uq-grid">
                        <div><label>عدد الأسئلة المسحوبة</label><input type="number" class="uq-num uq-pick" min="0" max="${s.count}" value="${Math.min(10, s.count)}"></div>
                        <div><label>درجة MCQ</label><input type="number" class="uq-num uq-mcq-pts" min="0.25" step="0.25" value="1"></div>
                        <div><label>درجة T/F</label><input type="number" class="uq-num uq-tf-pts" min="0.25" step="0.25" value="1"></div>
                    </div>
                </div>`;
        }).join('')}`;
}

window.saveQuizFromUpload = async function() {
    if (!parsedWord) return Swal.fire({icon:'warning',text:'ارفع ملف Word أولاً', background: '#1a2136', color: '#fff'});
    const title = document.getElementById('uq-title').value.trim();
    const subjectId = document.getElementById('uq-subject').value;
    const duration = parseInt(document.getElementById('uq-duration').value);
    if (!title) return Swal.fire({icon:'warning',text:'اكتب عنوان الكويز', background: '#1a2136', color: '#fff'});
    if (!subjectId) return Swal.fire({icon:'warning',text:'اختر المادة', background: '#1a2136', color: '#fff'});
    if (!duration || duration < 1) return Swal.fire({icon:'warning',text:'المدة غير صالحة', background: '#1a2136', color: '#fff'});

    const sectionCards = document.querySelectorAll('.uq-sheet-card');
    if (!sectionCards.length) return Swal.fire({icon:'warning',text:'لا توجد ملفات', background: '#1a2136', color: '#fff'});

    const sectionsConfig = [];
    for (const card of sectionCards) {
        const name = card.dataset.sheet;
        const numPick = parseInt(card.querySelector('.uq-pick').value) || 0;
        const mcqPts = parseFloat(card.querySelector('.uq-mcq-pts').value) || 1;
        const tfPts = parseFloat(card.querySelector('.uq-tf-pts').value) || 1;
        if (numPick < 1) continue;
        const section = parsedWord.files[name];
        if (numPick > section.count) return Swal.fire({icon:'warning',text:`الملف "${name}" فيه ${section.count} سؤال فقط`, background: '#1a2136', color: '#fff'});
        sectionsConfig.push({ name, questions: section.questions, num_to_pick: numPick, mcq_points: mcqPts, tf_points: tfPts });
    }
    if (!sectionsConfig.length) return Swal.fire({icon:'warning',text:'حدد عدد أسئلة', background: '#1a2136', color: '#fff'});

    Swal.fire({ title: 'جاري الحفظ...', background: '#1a2136', color: '#fff', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    try {
        const r = await fetch('/api/admin-save-quiz-word', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: editingQuizId, title, subject_id: subjectId, duration, sections: sectionsConfig })
        });
        const d = await r.json();
        if (d.status === 'success') {
            Swal.fire({icon: 'success', title: 'تم الحفظ!', html: `<b style="color:#10B981">${d.questions_count}</b> سؤال · <b style="color:#FFB300">${d.total_points}</b> درجة`, timer: 1500, showConfirmButton: false, background: '#1a2136', color: '#fff'});
            showQuizListView();
        } else {
            Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) {
        Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }
};

/* ==========================================================
   OTHER ACTIONS
   ========================================================== */
window.deleteQuiz = async function(id) {
    Swal.close();
    stopQuizDetailsPoll();
    const c = await Swal.fire({
        icon: 'warning', title: 'حذف الكويز؟', text: 'هيتحذف نهائياً مع كل المحاولات والحظر',
        showCancelButton: true, confirmButtonText: '<i class="fas fa-trash"></i> حذف', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444', cancelButtonColor: '#374151', background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;
    const r = await fetch('/api/admin-delete-quiz', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id}) });
    const d = await r.json();
    if (d.status === 'success') {
        Swal.fire({icon:'success', timer:900, showConfirmButton:false, background: '#1a2136', color: '#fff'});
        showQuizListView();
    }
};

window.toggleQuizOpen = async function(id, open) {
    stopQuizDetailsPoll();
    const r = await fetch('/api/admin-toggle-quiz', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, is_open: open}) });
    const d = await r.json();
    if (d.status === 'success') {
        Swal.fire({icon:'success', title: open?'تم الفتح':'تم الإغلاق', timer:900, showConfirmButton:false, background: '#1a2136', color: '#fff'});
        openQuizDetails(id);
    }
};

window.editQuizMeta = async function(quizId) {
    Swal.close();
    stopQuizDetailsPoll();

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return Swal.fire({icon:'error', text: d.message, background:'#1a2136', color:'#fff'});
    const quiz = d.quiz;
    const subjects = await getSubjects();
    const subOpts = subjects.map(s => `<option value="${s.id}" ${s.id === quiz.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

    const result = await Swal.fire({
        title: '✏️ تعديل الكويز',
        html: `
            <div style="text-align:right;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">📝 عنوان الكويز</label>
                <input id="em-title" value="${esc(quiz.title)}" style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">📚 المادة</label>
                <select id="em-subject" style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">${subOpts}</select>
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⏱️ المدة (1-300)</label>
                <input id="em-duration" type="number" min="1" max="300" value="${quiz.duration}" style="width:100%;padding:12px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;outline:none;">
            </div>`,
        background: '#1a2136', color: '#fff', width: 500,
        showCancelButton: true, confirmButtonText: '<i class="fas fa-save"></i> حفظ', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        preConfirm: () => {
            const t = document.getElementById('em-title').value.trim();
            const s = document.getElementById('em-subject').value;
            const dur = parseInt(document.getElementById('em-duration').value);
            if (!t) return Swal.showValidationMessage('اكتب عنوان الكويز');
            if (!dur || dur < 1 || dur > 300) return Swal.showValidationMessage('المدة 1-300');
            return { title: t, subject_id: s, duration: dur };
        }
    });

    if (!result.isConfirmed) return;
    const save = await fetch('/api/admin-edit-quiz-meta', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: quizId, ...result.value }) });
    const sd = await save.json();
    if (sd.status === 'success') {
        Swal.fire({icon:'success', title:'تم الحفظ', timer:900, showConfirmButton:false, background: '#1a2136', color: '#fff'});
        openQuizDetails(quizId);
        loadQuizzes();
    } else {
        Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
    }
};

window.downloadQuizExcel = function(quizId) {
    window.location.href = `/api/quiz-excel-export?quiz_id=${encodeURIComponent(quizId)}`;
    setTimeout(() => { Swal.fire({icon: 'success', title: 'تحميل...', text: 'الملف هينزل خلال لحظات', timer: 1500, showConfirmButton: false, background: '#1a2136', color: '#fff'}); }, 300);
};

/* ==========================================================
   SCREEN PAIRING
   ========================================================== */
window.linkQuizScreen = async function(quizId, isLinked) {
    stopQuizDetailsPoll();

    if (isLinked) {
        const choice = await Swal.fire({
            title: '🖥️ الشاشة',
            html: `<div style="text-align:center;">
                <div style="width:56px;height:56px;border-radius:16px;background:rgba(16,185,129,0.15);border:2px solid rgba(16,185,129,0.5);margin:0 auto 14px;display:flex;align-items:center;justify-content:center;color:#10B981;font-size:24px;box-shadow:0 0 30px rgba(16,185,129,0.4);">
                    <i class="fas fa-check"></i>
                </div>
                <p style="color:#fff;font-size:14px;font-weight:800;margin-bottom:6px;">الشاشة مربوطة بالامتحان حالياً</p>
                <p style="color:#8b93a7;font-size:12px;">الطلاب بيشوفوا الكود على الشاشة</p>
            </div>`,
            showDenyButton: true, showCancelButton: true,
            confirmButtonText: '🔄 إعادة ربط',
            denyButtonText: '⏹️ فصل الشاشة',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#3B82F6',
            denyButtonColor: '#EF4444',
            cancelButtonColor: '#374151',
            background: '#1a2136', color: '#fff'
        });

        if (choice.isConfirmed) {
            try {
                const r = await fetch('/api/admin-toggle-quiz-broadcast', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: quizId, active: true })
                });
                const d = await r.json();
                if (d.status !== 'success') {
                    return Swal.fire({icon:'error', text: d.message, background:'#1a2136', color:'#fff'});
                }
            } catch(e) {
                return Swal.fire({icon:'error', text: 'تعذر الاتصال', background:'#1a2136', color:'#fff'});
            }
            showQuizScreenScanModal(quizId);
        } else if (choice.isDenied) {
            await unlinkQuizScreen(quizId);
        }
        return;
    }

    const c = await Swal.fire({
        icon: 'question', title: '🖥️ ربط شاشة العرض؟',
        html: `<p style="color:#fff;margin-bottom:10px;">هيتم تفعيل البث للشاشة.</p>
               <p style="color:#FFD54F;font-size:12px;">بعد كده امسح QR أو اكتب الكود اللي على الشاشة</p>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-link"></i> ربط الشاشة',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    try {
        const r = await fetch('/api/admin-toggle-quiz-broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quizId, active: true })
        });
        const d = await r.json();
        if (d.status !== 'success') {
            return Swal.fire({icon:'error', text: d.message, background:'#1a2136', color:'#fff'});
        }
    } catch(e) {
        return Swal.fire({icon:'error', text: 'تعذر الاتصال', background:'#1a2136', color:'#fff'});
    }

    showQuizScreenScanModal(quizId);
    openQuizDetails(quizId);
    loadQuizzes();
};

window.unlinkQuizScreen = async function(quizId) {
    try {
        const r = await fetch('/api/admin-toggle-quiz-broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: quizId, active: false }) });
        const d = await r.json();
        if (d.status === 'success') {
            Swal.fire({icon:'success', title:'تم فصل الشاشة', timer:1000, showConfirmButton:false, background: '#1a2136', color: '#fff'});
            openQuizDetails(quizId);
            loadQuizzes();
        } else {
            Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) { Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'}); }
};

async function showQuizScreenScanModal(quizId) {
    let qrScanner = null;

    await Swal.fire({
        title: '🖥️ ربط شاشة العرض',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <div style="text-align:center;padding:4px 0 16px;">
                    <div style="width:60px;height:60px;border-radius:18px;background:linear-gradient(135deg,rgba(6,182,212,.25),rgba(34,211,238,.15));border:2px solid rgba(6,182,212,.55);margin:0 auto 14px;display:flex;align-items:center;justify-content:center;color:#22d3ee;font-size:26px;box-shadow:0 0 40px rgba(6,182,212,.35);">
                        <i class="fas fa-qrcode"></i>
                    </div>
                    <p style="color:#8b93a7;font-size:13px;margin:0 0 12px;line-height:1.8;">
                        امسح الـ QR من شاشة العرض<br>
                        <b style="color:#FFD54F;">أو اكتب الكود اليدوي (8 خانات)</b>
                    </p>
                </div>

                <button type="button" id="quiz-scan-start-btn" onclick="startQuizAdminScan('${quizId}')"
                    style="width:100%;padding:18px;border-radius:16px;border:none;background:linear-gradient(135deg,#06B6D4,#22D3EE);color:#0a0e17;font-weight:900;font-size:15px;font-family:'Cairo',sans-serif;cursor:pointer;box-shadow:0 14px 34px rgba(6,182,212,0.4);display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px;">
                    <i class="fas fa-camera"></i> امسح الـ QR
                </button>

                <div id="quiz-scan-reader" style="display:none;margin-bottom:14px;border-radius:16px;overflow:hidden;border:2px solid rgba(6,182,212,0.4);"></div>

                <div style="display:flex;align-items:center;gap:10px;margin:18px 0;opacity:0.6;">
                    <span style="flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent);"></span>
                    <span style="color:#8b93a7;font-size:12px;font-weight:800;">أو</span>
                    <span style="flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent);"></span>
                </div>

                <p style="color:#8b93a7;font-size:12px;text-align:center;margin:0 0 8px;font-weight:800;">
                    اكتب الكود الظاهر على الشاشة
                </p>
                <input type="text" id="quiz-manual-input" placeholder="XXXXXXXX" maxlength="8"
                    autocomplete="off" spellcheck="false"
                    style="width:100%;padding:18px;background:rgba(0,0,0,0.55);border:2px solid rgba(255,179,0,0.45);border-radius:14px;color:#FFB300;font-family:'Plus Jakarta Sans',monospace;font-size:24px;font-weight:900;text-align:center;letter-spacing:6px;direction:ltr;outline:none;text-transform:uppercase;margin-bottom:10px;"
                    oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)"
                    onkeypress="if(event.key==='Enter') submitQuizManualCode('${quizId}')">

                <button type="button" onclick="submitQuizManualCode('${quizId}')"
                    style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#FFB300,#FFD54F);color:#0a0e17;font-weight:900;font-size:14px;font-family:'Cairo',sans-serif;cursor:pointer;box-shadow:0 8px 24px rgba(255,179,0,0.35);">
                    <i class="fas fa-link"></i> ربط الشاشة
                </button>

                <div id="quiz-scan-status" style="margin-top:14px;font-size:12px;font-weight:700;color:#8b93a7;min-height:20px;text-align:center;"></div>
            </div>
        `,
        background: '#1a2136', color: '#fff', width: 560,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        cancelButtonColor: '#374151',
        didOpen: () => {
            window.startQuizAdminScan = async function(qid) {
                const readerEl = document.getElementById('quiz-scan-reader');
                const btn = document.getElementById('quiz-scan-start-btn');
                const statusEl = document.getElementById('quiz-scan-status');
                if (!readerEl) return;

                if (typeof Html5Qrcode === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://unpkg.com/html5-qrcode';
                    document.head.appendChild(script);
                    await new Promise(r => script.onload = r);
                }

                if (btn) btn.style.display = 'none';
                readerEl.style.display = 'block';
                readerEl.innerHTML = `<div style="text-align:center;padding:24px;color:#22d3ee;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>جاري تشغيل الكاميرا...</div>`;
                if (statusEl) statusEl.textContent = '';

                await new Promise(r => setTimeout(r, 200));

                try {
                    readerEl.innerHTML = '';
                    if (qrScanner) { try { await qrScanner.stop(); } catch(e) {} qrScanner = null; }
                    qrScanner = new Html5Qrcode("quiz-scan-reader", { verbose: false });

                    const config = {
                        fps: 10,
                        qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; },
                        aspectRatio: 1.0
                    };

                    const onSuccess = async (decodedText) => {
                        const token = (decodedText || '').trim();
                        if (token.startsWith('SCR_')) {
                            try { await qrScanner.stop(); } catch(e) {}
                            if (statusEl) { statusEl.style.color = '#22d3ee'; statusEl.textContent = '✅ تم قراءة QR — جاري الربط...'; }
                            await pairQuizWithToken(qid, token, statusEl);
                            return;
                        }
                        const code = token.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (code.length === 8) {
                            try { await qrScanner.stop(); } catch(e) {}
                            if (statusEl) { statusEl.style.color = '#22d3ee'; statusEl.textContent = '✅ تم قراءة الكود — جاري الربط...'; }
                            const inp = document.getElementById('quiz-manual-input');
                            if (inp) inp.value = code;
                            await submitQuizManualCode(qid);
                        }
                    };

                    await qrScanner.start({ facingMode: "environment" }, config, onSuccess, () => {});
                } catch(e) {
                    readerEl.style.display = 'none';
                    if (btn) btn.style.display = 'flex';
                    if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ تعذر تشغيل الكاميرا — استخدم الكود اليدوي'; }
                }
            };

            window.submitQuizManualCode = async function(qid) {
                const inp = document.getElementById('quiz-manual-input');
                const statusEl = document.getElementById('quiz-scan-status');
                if (!inp) return;

                const code = (inp.value || '').trim().toUpperCase();
                if (code.length !== 8) {
                    if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ الكود لازم 8 خانات'; }
                    return;
                }
                if (statusEl) { statusEl.style.color = '#22d3ee'; statusEl.textContent = '⏳ جاري الربط...'; }

                try {
                    const res = await fetch('/api/quiz-screen-pair-by-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, quiz_id: qid })
                    });
                    const data = await res.json();
                    if (data.status === 'success') {
                        if (statusEl) { statusEl.style.color = '#10B981'; statusEl.textContent = '🎉 تم ربط الشاشة بنجاح!'; }
                        setTimeout(() => {
                            Swal.close();
                            openQuizDetails(qid);
                            loadQuizzes();
                        }, 1400);
                    } else {
                        if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ ' + (data.message || 'فشل الربط'); }
                    }
                } catch(e) {
                    if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ تعذر الاتصال'; }
                }
            };

            setTimeout(() => {
                const inp = document.getElementById('quiz-manual-input');
                if (inp) inp.focus();
            }, 200);
        },
        willClose: () => {
            if (qrScanner) { try { qrScanner.stop(); } catch(e) {} }
        }
    });
}

async function pairQuizWithToken(quizId, token, statusEl) {
    try {
        const res = await fetch('/api/quiz-screen-pair-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, quiz_id: quizId }) });
        const data = await res.json();
        if (data.status === 'success') {
            if (statusEl) { statusEl.style.color = '#10B981'; statusEl.textContent = '🎉 تم ربط الشاشة بالامتحان بنجاح!'; }
            setTimeout(() => { Swal.close(); openQuizDetails(quizId); loadQuizzes(); }, 1500);
        } else {
            if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ ' + (data.message || 'فشل الربط'); }
        }
    } catch (e) {
        if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = '❌ تعذر الاتصال بالسيرفر'; }
    }
}

/* ==========================================================
   ADD QUESTIONS VIA WORD (append to existing quiz)
   ========================================================== */
window.addQuizQuestionsWord = async function(quizId) {
    Swal.close();
    stopQuizDetailsPoll();

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
    const quiz = d.quiz;
    parsedWord = null;

    const html = `
        <style>
            .aqw-file { padding:22px;border:2px dashed rgba(16,185,129,.5);border-radius:14px;background:rgba(16,185,129,.05);text-align:center;cursor:pointer;transition:all .25s;margin-bottom:14px; }
            .aqw-file:hover { background:rgba(16,185,129,.1);border-color:#10B981;transform:translateY(-1px); }
            .aqw-sheet-card { background:linear-gradient(160deg,rgba(20,26,40,.9),rgba(11,15,26,.96));border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;margin-bottom:10px;text-align:right; }
            .aqw-sheet-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);gap:8px; }
            .aqw-sheet-title { color:#FFD54F;font-weight:900;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1; }
            .aqw-sheet-count { padding:3px 10px;border-radius:8px;background:rgba(16,185,129,.15);color:#6EE7B7;border:1px solid rgba(16,185,129,.4);font-size:10.5px;font-weight:800;white-space:nowrap; }
            .aqw-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }
            .aqw-grid label { display:block;font-size:10.5px;color:#8b93a7;margin-bottom:4px;font-weight:800; }
            .aqw-num { width:100%;padding:8px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-size:13px;font-weight:800;text-align:center;outline:none; }
            .aqw-section-select { width:100%;padding:9px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;font-size:12px;font-family:'Cairo',sans-serif;outline:none;margin-top:8px; }
        </style>
        <div style="text-align:right;">
            <div style="padding:10px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.4);border-radius:12px;margin-bottom:14px;color:#6EE7B7;font-size:12px;font-weight:800;text-align:center;">➕ إضافة أسئلة جديدة للكويز الحالي (مش استبدال)</div>
            <div class="aqw-file" onclick="document.getElementById('aqw-file-input').click()">
                <i class="fas fa-file-word" style="font-size:36px;color:#2B579A;margin-bottom:8px;"></i>
                <div style="color:#fff;font-weight:900;font-size:14px;">اختر ملفات Word</div>
                <div style="color:#8b93a7;font-size:11.5px;margin-top:4px;">كل ملف = شيت أسئلة منفصل</div>
                <div id="aqw-filename" style="color:#FFB300;font-size:12px;margin-top:8px;font-weight:700;"></div>
            </div>
            <input type="file" id="aqw-file-input" accept=".docx" multiple style="display:none;" onchange="handleAddWordFiles(this)">
            <div id="aqw-sheets-container"></div>
        </div>`;

    const result = await Swal.fire({
        title: '📄 إضافة أسئلة من Word', html, width: 720, background: '#1a2136', color: '#fff',
        showCancelButton: true, confirmButtonText: '<i class="fas fa-plus"></i> إضافة الأسئلة', cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        didOpen: () => {
            window.handleAddWordFiles = async function(input) {
                const files = Array.from(input.files || []);
                if (!files.length) return;
                const invalid = files.find(f => !f.name.toLowerCase().endsWith('.docx'));
                if (invalid) return Swal.fire({icon:'error', text:'كل الملفات لازم تكون .docx', background: '#1a2136', color: '#fff'});
                const filenameEl = document.getElementById('aqw-filename');
                if (filenameEl) filenameEl.textContent = `📎 ${files.length} ملف مختار`;
                const container = document.getElementById('aqw-sheets-container');
                if (container) container.innerHTML = `<div style="text-align:center;padding:30px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#10B981;"></i><div style="color:#8b93a7;font-size:12px;margin-top:10px;">جاري قراءة الملفات...</div></div>`;
                try {
                    const filesData = [];
                    for (const file of files) {
                        const b64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader(); reader.onload = e => resolve(e.target.result); reader.onerror = reject; reader.readAsDataURL(file);
                        });
                        filesData.push({ name: file.name, content: b64 });
                    }
                    const r = await fetch('/api/admin-parse-word', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ files: filesData }) });
                    const d = await r.json();
                    if (d.status !== 'success') { container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">${esc(d.message)}</div>`; parsedWord = null; return; }
                    parsedWord = { files: d.files };
                    renderAddSections(d.files, quiz);
                } catch(e) { container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">فشل قراءة الملفات</div>`; parsedWord = null; }
            };
            window.renderAddSections = function(files, quiz) {
                const container = document.getElementById('aqw-sheets-container');
                const fileNames = Object.keys(files).filter(name => files[name].count > 0);
                if (!fileNames.length) { container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">لا توجد أسئلة صالحة</div>`; return; }
                const existingSecNames = (quiz.sections_config || []).map(s => s.name);
                container.innerHTML = `<div style="margin:14px 0 8px;color:#FFB300;font-weight:900;font-size:13px;">📑 الملفات المكتشفة (${fileNames.length})</div>` +
                    fileNames.map(name => {
                        const s = files[name];
                        const displayName = name.replace(/\.docx$/i, '');
                        const secOpts = existingSecNames.map(sn => `<option value="${esc(sn)}" ${sn === displayName ? 'selected' : ''}>${esc(sn)}</option>`).join('');
                        return `<div class="aqw-sheet-card" data-sheet="${esc(name)}">
                                <div class="aqw-sheet-header"><span class="aqw-sheet-title">📄 ${esc(displayName)}</span><span class="aqw-sheet-count">${s.count} سؤال</span></div>
                                <label style="display:block;font-size:10.5px;color:#8b93a7;margin-bottom:4px;font-weight:800;">الشيت في الكويز</label>
                                <select class="aqw-section-select">${secOpts}<option value="__new__" ${!existingSecNames.includes(displayName) ? 'selected' : ''}>➕ شيت جديد: ${esc(displayName)}</option></select>
                                <div class="aqw-grid" style="margin-top:8px;">
                                    <div><label>عدد يُسحب</label><input type="number" class="aqw-num aqw-pick" min="0" max="${s.count}" value="${Math.min(10, s.count)}"></div>
                                    <div><label>درجة MCQ</label><input type="number" class="aqw-num aqw-mcq-pts" min="0.25" step="0.25" value="1"></div>
                                    <div><label>درجة T/F</label><input type="number" class="aqw-num aqw-tf-pts" min="0.25" step="0.25" value="1"></div>
                                </div>
                            </div>`;
                    }).join('');
            };
        },
        preConfirm: () => {
            if (!parsedWord) return Swal.showValidationMessage('ارفع ملف Word أولاً');
            const cards = document.querySelectorAll('.aqw-sheet-card');
            if (!cards.length) return Swal.showValidationMessage('لا توجد ملفات');
            const newSections = [];
            for (const card of cards) {
                const sheetName = card.dataset.sheet;
                const pickCount = parseInt(card.querySelector('.aqw-pick').value) || 0;
                const mcqPts = parseFloat(card.querySelector('.aqw-mcq-pts').value) || 1;
                const tfPts = parseFloat(card.querySelector('.aqw-tf-pts').value) || 1;
                const targetSection = card.querySelector('.aqw-section-select').value;
                if (pickCount < 1) continue;
                const section = parsedWord.files[sheetName];
                if (pickCount > section.count) return Swal.showValidationMessage(`الملف "${sheetName}" فيه ${section.count} سؤال فقط`);
                newSections.push({ targetSection: targetSection === '__new__' ? sheetName.replace(/\.docx$/i, '') : targetSection, questions: section.questions, num_to_pick: pickCount, mcq_points: mcqPts, tf_points: tfPts });
            }
            if (!newSections.length) return Swal.showValidationMessage('حدد عدد أسئلة');
            return { newSections };
        }
    });

    if (!result.isConfirmed) return;

    const existingSections = quiz.sections_config || [];
    const newSections = result.value.newSections;
    const combined = existingSections.map(s => ({ name: s.name, all_questions: [...(s.all_questions || [])], num_to_pick: s.num_to_pick || 0, mcq_points: s.mcq_points || 1, tf_points: s.tf_points || 1 }));

    for (const newSec of newSections) {
        const existing = combined.find(s => s.name === newSec.targetSection);
        if (existing) {
            existing.all_questions.push(...newSec.questions);
            if (existing.num_to_pick < newSec.num_to_pick) {
                existing.num_to_pick = Math.min(existing.num_to_pick + newSec.num_to_pick, existing.all_questions.length);
            }
        } else {
            combined.push({ name: newSec.targetSection, all_questions: newSec.questions, num_to_pick: Math.min(newSec.num_to_pick, newSec.questions.length), mcq_points: newSec.mcq_points, tf_points: newSec.tf_points });
        }
    }
    await saveQuizSections(quizId, quiz, combined, () => reopenQuizQuestionsTab(quizId));
};

/* ==========================================================
   TAB INTEGRATION
   ========================================================== */
const _origSwitchTab = window.switchTab;
window.switchTab = function(sec, el) {
    _origSwitchTab(sec, el);
    if (sec === 'quizzes') {
        if (currentQuizDetailsId) {
            showQuizListView();
        }
    }
};