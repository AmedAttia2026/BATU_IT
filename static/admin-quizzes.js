/* ==========================================================
   QUIZ MANAGEMENT · Sheets View + QR Pairing + Retake + Excel
   + Auto-Refresh Details Modal
   ========================================================== */

let allQuizzes = [];
let currentQuizSubject = null;
let parsedWord = null;
let editingQuizId = null;

/* ---------- Auto-refresh state ---------- */
let _qzPollInterval = null;
let _qzPollHash = '';
let _qzPollQuizId = null;

/* ---------- Helpers ---------- */
async function getSubjects() {
    try {
        if (typeof allData !== 'undefined' && allData &&
            Array.isArray(allData.subjects) && allData.subjects.length) {
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

/* ---------- Main Loader ---------- */
async function loadQuizzes() {
    const c = document.getElementById('quizzes-container');
    if (!c) return;
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

function openQuizSubject(subId, subName) {
    currentQuizSubject = { id: subId, name: subName };
    loadQuizzes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToQuizSubjects() {
    currentQuizSubject = null;
    loadQuizzes();
}

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
                    <span style="font-size:10px;padding:3px 8px;border-radius:8px;
                        background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.4);">
                        ${q.attempts_count} محاولة
                    </span>
                    ${q.broadcast_active ? `<span style="font-size:10px;padding:3px 8px;border-radius:8px;
                        background:rgba(255,179,0,.2);color:#FFD54F;border:1px solid rgba(255,179,0,.5);">
                        🖥️ متصل</span>` : ''}
                    ${q.blocked_count > 0 ? `<span style="font-size:10px;padding:3px 8px;border-radius:8px;
                        background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.5);">
                        🚫 ${q.blocked_count}</span>` : ''}
                </div>
            </div>`;
    }).join('');
}

/* ==========================================================
   🎨 QUIZ DETAILS MODAL (with auto-refresh)
   ========================================================== */
async function openQuizDetails(quizId) {
    // Stop any previous polling (in case a modal was already open)
    stopQuizDetailsPoll();

    try {
        const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
        const d = await r.json();
        if (d.status !== 'success') return Swal.fire({icon:'error',text:d.message, background:'#1a2136', color:'#fff'});

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
            const totalScores = completed.reduce((sum, a) => sum + (parseFloat(a.score) || 0), 0);
            avg = (totalScores / completed.length).toFixed(1);
        }

        // Initial hash so polling doesn't re-render immediately
        _qzPollHash = _qzAttemptsHash(attempts, blocks);
        _qzPollQuizId = quizId;

        /* ---- Students List ---- */
        const studentsHtml = qzBuildStudentsHtml(attempts, quizId);

        /* ---- Blocked List ---- */
        const blockedHtml = qzBuildBlockedHtml(blocks, quizId);

        /* ---- Questions Tab: Sheets list ---- */
        let questionsHtml = '';
        if (sectionsConfig.length === 0) {
            questionsHtml = `
                <div class="qz-empty">
                    <span class="qz-empty-icon">📝</span>
                    لا يوجد شيتات — ارفع ملف Word عشان تضيف شيت
                </div>
                <div class="qz-questions-toolbar">
                    <button class="qz-toolbar-btn green" onclick="addQuizQuestionsWord('${quiz.id}')">
                        <i class="fas fa-file-word"></i> رفع Word جديد
                    </button>
                </div>
            `;
        } else {
            questionsHtml = `
                <div class="qz-questions-toolbar">
                    <button class="qz-toolbar-btn green" onclick="addQuizQuestionsWord('${quiz.id}')">
                        <i class="fas fa-file-word"></i> رفع Word جديد
                    </button>
                </div>
                <div class="qz-sections-grid">
                    ${sectionsConfig.map((s, idx) => {
                        const totalQ = (s.all_questions || []).length;
                        const pick = s.num_to_pick || 0;
                        const safeName = esc(s.name).replace(/'/g, "\\'");
                        return `
                            <div class="qz-section-card" onclick="qzOpenSection('${quiz.id}', ${idx})">
                                <div class="qz-section-icon">📁</div>
                                <div class="qz-section-info">
                                    <div class="qz-section-name">${esc(s.name)}</div>
                                    <div class="qz-section-stats">
                                        ${totalQ} سؤال · ${pick} مسحوب · ${s.mcq_points || 1} pts MCQ · ${s.tf_points || 1} pts T/F
                                    </div>
                                </div>
                                <div class="qz-section-actions">
                                    <button class="qz-q-icon-btn" title="تعديل القسم" onclick="event.stopPropagation(); qzEditSectionMeta('${quiz.id}', ${idx})">✏️</button>
                                    <button class="qz-q-icon-btn danger" title="حذف القسم" onclick="event.stopPropagation(); qzDeleteSectionConfirm('${quiz.id}', ${idx}, '${safeName}')">🗑️</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        const html = `
            <style>
                .qz-shell { display:flex;flex-direction:column;height:640px;max-height:85vh;text-align:right;font-family:'Cairo',sans-serif; }
                .qz-top { padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:12px; }
                .qz-actions-row { display:flex;gap:6px;margin-bottom:10px;justify-content:center;flex-wrap:wrap; }
                .qz-icon-btn { width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);
                    background:rgba(255,255,255,0.05);color:#cbd5e1;cursor:pointer;font-size:14px;
                    transition:all .2s;display:flex;align-items:center;justify-content:center; }
                .qz-icon-btn:hover { background:rgba(255,179,0,0.15);border-color:rgba(255,179,0,0.4);color:#FFD54F;transform:translateY(-2px); }
                .qz-icon-btn.red:hover { background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171; }
                .qz-icon-btn.green:hover { background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.4);color:#6EE7B7; }
                .qz-icon-btn.active { background:rgba(255,179,0,0.2);border-color:#FFB300;color:#FFD54F; }
                .qz-icon-btn.cyan { background:rgba(6,182,212,0.15);border-color:rgba(6,182,212,0.5);color:#22d3ee; }
                .qz-icon-btn.cyan:hover { background:rgba(6,182,212,0.3); }
                .qz-icon-btn.linked { background:rgba(16,185,129,0.2);border-color:rgba(16,185,129,0.5);color:#10B981;animation:qzLinkPulse 2s ease-in-out infinite; }
                @keyframes qzLinkPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4);} 50%{box-shadow:0 0 0 8px rgba(16,185,129,0);} }
                .qz-title { font-size:19px;font-weight:900;color:#FFD54F;margin-bottom:3px;text-align:center; }
                .qz-meta { font-size:11.5px;color:#8b93a7;text-align:center;font-weight:700; }
                .qz-stats-row { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px; }
                .qz-stat-box { background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04));
                    border:1px solid rgba(59,130,246,0.3);border-radius:12px;padding:12px 14px;
                    display:flex;align-items:center;gap:10px; }
                .qz-stat-box.avg { background:linear-gradient(135deg,rgba(255,179,0,0.12),rgba(255,179,0,0.04));border-color:rgba(255,179,0,0.3); }
                .qz-stat-icon { font-size:24px; }
                .qz-stat-val { font-size:22px;font-weight:900;color:#60A5FA;line-height:1; }
                .qz-stat-box.avg .qz-stat-val { color:#FFD54F; }
                .qz-stat-lbl { font-size:10.5px;color:#8b93a7;font-weight:800;margin-top:2px; }
                .qz-live-dot {
                    width:7px;height:7px;border-radius:50%;background:#10B981;
                    box-shadow:0 0 10px #10B981;
                    animation:qzLiveBlink 1.6s ease-in-out infinite;
                    display:inline-block;margin-right:5px;
                }
                @keyframes qzLiveBlink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
                .qz-content { flex:1;overflow-y:auto;padding:0 4px 0 2px; }
                .qz-content::-webkit-scrollbar { width:5px; }
                .qz-content::-webkit-scrollbar-track { background:rgba(0,0,0,0.2);border-radius:4px; }
                .qz-content::-webkit-scrollbar-thumb { background:rgba(255,179,0,0.4);border-radius:4px; }
                .qz-view { display:none; }
                .qz-view.active { display:block;animation:qzFadeIn 0.3s ease; }
                @keyframes qzFadeIn { from{opacity:0;transform:translateY(5px);} to{opacity:1;transform:translateY(0);} }
                .qz-student-row { background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.06);
                    border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;transition:all .2s; }
                .qz-student-row:hover { background:rgba(0,0,0,0.45);border-color:rgba(255,179,0,0.2); }
                .qz-student-row.completed { border-right:3px solid #10B981; }
                .qz-student-row.cancelled { border-right:3px solid #EF4444; }
                .qz-student-row.in_progress { border-right:3px solid #FFB300; }
                .qz-s-avatar { width:38px;height:38px;border-radius:50%;
                    background:linear-gradient(135deg,#6366f1,#7C3AED);display:flex;align-items:center;justify-content:center;
                    font-weight:900;font-size:15px;color:#fff;flex-shrink:0; }
                .qz-student-row.cancelled .qz-s-avatar { background:linear-gradient(135deg,#EF4444,#DC2626); }
                .qz-student-row.in_progress .qz-s-avatar { background:linear-gradient(135deg,#F59E0B,#D97706); }
                .qz-s-info { flex:1;min-width:0; }
                .qz-s-name { font-size:13.5px;color:#fff;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px; }
                .qz-s-id { font-size:10.5px;color:#8b93a7;font-weight:700;font-family:'Plus Jakarta Sans',monospace; }
                .qz-s-score { text-align:center;flex-shrink:0;min-width:55px; }
                .qz-s-score-val { font-size:18px;font-weight:900;line-height:1; }
                .qz-s-score-val.good { color:#10B981; }
                .qz-s-score-val.mid { color:#FFD54F; }
                .qz-s-score-val.bad { color:#f87171; }
                .qz-s-score-val.cheat { color:#EF4444;font-size:16px; }
                .qz-s-score-val.pending { color:#6b7280;font-size:14px; }
                .qz-s-score-sub { font-size:9.5px;color:#8b93a7;font-weight:700;margin-top:2px; }

                /* 🔄 Retake button */
                .qz-retake-btn {
                    padding:7px 12px;
                    border-radius:9px;
                    border:1px solid rgba(255,179,0,0.5);
                    background:linear-gradient(135deg,rgba(255,179,0,0.18),rgba(255,179,0,0.06));
                    color:#FFD54F;
                    font-size:11px;
                    font-weight:900;
                    cursor:pointer;
                    font-family:'Cairo',sans-serif;
                    flex-shrink:0;
                    transition:all .22s ease;
                    white-space:nowrap;
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    gap:4px;
                    min-width:32px;
                }
                .qz-retake-btn i { font-size:11px; }
                .qz-retake-btn:hover {
                    background:linear-gradient(135deg,#FFB300,#FFD54F);
                    color:#0a0e17;
                    transform:translateY(-2px) scale(1.05);
                    box-shadow:0 6px 18px rgba(255,179,0,0.45);
                    border-color:#FFB300;
                }
                .qz-retake-btn:active { transform:translateY(0) scale(0.98); }

                .qz-empty { text-align:center;padding:50px 20px;color:#8b93a7;font-size:13px; }
                .qz-empty-icon { font-size:48px;opacity:0.3;margin-bottom:12px;display:block; }
                .qz-blocked-row { background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03));
                    border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:12px 14px;margin-bottom:8px;
                    display:flex;align-items:center;gap:12px; }
                .qz-blocked-row .qz-s-avatar { background:linear-gradient(135deg,#EF4444,#DC2626); }
                .qz-blocked-reason { font-size:10.5px;color:#f87171;margin-top:3px; }

                /* Questions tab */
                .qz-questions-toolbar {
                    display:flex;gap:8px;margin-bottom:14px;
                    padding:10px;background:rgba(6,182,212,0.05);
                    border:1px solid rgba(6,182,212,0.2);border-radius:10px;
                }
                .qz-toolbar-btn {
                    flex:1;padding:10px 14px;border-radius:8px;
                    border:1px solid rgba(255,255,255,0.15);
                    background:rgba(0,0,0,0.3);color:#dfe4ee;
                    font-family:'Cairo',sans-serif;font-size:12px;font-weight:800;
                    cursor:pointer;transition:all .2s;
                    display:flex;align-items:center;justify-content:center;gap:6px;
                }
                .qz-toolbar-btn.green {
                    background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.08));
                    border-color:rgba(16,185,129,0.4);color:#6EE7B7;
                }
                .qz-toolbar-btn.green:hover { background:rgba(16,185,129,0.3);transform:translateY(-1px); }

                .qz-sections-grid {
                    display:flex;flex-direction:column;gap:8px;
                }
                .qz-section-card {
                    background:linear-gradient(135deg,rgba(20,26,42,0.7),rgba(11,15,26,0.9));
                    border:1px solid rgba(255,255,255,0.08);
                    border-radius:12px;padding:14px 16px;
                    display:flex;align-items:center;gap:12px;
                    cursor:pointer;transition:all .2s;
                }
                .qz-section-card:hover {
                    border-color:rgba(255,179,0,0.4);
                    background:linear-gradient(135deg,rgba(30,40,60,0.8),rgba(15,20,32,0.95));
                    transform:translateX(-3px);
                }
                .qz-section-icon {
                    width:42px;height:42px;border-radius:10px;
                    background:linear-gradient(135deg,rgba(255,179,0,0.2),rgba(255,179,0,0.05));
                    border:1.5px solid rgba(255,179,0,0.4);
                    display:flex;align-items:center;justify-content:center;
                    font-size:20px;flex-shrink:0;
                }
                .qz-section-info { flex:1;min-width:0; }
                .qz-section-name {
                    font-size:13.5px;font-weight:900;color:#fff;margin-bottom:3px;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                }
                .qz-section-stats { font-size:11px;color:#8b93a7;font-weight:700; }
                .qz-section-actions { display:flex;gap:4px;flex-shrink:0; }
                .qz-q-icon-btn {
                    width:32px;height:32px;border-radius:8px;
                    border:1px solid rgba(255,255,255,0.15);
                    background:rgba(255,255,255,0.05);color:#cbd5e1;
                    cursor:pointer;font-size:13px;
                    display:flex;align-items:center;justify-content:center;
                    transition:all .2s;
                }
                .qz-q-icon-btn:hover {
                    background:rgba(255,179,0,0.15);border-color:rgba(255,179,0,0.4);color:#FFD54F;
                    transform:translateY(-1px);
                }
                .qz-q-icon-btn.danger:hover {
                    background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;
                }

                .qz-bottom-nav { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px;
                    padding-top:14px;border-top:1px solid rgba(255,255,255,0.08); }
                .qz-nav-btn { padding:11px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);
                    background:rgba(0,0,0,0.3);color:#8b93a7;cursor:pointer;font-family:'Cairo',sans-serif;
                    font-weight:800;font-size:11px;display:flex;flex-direction:column;align-items:center;gap:3px;
                    transition:all .25s;position:relative; }
                .qz-nav-btn:hover { color:#fff;background:rgba(255,255,255,0.06); }
                .qz-nav-btn.active { background:linear-gradient(135deg,rgba(255,179,0,0.22),rgba(255,179,0,0.08));
                    border-color:rgba(255,179,0,0.5);color:#FFD54F;box-shadow:0 0 20px rgba(255,179,0,0.2); }
                .qz-nav-icon { font-size:18px;line-height:1; }
                .qz-nav-badge { position:absolute;top:5px;left:8px;background:#EF4444;color:#fff;font-size:9px;
                    font-weight:900;min-width:18px;height:18px;border-radius:9px;padding:0 5px;
                    display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(239,68,68,0.5); }
            </style>

            <div class="qz-shell">
                <div class="qz-top">
                    <div class="qz-actions-row">
                        <button class="qz-icon-btn" onclick="editQuizMeta('${quiz.id}')" title="تعديل">✏️</button>
                        <button class="qz-icon-btn ${quiz.is_open ? 'red' : 'green'}"
                                onclick="toggleQuizOpen('${quiz.id}', ${!quiz.is_open})"
                                title="${quiz.is_open ? 'إغلاق' : 'فتح'}">
                            ${quiz.is_open ? '🔒' : '🔓'}
                        </button>
                        <button class="qz-icon-btn ${isLinked ? 'linked' : 'cyan'}"
                                onclick="linkQuizScreen('${quiz.id}', ${isLinked})"
                                title="${isLinked ? 'الشاشة مربوطة' : 'ربط الشاشة'}">
                            🖥️
                        </button>
                        <button class="qz-icon-btn" onclick="downloadQuizExcel('${quiz.id}')" title="إكسل">📊</button>
                        <button class="qz-icon-btn red" onclick="deleteQuiz('${quiz.id}')" title="حذف">🗑️</button>
                    </div>
                    <div class="qz-title">${esc(quiz.title)}</div>
                    <div class="qz-meta">
                        <span class="qz-live-dot" title="يتحدث تلقائياً"></span>
                        📚 ${esc(quiz.subject_name || '')} · ⏱️ ${quiz.duration} دقيقة · ${expectedQ} سؤال
                        ${isRandom ? ` · <span style="color:#A78BFA;">🎲 عشوائي</span>` : ''}
                        ${isLinked ? ` · <span style="color:#10B981;">🖥️ الشاشة مربوطة</span>` : ''}
                    </div>
                </div>

                <div class="qz-stats-row">
                    <div class="qz-stat-box">
                        <div class="qz-stat-icon">👥</div>
                        <div>
                            <div class="qz-stat-val" data-qz-attempts="${quiz.id}">${attempts.length}</div>
                            <div class="qz-stat-lbl">طالب دخل</div>
                        </div>
                    </div>
                    <div class="qz-stat-box avg">
                        <div class="qz-stat-icon">📊</div>
                        <div>
                            <div class="qz-stat-val" data-qz-avg="${quiz.id}">${avg}</div>
                            <div class="qz-stat-lbl">متوسط الدرجات</div>
                        </div>
                    </div>
                </div>

                <div class="qz-content">
                    <div class="qz-view active" id="qz-view-students-${quiz.id}">${studentsHtml}</div>
                    <div class="qz-view" id="qz-view-blocked-${quiz.id}">${blockedHtml}</div>
                    <div class="qz-view" id="qz-view-questions-${quiz.id}">${questionsHtml}</div>
                </div>

                <div class="qz-bottom-nav" data-quiz="${quiz.id}">
                    <button class="qz-nav-btn active" onclick="qzNavSwitch('${quiz.id}', 'students', this)">
                        <span class="qz-nav-icon">👥</span><span>الطلاب</span>
                    </button>
                    <button class="qz-nav-btn" onclick="qzNavSwitch('${quiz.id}', 'blocked', this)">
                        <span class="qz-nav-icon">🚫</span><span>المحظورين</span>
                        ${blockedCount > 0 ? `<span class="qz-nav-badge">${blockedCount}</span>` : ''}
                    </button>
                    <button class="qz-nav-btn" onclick="qzNavSwitch('${quiz.id}', 'questions', this)">
                        <span class="qz-nav-icon">📝</span><span>الأسئلة</span>
                    </button>
                </div>
            </div>
        `;

        await Swal.fire({
            html, width: 700, background: '#1a2136', color: '#fff',
            showConfirmButton: false,
            showCancelButton: true, cancelButtonText: 'إغلاق',
            cancelButtonColor: '#374151', padding: '18px 22px',
            didOpen: () => {
                // ✅ Start auto-refresh polling
                _qzPollInterval = setInterval(() => {
                    _qzRefreshQuizDetails(quizId);
                }, 2000);
            },
            willClose: () => {
                stopQuizDetailsPoll();
            }
        });
    } catch(e) {
        console.error(e);
        Swal.fire({icon:'error', text:'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }
}

/* ==========================================================
   🔄 AUTO-REFRESH HELPERS
   ========================================================== */

function stopQuizDetailsPoll() {
    if (_qzPollInterval) {
        clearInterval(_qzPollInterval);
        _qzPollInterval = null;
    }
    _qzPollQuizId = null;
    _qzPollHash = '';
}

function _qzAttemptsHash(attempts, blocks) {
    const atk = (attempts || []).map(a =>
        `${a.attempt_id || ''}|${a.status || ''}|${a.score ?? ''}|${a.total_points ?? ''}`
    ).join('~');
    const blk = (blocks || []).map(b => `${b.student_id || ''}|${b.reason || ''}`).join(',');
    return atk + '||' + blk;
}

function qzBuildStudentsHtml(attempts, quizId) {
    if (!attempts || attempts.length === 0) {
        return `<div class="qz-empty"><span class="qz-empty-icon">📭</span>لا يوجد طلاب دخلوا الامتحان بعد</div>`;
    }
    return attempts.map(a => {
        const st = a.status;
        const avatarText = (a.student_name || '?').trim().charAt(0).toUpperCase();
        const safeName = esc(a.student_name || '').replace(/'/g, "\\'");
        let scoreHtml = '';
        if (st === 'completed') {
            const score = parseFloat(a.score) || 0;
            const total = parseFloat(a.total_points) || 1;
            const pct = (score / total) * 100;
            const cls = pct >= 70 ? 'good' : (pct >= 50 ? 'mid' : 'bad');
            scoreHtml = `<div class="qz-s-score">
                <div class="qz-s-score-val ${cls}">${score}</div>
                <div class="qz-s-score-sub">من ${total}</div>
            </div>`;
        } else if (st === 'cancelled') {
            scoreHtml = `<div class="qz-s-score">
                <div class="qz-s-score-val cheat">غش</div>
                <div class="qz-s-score-sub">🚫</div>
            </div>`;
        } else {
            scoreHtml = `<div class="qz-s-score">
                <div class="qz-s-score-val pending">—</div>
                <div class="qz-s-score-sub">جاري</div>
            </div>`;
        }
        return `<div class="qz-student-row ${st}">
            <div class="qz-s-avatar">${esc(avatarText)}</div>
            <div class="qz-s-info">
                <div class="qz-s-name">${esc(a.student_name || 'غير معروف')}</div>
                <div class="qz-s-id">${a.student_id}</div>
            </div>
            ${scoreHtml}
            <button class="qz-retake-btn" onclick="event.stopPropagation(); retakeStudent('${quizId}','${a.student_id}','${safeName}')" title="إعادة الامتحان للطالب">
                <i class="fas fa-redo"></i>
            </button>
        </div>`;
    }).join('');
}

function qzBuildBlockedHtml(blocks, quizId) {
    if (!blocks || blocks.length === 0) {
        return `<div class="qz-empty"><span class="qz-empty-icon">✅</span>لا يوجد محظورين — كل الطلاب بخير</div>`;
    }
    return blocks.map(b => {
        const avatarText = (b.student_name || '?').trim().charAt(0).toUpperCase();
        const safeName = esc(b.student_name || '').replace(/'/g, "\\'");
        return `<div class="qz-blocked-row">
            <div class="qz-s-avatar">${esc(avatarText)}</div>
            <div class="qz-s-info">
                <div class="qz-s-name">${esc(b.student_name || 'غير معروف')}</div>
                <div class="qz-s-id">${b.student_id}</div>
                <div class="qz-blocked-reason">🚫 ${esc(b.reason || '')}</div>
            </div>
            <button class="qz-retake-btn" onclick="event.stopPropagation(); retakeStudent('${quizId}','${b.student_id}','${safeName}')">
                🔄 إعادة
            </button>
        </div>`;
    }).join('');
}

async function _qzRefreshQuizDetails(quizId) {
    // Safety: don't run if the modal isn't for this quiz anymore
    if (_qzPollQuizId !== quizId) return;

    try {
        const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
        const d = await r.json();
        if (d.status !== 'success') return;

        const attempts = d.attempts || [];
        const blocks = d.blocks || [];

        const newHash = _qzAttemptsHash(attempts, blocks);
        if (newHash === _qzPollHash) return; // no changes → skip DOM update

        _qzPollHash = newHash;

        // Update students view
        const studentsEl = document.getElementById(`qz-view-students-${quizId}`);
        const blockedEl = document.getElementById(`qz-view-blocked-${quizId}`);

        // Preserve scroll position of the content container
        const contentEl = document.querySelector(`#qz-view-students-${quizId}`)?.closest('.qz-content');
        const oldScrollTop = contentEl ? contentEl.scrollTop : 0;

        if (studentsEl) studentsEl.innerHTML = qzBuildStudentsHtml(attempts, quizId);
        if (blockedEl) blockedEl.innerHTML = qzBuildBlockedHtml(blocks, quizId);

        // Restore scroll
        if (contentEl) contentEl.scrollTop = oldScrollTop;

        // Update stats
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

        // Update blocked count badge on nav button
        const blockedBtn = document.querySelector(`.qz-bottom-nav[data-quiz="${quizId}"] .qz-nav-btn:nth-child(2)`);
        if (blockedBtn) {
            const existingBadge = blockedBtn.querySelector('.qz-nav-badge');
            if (blocks.length > 0) {
                if (existingBadge) {
                    existingBadge.textContent = blocks.length;
                } else {
                    const span = document.createElement('span');
                    span.className = 'qz-nav-badge';
                    span.textContent = blocks.length;
                    blockedBtn.appendChild(span);
                }
            } else if (existingBadge) {
                existingBadge.remove();
            }
        }
    } catch (e) {
        // Silent fail — next poll will retry
    }
}

/* ==========================================================
   🧭 NAVIGATION SWITCH (bottom tabs)
   ========================================================== */
window.qzNavSwitch = function(quizId, viewName, btn) {
    document.querySelectorAll(`[id^="qz-view-"][id$="-${quizId}"]`).forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`qz-view-${viewName}-${quizId}`);
    if (view) view.classList.add('active');
    const nav = btn.closest('.qz-bottom-nav');
    if (nav) {
        nav.querySelectorAll('.qz-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const content = view?.closest('.qz-content');
    if (content) content.scrollTop = 0;
};

/* ==========================================================
   🧭 NAVIGATION HELPERS
   ========================================================== */
async function reopenQuizQuestionsTab(quizId) {
    Swal.close();
    await new Promise(r => setTimeout(r, 150));
    await openQuizDetails(quizId);
    await new Promise(r => setTimeout(r, 200));
    const btn = document.querySelector(`.qz-bottom-nav[data-quiz="${quizId}"] .qz-nav-btn:nth-child(3)`);
    if (btn) qzNavSwitch(quizId, 'questions', btn);
}

async function reopenQuizDetails(quizId) {
    Swal.close();
    await new Promise(r => setTimeout(r, 150));
    await openQuizDetails(quizId);
}

/* ==========================================================
   🔄 RETAKE STUDENT — reset attempt + unblock (if any)
   ========================================================== */
async function retakeStudent(quizId, studentId, studentName) {
    Swal.close();
    await new Promise(r => setTimeout(r, 100));

    const c = await Swal.fire({
        icon: 'question',
        title: '🔄 إعادة الامتحان؟',
        html: `
            <div style="text-align:center;font-family:'Cairo',sans-serif;line-height:1.8;">
                <p style="color:#fff;margin-bottom:10px;">
                    هيتم حذف محاولة الطالب السابقة نهائياً
                </p>
                <p style="color:#FFD54F;font-weight:900;font-size:16px;margin-bottom:14px;
                    padding:8px 14px;background:rgba(255,179,0,0.1);
                    border:1px solid rgba(255,179,0,0.3);border-radius:10px;
                    display:inline-block;">
                    ${esc(studentName || studentId)}
                </p>
                <div style="padding:10px 14px;background:rgba(6,182,212,0.08);
                    border:1px solid rgba(6,182,212,0.3);border-radius:10px;
                    font-size:12px;color:#22d3ee;text-align:right;margin-top:8px;">
                    <i class="fas fa-info-circle"></i>
                    الطالب هيرجع يقدر يدخل الامتحان من الأول
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

    Swal.fire({
        title: 'جاري الإعادة...',
        background: '#1a2136', color: '#fff',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const r = await fetch('/api/admin-quiz-retake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quiz_id: quizId,
                student_id: studentId
            })
        });
        const d = await r.json();

        if (d.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'تمت الإعادة',
                html: `<p style="color:#6EE7B7;font-weight:800;">${esc(studentName || studentId)}</p>
                       <p style="color:#8b93a7;font-size:12px;margin-top:6px;">
                           الطالب يقدر يدخل الامتحان من جديد
                       </p>`,
                timer: 1400,
                showConfirmButton: false,
                background: '#1a2136', color: '#fff'
            });
            setTimeout(() => openQuizDetails(quizId), 1500);
            loadQuizzes();
        } else {
            Swal.fire({
                icon: 'error',
                text: d.message || 'فشلت الإعادة',
                background: '#1a2136', color: '#fff'
            });
        }
    } catch(e) {
        Swal.fire({
            icon: 'error',
            text: 'تعذر الاتصال بالسيرفر',
            background: '#1a2136', color: '#fff'
        });
    }
}

/* 🔁 Backward compatibility */
async function unblockStudent(quizId, studentId) {
    return retakeStudent(quizId, studentId, studentId);
}

/* ==========================================================
   📁 SECTION VIEW — questions inside a sheet
   ========================================================== */
window.qzOpenSection = async function(quizId, sectionIndex) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const section = sections[sectionIndex];
    if (!section) return;

    const isTF = (q) => q.type === 'tf';

    const questionsListHtml = (section.all_questions || []).length === 0
        ? `<div class="sq-empty">📭 لا يوجد أسئلة في هذا الشيت</div>`
        : section.all_questions.map((q, idx) => {
            const opts = q.options || [];
            const correctIdx = ['a','b','c','d'].indexOf(q.correct);
            const optCount = isTF(q) ? 2 : opts.length;
            const optsHtml = opts.slice(0, optCount).map((opt, i) => {
                if (!opt) return '';
                const letter = String.fromCharCode(65 + i);
                const isC = i === correctIdx;
                return `<div class="sq-opt ${isC ? 'correct' : ''}">
                    <span class="sq-opt-letter">${letter}</span>
                    <span class="sq-opt-text">${esc(opt)}</span>
                    ${isC ? '<span style="color:#10B981;font-weight:900;font-size:11px;">✓</span>' : ''}
                </div>`;
            }).join('');

            return `<div class="sq-q-card">
                <div class="sq-q-head">
                    <span class="sq-q-num">Q${idx + 1}</span>
                    <span class="sq-q-type ${isTF(q) ? 'tf' : 'mcq'}">${isTF(q) ? 'T/F' : 'MCQ'}</span>
                    <div class="sq-q-actions">
                        <button title="تعديل" onclick="qzEditQuestionInSection('${quizId}', ${sectionIndex}, ${idx})">✏️</button>
                        <button class="danger" title="حذف" onclick="qzDeleteQuestionInSection('${quizId}', ${sectionIndex}, ${idx})">🗑️</button>
                    </div>
                </div>
                <div class="sq-q-text">${esc(q.text)}</div>
                <div class="sq-q-opts">${optsHtml}</div>
            </div>`;
        }).join('');

    Swal.fire({
        html: `
            <style>
                .sq-shell { display:flex;flex-direction:column;height:640px;max-height:85vh;font-family:'Cairo',sans-serif;text-align:right; }
                .sq-head { padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:12px; }
                .sq-title {
                    font-size:18px;font-weight:900;color:#FFD54F;margin-bottom:4px;text-align:center;
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                }
                .sq-meta {
                    font-size:11.5px;color:#8b93a7;text-align:center;font-weight:700;margin-bottom:10px;
                }
                .sq-toolbar { display:flex;gap:6px;justify-content:center;flex-wrap:wrap; }
                .sq-toolbar button {
                    padding:7px 14px;border-radius:8px;
                    border:1px solid rgba(255,255,255,0.15);
                    background:rgba(0,0,0,0.3);color:#dfe4ee;
                    font-family:'Cairo',sans-serif;font-size:12px;font-weight:800;
                    cursor:pointer;transition:all .2s;
                }
                .sq-toolbar button:hover { background:rgba(255,255,255,0.08);transform:translateY(-1px); }
                .sq-toolbar button.green {
                    background:rgba(16,185,129,0.15);border-color:rgba(16,185,129,0.4);color:#6EE7B7;
                }
                .sq-toolbar button.green:hover { background:rgba(16,185,129,0.3); }
                .sq-toolbar button.red {
                    background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;
                }
                .sq-toolbar button.red:hover { background:rgba(239,68,68,0.3); }

                .sq-questions { flex:1;overflow-y:auto;padding:0 4px 0 2px; }
                .sq-questions::-webkit-scrollbar { width:5px; }
                .sq-questions::-webkit-scrollbar-track { background:rgba(0,0,0,0.2);border-radius:4px; }
                .sq-questions::-webkit-scrollbar-thumb { background:rgba(255,179,0,0.4);border-radius:4px; }

                .sq-q-card {
                    background:rgba(20,26,42,0.6);border:1px solid rgba(255,255,255,0.06);
                    border-radius:10px;padding:12px 14px;margin-bottom:8px;transition:all .2s;
                }
                .sq-q-card:hover { border-color:rgba(255,179,0,0.25); }
                .sq-q-head { display:flex;align-items:center;gap:8px;margin-bottom:8px; }
                .sq-q-num {
                    font-family:'Plus Jakarta Sans',monospace;font-size:11px;font-weight:900;
                    padding:3px 10px;border-radius:6px;background:rgba(255,179,0,0.15);
                    color:#FFD54F;border:1px solid rgba(255,179,0,0.4);
                }
                .sq-q-type {
                    font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px;
                    background:rgba(139,92,246,0.15);color:#a78bfa;
                    border:1px solid rgba(139,92,246,0.4);text-transform:uppercase;
                }
                .sq-q-type.tf {
                    background:rgba(6,182,212,0.15);color:#22d3ee;
                    border-color:rgba(6,182,212,0.4);
                }
                .sq-q-actions { margin-left:auto;display:flex;gap:4px; }
                .sq-q-actions button {
                    width:28px;height:28px;border-radius:6px;
                    border:1px solid rgba(255,255,255,0.15);
                    background:rgba(255,255,255,0.05);color:#cbd5e1;
                    cursor:pointer;font-size:11px;
                    display:flex;align-items:center;justify-content:center;
                    transition:all .2s;
                }
                .sq-q-actions button:hover {
                    background:rgba(255,179,0,0.15);border-color:rgba(255,179,0,0.4);color:#FFD54F;
                }
                .sq-q-actions button.danger:hover {
                    background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);color:#f87171;
                }

                .sq-q-text {
                    color:#fff;font-size:13px;font-weight:700;line-height:1.55;
                    margin-bottom:8px;direction:ltr;text-align:left;
                }
                .sq-q-opts { display:flex;flex-direction:column;gap:4px; }
                .sq-opt {
                    display:flex;align-items:center;gap:8px;
                    padding:5px 10px;border-radius:6px;
                    background:rgba(0,0,0,0.3);
                    border:1px solid rgba(255,255,255,0.05);
                    font-size:12px;color:#cbd5e1;
                    direction:ltr;text-align:left;
                }
                .sq-opt.correct {
                    background:rgba(16,185,129,0.12);
                    border-color:rgba(16,185,129,0.4);
                    color:#6EE7B7;font-weight:700;
                }
                .sq-opt-letter {
                    width:20px;height:20px;border-radius:4px;
                    background:rgba(255,255,255,0.06);
                    border:1px solid rgba(255,255,255,0.1);
                    display:flex;align-items:center;justify-content:center;
                    font-size:9px;font-weight:900;
                    font-family:'Plus Jakarta Sans',monospace;color:#94a3b8;flex-shrink:0;
                }
                .sq-opt.correct .sq-opt-letter {
                    background:#10B981;color:#fff;border-color:#10B981;
                }
                .sq-opt-text { flex:1;overflow:hidden;text-overflow:ellipsis; }

                .sq-empty {
                    text-align:center;padding:50px 20px;color:#8b93a7;font-size:13px;
                }

                .sq-footer {
                    padding-top:12px;margin-top:12px;
                    border-top:1px solid rgba(255,255,255,0.08);text-align:center;
                }
                .sq-footer .back {
                    background:transparent;border:1px solid rgba(255,255,255,0.2);
                    color:#cbd5e1;padding:9px 20px;border-radius:8px;
                    font-family:'Cairo',sans-serif;font-size:12px;font-weight:800;
                    cursor:pointer;transition:all .2s;
                }
                .sq-footer .back:hover {
                    background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.35);
                }
            </style>

            <div class="sq-shell">
                <div class="sq-head">
                    <div class="sq-title">📁 ${esc(section.name)}</div>
                    <div class="sq-meta">
                        ${(section.all_questions || []).length} سؤال · ${section.num_to_pick || 0} مسحوب
                        · ${section.mcq_points || 1} pts MCQ · ${section.tf_points || 1} pts T/F
                    </div>
                    <div class="sq-toolbar">
                        <button onclick="qzEditSectionMeta('${quizId}', ${sectionIndex})">
                            ✏️ تعديل القسم
                        </button>
                        <button class="green" onclick="qzAddQuestionToSection('${quizId}', ${sectionIndex})">
                            ➕ إضافة سؤال
                        </button>
                        <button class="red" onclick="qzDeleteSectionConfirm('${quizId}', ${sectionIndex}, '${esc(section.name).replace(/'/g, "\\'")}')">
                            🗑️ حذف الشيت
                        </button>
                    </div>
                </div>

                <div class="sq-questions">
                    ${questionsListHtml}
                </div>

                <div class="sq-footer">
                    <button class="back" onclick="reopenQuizQuestionsTab('${quizId}')">
                        ← رجوع للشيتات
                    </button>
                </div>
            </div>
        `,
        width: 720,
        background: '#1a2136', color: '#fff',
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        cancelButtonColor: '#374151',
        padding: '18px 22px',
        willClose: () => {
            setTimeout(() => loadQuizzes(), 200);
        }
    });
};

/* ==========================================================
   ✏️ EDIT SECTION META
   ========================================================== */
window.qzEditSectionMeta = async function(quizId, sectionIndex) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

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
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">

                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">
                    🎯 عدد الأسئلة المسحوبة (من ${totalQ})
                </label>
                <input id="sec-pick" type="number" min="1" max="${totalQ}" value="${section.num_to_pick || totalQ}"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:6px;outline:none;">
                <p style="font-size:11px;color:#8b93a7;margin-bottom:12px;">
                    الطالب هيشوف ${section.num_to_pick || totalQ} سؤال عشوائي من أصل ${totalQ}
                </p>

                <div style="display:flex;gap:10px;">
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⭐ درجة MCQ</label>
                        <input id="sec-mcq" type="number" min="0.25" step="0.25" value="${section.mcq_points || 1}"
                            style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                            border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                            font-size:13px;font-family:'Cairo',sans-serif;outline:none;text-align:center;">
                    </div>
                    <div style="flex:1;">
                        <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⭐ درجة T/F</label>
                        <input id="sec-tf" type="number" min="0.25" step="0.25" value="${section.tf_points || 1}"
                            style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                            border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                            font-size:13px;font-family:'Cairo',sans-serif;outline:none;text-align:center;">
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
            return {
                ...s,
                name: result.value.name,
                num_to_pick: result.value.pick,
                mcq_points: result.value.mcq,
                tf_points: result.value.tf
            };
        }
        return s;
    });

    await saveQuizSections(quizId, quiz, newSections,
        () => qzOpenSection(quizId, sectionIndex)
    );
};

/* ==========================================================
   🗑️ DELETE SECTION
   ========================================================== */
window.qzDeleteSectionConfirm = async function(quizId, sectionIndex, sectionName) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

    const c = await Swal.fire({
        icon: 'warning',
        title: 'حذف الشيت؟',
        html: `<div style="text-align:center;">
            <p style="color:#fff;margin-bottom:10px;">هيتم حذف الشيت كامل مع كل أسئلته:</p>
            <p style="color:#FFD54F;font-weight:900;font-size:14px;padding:8px 14px;
                background:rgba(255,179,0,.1);border-radius:10px;display:inline-block;">
                ${esc(sectionName)}
            </p>
        </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const newSections = sections.filter((_, i) => i !== sectionIndex);

    if (newSections.length === 0) {
        return Swal.fire({
            icon: 'error',
            title: 'لا يمكن حذف آخر شيت',
            text: 'الكويز لازم يكون فيه شيت واحد على الأقل. احذف الكويز كامل لو مش عايزه.',
            background: '#1a2136', color: '#fff'
        });
    }

    await saveQuizSections(quizId, quiz, newSections,
        () => reopenQuizQuestionsTab(quizId)
    );
};

/* ==========================================================
   ➕ ADD QUESTION to a section
   ========================================================== */
window.qzAddQuestionToSection = async function(quizId, sectionIndex) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

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
                <div style="padding:8px 12px;background:rgba(6,182,212,0.08);
                    border:1px solid rgba(6,182,212,0.3);border-radius:10px;
                    margin-bottom:12px;font-size:12px;color:#22d3ee;font-weight:800;">
                    📁 ${esc(section.name)} — ${(section.all_questions || []).length} سؤال موجود
                </div>

                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">نوع السؤال</label>
                <select id="new-q-type" onchange="qzToggleNewQType()"
                    style="width:100%;padding:11px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none;">
                    <option value="mcq">MCQ</option>
                    <option value="tf">True / False</option>
                </select>

                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">نص السؤال</label>
                <textarea id="new-q-text" rows="3" placeholder="Type the question..."
                    style="width:100%;padding:11px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none;
                    resize:vertical;direction:ltr;text-align:left;"></textarea>

                <div id="new-q-opts-mcq">
                    <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;font-weight:800;">الاختيارات</label>
                    <input id="new-q-a" type="text" placeholder="A) ..."
                        style="width:100%;padding:10px;background:rgba(0,0,0,.5);
                        border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;
                        margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-b" type="text" placeholder="B) ..."
                        style="width:100%;padding:10px;background:rgba(0,0,0,.5);
                        border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;
                        margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-c" type="text" placeholder="C) ..."
                        style="width:100%;padding:10px;background:rgba(0,0,0,.5);
                        border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;
                        margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                    <input id="new-q-d" type="text" placeholder="D) ..."
                        style="width:100%;padding:10px;background:rgba(0,0,0,.5);
                        border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;
                        margin-bottom:6px;font-family:'Cairo',sans-serif;font-size:12.5px;outline:none;direction:ltr;">
                </div>

                <label style="display:block;font-size:11.5px;color:#8b93a7;margin-bottom:6px;margin-top:10px;font-weight:800;">الإجابة الصحيحة</label>
                <select id="new-q-correct"
                    style="width:100%;padding:11px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(16,185,129,.4);border-radius:10px;color:#10B981;
                    font-size:13px;font-family:'Cairo',sans-serif;outline:none;">
                    <option value="a">A / True</option>
                    <option value="b">B / False</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                </select>
            </div>
        `,
        background: '#1a2136', color: '#fff', width: 520,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        didOpen: () => {
            window.qzToggleNewQType = function() {
                const type = document.getElementById('new-q-type').value;
                const mcqBox = document.getElementById('new-q-opts-mcq');
                const correctSel = document.getElementById('new-q-correct');
                if (!mcqBox || !correctSel) return;
                if (type === 'tf') {
                    mcqBox.style.display = 'none';
                    correctSel.innerHTML = `
                        <option value="a">A / True</option>
                        <option value="b">B / False</option>`;
                } else {
                    mcqBox.style.display = 'block';
                    correctSel.innerHTML = `
                        <option value="a">A</option>
                        <option value="b">B</option>
                        <option value="c">C</option>
                        <option value="d">D</option>`;
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
            text: result.value.text,
            type: result.value.type,
            options: result.value.options,
            correct: result.value.correct
        }],
        num_to_pick: Math.max(section.num_to_pick || 0, 1)
    };

    const newSections = sections.map((s, i) => i === sectionIndex ? updatedSection : s);

    await saveQuizSections(quizId, quiz, newSections,
        () => qzOpenSection(quizId, sectionIndex)
    );
};

/* ==========================================================
   ✏️ EDIT / DELETE QUESTION inside section
   ========================================================== */
window.qzEditQuestionInSection = async function(quizId, sectionIndex, qIdx) {
    stopQuizDetailsPoll();
    const qid = `s${sectionIndex}_q${qIdx}`;
    await editQuizQuestion(quizId, qid, () => qzOpenSection(quizId, sectionIndex));
};

window.qzDeleteQuestionInSection = async function(quizId, sectionIndex, qIdx) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return;
    const quiz = d.quiz;
    const sections = quiz.sections_config || [];
    const section = sections[sectionIndex];
    if (!section || !section.all_questions[qIdx]) return;

    const q = section.all_questions[qIdx];

    const c = await Swal.fire({
        icon: 'warning',
        title: 'حذف السؤال؟',
        html: `<div style="text-align:right;">
            <div style="direction:ltr;text-align:left;font-size:12px;color:#8b93a7;
                padding:10px;background:rgba(0,0,0,0.3);border-radius:8px;margin-bottom:10px;">
                ${esc(q.text).substring(0, 120)}${q.text.length > 120 ? '...' : ''}
            </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    const newQuestions = [...(section.all_questions || [])];
    newQuestions.splice(qIdx, 1);

    let newSections;
    if (newQuestions.length === 0) {
        newSections = sections.filter((_, i) => i !== sectionIndex);
        if (newSections.length === 0) {
            return Swal.fire({
                icon: 'error',
                title: 'لا يمكن حذف آخر سؤال',
                text: 'الكويز لازم يكون فيه سؤال واحد على الأقل',
                background: '#1a2136', color: '#fff'
            });
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
        ? () => qzOpenSection(quizId, sectionIndex)
        : () => reopenQuizQuestionsTab(quizId);

    await saveQuizSections(quizId, quiz, newSections, returnFn);
};

/* ==========================================================
   💾 SAVE SECTIONS
   ========================================================== */
async function saveQuizSections(quizId, quiz, sections, onSuccess) {
    const sectionsConfig = sections.map(s => {
        const totalQ = (s.all_questions || []).length;
        let pick = s.num_to_pick || totalQ;
        if (pick < 1) pick = totalQ;
        if (pick > totalQ) pick = totalQ;
        return {
            name: s.name,
            questions: s.all_questions,
            num_to_pick: pick,
            mcq_points: s.mcq_points || 1,
            tf_points: s.tf_points || 1
        };
    });

    Swal.fire({
        title: 'جاري الحفظ...',
        background: '#1a2136', color: '#fff',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const save = await fetch('/api/admin-save-quiz-word', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: quizId,
                title: quiz.title,
                subject_id: quiz.subject_id,
                duration: quiz.duration,
                sections: sectionsConfig
            })
        });
        const sd = await save.json();
        if (sd.status === 'success') {
            Swal.fire({
                icon: 'success', title: 'تم الحفظ',
                timer: 800, showConfirmButton: false,
                background: '#1a2136', color: '#fff'
            });
            setTimeout(() => {
                loadQuizzes();
                if (typeof onSuccess === 'function') onSuccess();
                else openQuizDetails(quizId);
            }, 850);
        } else {
            Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) {
        Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }
}

/* ==========================================================
   🖥️ QUIZ SCREEN PAIRING
   ========================================================== */
async function linkQuizScreen(quizId, isLinked) {
    stopQuizDetailsPoll();

    if (isLinked) {
        const choice = await Swal.fire({
            title: '🖥️ الشاشة',
            html: `
                <div style="text-align:center;">
                    <div style="width:56px;height:56px;border-radius:16px;
                        background:rgba(16,185,129,0.15);border:2px solid rgba(16,185,129,0.5);
                        margin:0 auto 14px;display:flex;align-items:center;justify-content:center;
                        color:#10B981;font-size:24px;box-shadow:0 0 30px rgba(16,185,129,0.4);">
                        <i class="fas fa-check"></i>
                    </div>
                    <p style="color:#fff;font-size:14px;font-weight:800;margin-bottom:6px;">الشاشة مربوطة بالامتحان حالياً</p>
                    <p style="color:#8b93a7;font-size:12px;">الطلاب بيشوفوا الكود على الشاشة</p>
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: '🔄 إعادة ربط',
            denyButtonText: '⏹️ فصل الشاشة',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#3B82F6',
            denyButtonColor: '#EF4444',
            cancelButtonColor: '#374151',
            background: '#1a2136', color: '#fff'
        });

        if (choice.isConfirmed) {
            window.open('/dis', '_blank');
            setTimeout(() => showQuizScreenScanModal(quizId), 2000);
        } else if (choice.isDenied) {
            await unlinkQuizScreen(quizId);
        }
        return;
    }

    const c = await Swal.fire({
        icon: 'question',
        title: '🖥️ ربط شاشة العرض؟',
        html: `
            <p style="color:#fff;margin-bottom:10px;">سيتم فتح شاشة العرض في تبويب جديد.</p>
            <p style="color:#FFD54F;font-size:12px;">بعد فتح الشاشة، امسح QR منها بموبايلك أو الصق الكود يدوياً</p>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-desktop"></i> فتح وربط',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;

    try {
        const r = await fetch('/api/admin-toggle-quiz-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quizId, active: true })
        });
        const d = await r.json();
        if (d.status !== 'success') {
            return Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) {
        return Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }

    window.open('/dis', '_blank');
    setTimeout(() => showQuizScreenScanModal(quizId), 2000);
    setTimeout(() => openQuizDetails(quizId), 1200);
    loadQuizzes();
}

async function unlinkQuizScreen(quizId) {
    try {
        const r = await fetch('/api/admin-toggle-quiz-broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: quizId, active: false })
        });
        const d = await r.json();
        if (d.status === 'success') {
            Swal.fire({
                icon:'success', title:'تم فصل الشاشة', timer:1000, showConfirmButton:false,
                background: '#1a2136', color: '#fff'
            });
            setTimeout(() => openQuizDetails(quizId), 1100);
            loadQuizzes();
        } else {
            Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
        }
    } catch(e) {
        Swal.fire({icon:'error', text: 'تعذر الاتصال', background: '#1a2136', color: '#fff'});
    }
}

async function showQuizScreenScanModal(quizId) {
    let qrScanner = null;
    let manualVisible = false;

    await Swal.fire({
        title: '🖥️ ربط شاشة العرض',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <div style="text-align:center;padding:4px 0 16px;">
                    <div style="width:60px;height:60px;border-radius:18px;
                        background:linear-gradient(135deg,rgba(6,182,212,.25),rgba(34,211,238,.15));
                        border:2px solid rgba(6,182,212,.55);margin:0 auto 14px;
                        display:flex;align-items:center;justify-content:center;
                        color:#22d3ee;font-size:26px;box-shadow:0 0 40px rgba(6,182,212,.35);">
                        <i class="fas fa-qrcode"></i>
                    </div>
                    <p style="color:#8b93a7;font-size:13px;margin:0 0 4px;line-height:1.8;">
                        افتح <b style="color:#22d3ee;font-family:monospace;">/dis</b> في تبويب،<br>
                        ثم امسح QR الظاهر على الشاشة بموبايلك.
                    </p>
                </div>

                <button type="button" id="quiz-scan-start-btn" onclick="startQuizAdminScan('${quizId}')"
                    style="width:100%;padding:20px;border-radius:16px;
                    border:none;background:linear-gradient(135deg,#06B6D4,#22D3EE);
                    color:#0a0e17;font-weight:900;font-size:16px;
                    font-family:'Cairo',sans-serif;cursor:pointer;
                    box-shadow:0 14px 34px rgba(6,182,212,0.4);
                    display:flex;align-items:center;justify-content:center;gap:10px;">
                    <i class="fas fa-camera"></i> امسح QR الشاشة
                </button>

                <div id="quiz-scan-reader" style="display:none;margin-top:14px;
                    border-radius:16px;overflow:hidden;border:2px solid rgba(6,182,212,0.4);"></div>

                <div id="quiz-scan-status" style="
                    margin-top:14px;font-size:12px;font-weight:700;
                    color:#8b93a7;min-height:20px;text-align:center;"></div>

                <div style="margin-top:20px;padding-top:20px;border-top:1px dashed rgba(255,255,255,0.1);">
                    <p style="color:#6b7385;font-size:11.5px;text-align:center;margin:0 0 10px;">
                        أو استخدم الكود اليدوي
                    </p>
                    <button type="button" onclick="toggleQuizManual()"
                        style="width:100%;background:transparent;
                        border:1px dashed rgba(255,179,0,0.4);color:#FFB300;
                        padding:10px 16px;border-radius:10px;font-size:12px;font-weight:800;
                        font-family:'Cairo',sans-serif;cursor:pointer;
                        display:flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="fas fa-keyboard"></i> إظهار الإدخال اليدوي
                    </button>

                    <div id="quiz-manual-box" style="display:none;margin-top:12px;">
                        <p style="color:#8b93a7;font-size:11.5px;text-align:center;margin:0 0 8px;">
                            انسخ الكود من تحت QR على الشاشة (SCR_...) والصقه هنا:
                        </p>
                        <input type="text" id="quiz-manual-input"
                            placeholder="SCR_xxxxxxxxxxxxxxxx"
                            style="width:100%;padding:14px;background:rgba(0,0,0,0.55);
                            border:2px solid rgba(255,179,0,0.4);border-radius:12px;color:#FFB300;
                            font-family:monospace;font-size:14px;font-weight:900;
                            text-align:center;outline:none;letter-spacing:1px;
                            direction:ltr;margin-bottom:10px;">
                        <button type="button" onclick="submitQuizManualCode('${quizId}')"
                            style="width:100%;padding:14px;border-radius:12px;border:none;
                            background:linear-gradient(135deg,#FFB300,#FFD54F);
                            color:#0a0e17;font-weight:900;font-size:14px;
                            font-family:'Cairo',sans-serif;cursor:pointer;
                            box-shadow:0 8px 24px rgba(255,179,0,0.35);">
                            <i class="fas fa-link"></i> ربط الشاشة
                        </button>
                    </div>
                </div>
            </div>
        `,
        background: '#1a2136', color: '#fff',
        width: 560,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        cancelButtonColor: '#374151',
        didOpen: () => {
            window.toggleQuizManual = function() {
                manualVisible = !manualVisible;
                const box = document.getElementById('quiz-manual-box');
                if (box) box.style.display = manualVisible ? 'block' : 'none';
                if (manualVisible) {
                    setTimeout(() => {
                        const inp = document.getElementById('quiz-manual-input');
                        if (inp) inp.focus();
                    }, 100);
                }
            };

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
                readerEl.innerHTML = `<div style="text-align:center;padding:24px;color:#22d3ee;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i><br><br>جاري تشغيل الكاميرا...
                </div>`;
                if (statusEl) statusEl.textContent = '';

                await new Promise(r => setTimeout(r, 200));

                try {
                    readerEl.innerHTML = '';
                    if (qrScanner) {
                        try { await qrScanner.stop(); } catch(e) {}
                        qrScanner = null;
                    }
                    qrScanner = new Html5Qrcode("quiz-scan-reader", { verbose: false });

                    const config = {
                        fps: 10,
                        qrbox: (w, h) => {
                            const size = Math.floor(Math.min(w, h) * 0.7);
                            return { width: size, height: size };
                        },
                        aspectRatio: 1.0
                    };

                    const onSuccess = async (decodedText) => {
                        const token = (decodedText || '').trim();
                        if (!token.startsWith('SCR_')) {
                            if (statusEl) {
                                statusEl.style.color = '#f87171';
                                statusEl.textContent = '❌ مش QR صحيح من شاشة العرض';
                            }
                            return;
                        }

                        try { await qrScanner.stop(); } catch(e) {}
                        if (statusEl) {
                            statusEl.style.color = '#22d3ee';
                            statusEl.textContent = '✅ تم قراءة QR — جاري الربط...';
                        }

                        await pairQuizWithToken(qid, token, statusEl);
                    };

                    await qrScanner.start(
                        { facingMode: "environment" },
                        config,
                        onSuccess,
                        () => {}
                    );
                } catch(e) {
                    readerEl.style.display = 'none';
                    if (btn) btn.style.display = 'flex';
                    if (statusEl) {
                        statusEl.style.color = '#f87171';
                        statusEl.textContent = '❌ تعذر تشغيل الكاميرا — استخدم الكود اليدوي';
                    }
                }
            };

            window.submitQuizManualCode = async function(qid) {
                const inp = document.getElementById('quiz-manual-input');
                const statusEl = document.getElementById('quiz-scan-status');
                if (!inp) return;
                const token = (inp.value || '').trim();

                if (!token.startsWith('SCR_')) {
                    if (statusEl) {
                        statusEl.style.color = '#f87171';
                        statusEl.textContent = '❌ الكود لازم يبدأ بـ SCR_';
                    }
                    return;
                }

                if (statusEl) {
                    statusEl.style.color = '#22d3ee';
                    statusEl.textContent = '⏳ جاري الربط...';
                }

                await pairQuizWithToken(qid, token, statusEl);
            };
        },
        willClose: () => {
            if (qrScanner) {
                try { qrScanner.stop(); } catch(e) {}
            }
        }
    });
}

async function pairQuizWithToken(quizId, token, statusEl) {
    try {
        const res = await fetch('/api/quiz-screen-pair-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, quiz_id: quizId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            if (statusEl) {
                statusEl.style.color = '#10B981';
                statusEl.textContent = '🎉 تم ربط الشاشة بالامتحان بنجاح!';
            }
            setTimeout(() => {
                Swal.close();
                openQuizDetails(quizId);
                loadQuizzes();
            }, 1500);
        } else {
            if (statusEl) {
                statusEl.style.color = '#f87171';
                statusEl.textContent = '❌ ' + (data.message || 'فشل الربط');
            }
        }
    } catch (e) {
        if (statusEl) {
            statusEl.style.color = '#f87171';
            statusEl.textContent = '❌ تعذر الاتصال بالسيرفر';
        }
    }
}

/* ==========================================================
   ✏️ EDIT QUIZ META
   ========================================================== */
async function editQuizMeta(quizId) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return Swal.fire({icon:'error', text: d.message, background:'#1a2136', color:'#fff'});
    const quiz = d.quiz;
    const subjects = await getSubjects();

    const subOpts = subjects.map(s =>
        `<option value="${s.id}" ${s.id === quiz.subject_id ? 'selected' : ''}>${esc(s.name)}</option>`
    ).join('');

    const result = await Swal.fire({
        title: '✏️ تعديل الكويز',
        html: `
            <div style="text-align:right;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">📝 عنوان الكويز</label>
                <input id="em-title" value="${esc(quiz.title)}"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">📚 المادة</label>
                <select id="em-subject"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:12px;outline:none;">
                    ${subOpts}
                </select>
                <label style="display:block;font-size:12px;color:#8b93a7;margin-bottom:6px;font-weight:800;">⏱️ المدة (1-300)</label>
                <input id="em-duration" type="number" min="1" max="300" value="${quiz.duration}"
                    style="width:100%;padding:12px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                    font-size:13px;font-family:'Cairo',sans-serif;outline:none;">
            </div>`,
        background: '#1a2136', color: '#fff', width: 500,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
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
    const save = await fetch('/api/admin-edit-quiz-meta', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id: quizId, ...result.value })
    });
    const sd = await save.json();
    if (sd.status === 'success') {
        Swal.fire({icon:'success', title:'تم الحفظ', timer:900, showConfirmButton:false,
            background: '#1a2136', color: '#fff'});
        setTimeout(() => openQuizDetails(quizId), 1000);
        loadQuizzes();
    } else {
        Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
    }
}

/* ==========================================================
   📊 EXCEL EXPORT
   ========================================================== */
function downloadQuizExcel(quizId) {
    window.location.href = `/api/quiz-excel-export?quiz_id=${encodeURIComponent(quizId)}`;
    setTimeout(() => {
        Swal.fire({icon: 'success', title: 'تحميل...', text: 'الملف هينزل خلال لحظات',
            timer: 1500, showConfirmButton: false,
            background: '#1a2136', color: '#fff'});
    }, 300);
}

/* ==========================================================
   ✏️ EDIT SINGLE QUESTION (internal, with callback)
   ========================================================== */
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
            ${isRandom ? `<div style="padding:8px 12px;background:rgba(139,92,246,.15);
                border:1px solid rgba(139,92,246,.4);border-radius:10px;margin-bottom:10px;
                font-size:11px;color:#a78bfa;font-weight:800;">
                🎲 وضع عشوائي — التعديل هيأثر على الطلاب الجدد بس
            </div>` : ''}
            <textarea id="eq-text" rows="3" placeholder="نص السؤال"
                style="width:100%;padding:10px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);
                border-radius:10px;color:#fff;font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;
                outline:none;resize:vertical;direction:ltr;text-align:left;">${esc(q.text)}</textarea>
            ${!isTF ? `
                <input id="eq-a" type="text" value="${esc(opts[0]||'')}" placeholder="A"
                    style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);
                    border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-b" type="text" value="${esc(opts[1]||'')}" placeholder="B"
                    style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);
                    border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-c" type="text" value="${esc(opts[2]||'')}" placeholder="C"
                    style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);
                    border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
                <input id="eq-d" type="text" value="${esc(opts[3]||'')}" placeholder="D"
                    style="width:100%;padding:9px;background:rgba(0,0,0,.5);border:1.5px solid rgba(255,255,255,.15);
                    border-radius:8px;color:#fff;margin-bottom:6px;font-family:'Cairo',sans-serif;outline:none;direction:ltr;">
            ` : ''}
            <div style="display:flex;gap:8px;margin-top:10px;">
                <select id="eq-correct" style="flex:1;padding:9px;background:rgba(0,0,0,.5);
                    border:1.5px solid rgba(16,185,129,.4);border-radius:8px;color:#10B981;
                    font-family:'Cairo',sans-serif;outline:none;">
                    ${isTF
                        ? `<option value="a" ${q.correct==='a'?'selected':''}>True</option>
                           <option value="b" ${q.correct==='b'?'selected':''}>False</option>`
                        : `<option value="a" ${q.correct==='a'?'selected':''}>A</option>
                           <option value="b" ${q.correct==='b'?'selected':''}>B</option>
                           <option value="c" ${q.correct==='c'?'selected':''}>C</option>
                           <option value="d" ${q.correct==='d'?'selected':''}>D</option>`}
                </select>
                ${!isRandom ? `
                    <input id="eq-points" type="number" value="${q.points}" min="0.25" step="0.25"
                        style="width:90px;padding:9px;background:rgba(0,0,0,.5);
                        border:1.5px solid rgba(255,255,255,.15);border-radius:8px;color:#fff;
                        font-family:'Cairo',sans-serif;outline:none;text-align:center;">
                ` : ''}
            </div>
        </div>`;

    const result = await Swal.fire({
        title: '✏️ تعديل السؤال', html, width: 620,
        background: '#1a2136', color: '#fff',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        preConfirm: () => {
            const text = document.getElementById('eq-text').value.trim();
            if (!text) return Swal.showValidationMessage('اكتب نص السؤال');
            let options;
            if (isTF) options = ['True', 'False', '', ''];
            else {
                options = [
                    document.getElementById('eq-a').value.trim(),
                    document.getElementById('eq-b').value.trim(),
                    document.getElementById('eq-c').value.trim(),
                    document.getElementById('eq-d').value.trim()
                ];
                if (options.some(o => !o)) return Swal.showValidationMessage('كمل كل الاختيارات');
            }
            const ptsEl = document.getElementById('eq-points');
            return { text, options,
                     correct: document.getElementById('eq-correct').value,
                     points: ptsEl ? (parseFloat(ptsEl.value) || 1) : (q.points || 1) };
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
        setTimeout(() => {
            loadQuizzes();
            if (typeof onSuccess === 'function') onSuccess();
            else openQuizDetails(quizId);
        }, 900);
    } else {
        Swal.fire({icon:'error', text: sd.message, background: '#1a2136', color: '#fff'});
    }
}

/* ==========================================================
   ACTIONS
   ========================================================== */
async function deleteQuiz(id) {
    Swal.close();
    stopQuizDetailsPoll();
    const c = await Swal.fire({
        icon: 'warning', title: 'حذف الكويز؟',
        text: 'هيتحذف نهائياً مع كل المحاولات والحظر',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444', cancelButtonColor: '#374151',
        background: '#1a2136', color: '#fff'
    });
    if (!c.isConfirmed) return;
    const r = await fetch('/api/admin-delete-quiz', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id})
    });
    const d = await r.json();
    if (d.status === 'success') {
        Swal.fire({icon:'success', timer:900, showConfirmButton:false, background: '#1a2136', color: '#fff'});
        loadQuizzes();
    }
}

async function toggleQuizOpen(id, open) {
    stopQuizDetailsPoll();
    const r = await fetch('/api/admin-toggle-quiz', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({id, is_open: open})
    });
    const d = await r.json();
    if (d.status === 'success') {
        Swal.fire({icon:'success', title: open?'تم الفتح':'تم الإغلاق', timer:900,
            showConfirmButton:false, background: '#1a2136', color: '#fff'});
        loadQuizzes();
    }
}

/* ==========================================================
   📄 WORD UPLOAD (Create new quiz OR fully replace existing)
   ========================================================== */
async function openQuizUploadModal(quizId) {
    editingQuizId = quizId;
    parsedWord = null;
    stopQuizDetailsPoll();

    let existingQuiz = null;
    if (quizId) {
        try {
            const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
            const d = await r.json();
            if (d.status === 'success') existingQuiz = d.quiz;
        } catch(e) {}
    }

    const subjects = await getSubjects();
    if (!subjects.length) return Swal.fire({icon:'warning',text:'لا توجد مواد', background: '#1a2136', color: '#fff'});

    const preSubjectId = existingQuiz?.subject_id || currentQuizSubject?.id;
    const subOpts = subjects.map(s =>
        `<option value="${s.id}" ${s.id === preSubjectId ? 'selected' : ''}>${esc(s.name)}</option>`
    ).join('');

    const html = `
        <style>
            .uq-input { width:100%;padding:11px 14px;background:rgba(0,0,0,.5);
                border:1.5px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;
                font-size:13px;font-family:'Cairo',sans-serif;margin-bottom:10px;outline:none; }
            .uq-input:focus { border-color:#FFB300;box-shadow:0 0 0 3px rgba(255,179,0,.15); }
            .uq-file { padding:22px;border:2px dashed rgba(255,179,0,.5);border-radius:14px;
                background:rgba(255,179,0,.05);text-align:center;cursor:pointer;transition:all .25s;margin-bottom:14px; }
            .uq-file:hover { background:rgba(255,179,0,.1);border-color:#FFB300;transform:translateY(-1px); }
            .uq-sheet-card { background:linear-gradient(160deg,rgba(20,26,40,.9),rgba(11,15,26,.96));
                border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;margin-bottom:10px;text-align:right; }
            .uq-sheet-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;
                padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);gap:8px; }
            .uq-sheet-title { color:#FFD54F;font-weight:900;font-size:13px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap;flex:1; }
            .uq-sheet-count { padding:3px 10px;border-radius:8px;background:rgba(16,185,129,.15);
                color:#6EE7B7;border:1px solid rgba(16,185,129,.4);font-size:10.5px;font-weight:800;white-space:nowrap; }
            .uq-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }
            .uq-grid label { display:block;font-size:10.5px;color:#8b93a7;margin-bottom:4px;font-weight:800; }
            .uq-num { width:100%;padding:8px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);
                border-radius:8px;color:#fff;font-size:13px;font-weight:800;text-align:center;outline:none; }
        </style>
        <div style="text-align:right;">
            <input id="uq-title" class="uq-input" placeholder="عنوان الكويز" value="${esc(existingQuiz?.title || '')}">
            <select id="uq-subject" class="uq-input">${subOpts}</select>
            <input id="uq-duration" class="uq-input" type="number" min="1" max="300"
                placeholder="المدة (دقائق)" value="${existingQuiz?.duration || 30}">

            <div class="uq-file" onclick="document.getElementById('uq-file-input').click()">
                <i class="fas fa-file-word" style="font-size:36px;color:#2B579A;margin-bottom:8px;"></i>
                <div style="color:#fff;font-weight:900;font-size:14px;">اختر ملفات Word</div>
                <div style="color:#8b93a7;font-size:11.5px;margin-top:4px;">كل ملف = شيت أسئلة منفصل</div>
                <div id="uq-filename" style="color:#FFB300;font-size:12px;margin-top:8px;font-weight:700;"></div>
            </div>
            <input type="file" id="uq-file-input" accept=".docx" multiple style="display:none;" onchange="handleWordFiles(this)">
            <div id="uq-sheets-container"></div>

            <div style="margin-top:14px;padding:12px;background:rgba(6,182,212,.08);
                 border:1px solid rgba(6,182,212,.3);border-radius:12px;font-size:11.5px;
                 color:#8b93a7;line-height:1.8;text-align:right;">
                <b style="color:#22d3ee;">📋 صيغة Word:</b><br>
                <span style="font-family:monospace;color:#FFD54F;display:block;margin-top:6px;line-height:1.9;direction:ltr;text-align:left;">
1. Question text<br>A. Option 1<br>B. Option 2<br>C. Option 3<br>D. Option 4<br>Correct Answer: A
                </span>
                <div style="margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.1);">
                <b style="color:#10B981;">أو True/False:</b><br>
                <span style="font-family:monospace;color:#FFD54F;direction:ltr;text-align:left;display:block;">1. Question<br>True</span>
                </div>
            </div>
        </div>`;

    const result = await Swal.fire({
        title: quizId ? '🔄 تحديث كويز' : '📄 رفع كويز من Word',
        html, width: 740, background: '#1a2136', color: '#fff',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ الكويز',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981', cancelButtonColor: '#374151',
        preConfirm: () => {
            if (!parsedWord) return Swal.showValidationMessage('ارفع ملف Word أولاً');
            const title = document.getElementById('uq-title').value.trim();
            const subjectId = document.getElementById('uq-subject').value;
            const duration = parseInt(document.getElementById('uq-duration').value);
            if (!title) return Swal.showValidationMessage('اكتب عنوان الكويز');
            if (!subjectId) return Swal.showValidationMessage('اختر المادة');
            if (!duration || duration < 1) return Swal.showValidationMessage('المدة غير صالحة');

            const sectionCards = document.querySelectorAll('.uq-sheet-card');
            if (!sectionCards.length) return Swal.showValidationMessage('لا توجد ملفات');

            const sectionsConfig = [];
            for (const card of sectionCards) {
                const name = card.dataset.sheet;
                const numPick = parseInt(card.querySelector('.uq-pick').value) || 0;
                const mcqPts = parseFloat(card.querySelector('.uq-mcq-pts').value) || 1;
                const tfPts = parseFloat(card.querySelector('.uq-tf-pts').value) || 1;
                if (numPick < 1) continue;
                const section = parsedWord.files[name];
                if (numPick > section.count) {
                    return Swal.showValidationMessage(`الملف "${name}" فيه ${section.count} سؤال فقط`);
                }
                sectionsConfig.push({ name, questions: section.questions,
                                      num_to_pick: numPick, mcq_points: mcqPts, tf_points: tfPts });
            }
            if (!sectionsConfig.length) return Swal.showValidationMessage('حدد عدد أسئلة');

            return { id: editingQuizId, title, subject_id: subjectId, duration, sections: sectionsConfig };
        }
    });

    if (!result.isConfirmed) return;
    const r = await fetch('/api/admin-save-quiz-word', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(result.value)
    });
    const d = await r.json();
    if (d.status === 'success') {
        Swal.fire({icon: 'success', title: 'تم الحفظ!',
            html: `<b style="color:#10B981">${d.questions_count}</b> سؤال · <b style="color:#FFB300">${d.total_points}</b> درجة`,
            timer: 1500, showConfirmButton: false,
            background: '#1a2136', color: '#fff'});
        loadQuizzes();
    } else {
        Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
    }
}

async function handleWordFiles(input) {
    const files = Array.from(input.files || []);
    if (!files.length) return;
    const invalid = files.find(f => !f.name.toLowerCase().endsWith('.docx'));
    if (invalid) return Swal.fire({icon:'error', text:'كل الملفات لازم تكون .docx', background: '#1a2136', color: '#fff'});

    const filenameEl = document.getElementById('uq-filename');
    if (filenameEl) filenameEl.textContent = `📎 ${files.length} ملف مختار`;

    const container = document.getElementById('uq-sheets-container');
    if (container) container.innerHTML = `<div style="text-align:center;padding:30px;">
        <i class="fas fa-spinner fa-spin fa-2x" style="color:#FFB300;"></i>
        <div style="color:#8b93a7;font-size:12px;margin-top:10px;">جاري قراءة الملفات...</div></div>`;

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
            container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
                background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">${esc(d.message)}</div>`;
            parsedWord = null;
            return;
        }

        parsedWord = { files: d.files };
        renderSectionsConfig(d.files);
    } catch(e) {
        container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
            background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">
            فشل قراءة الملفات — تأكد من الصيغة</div>`;
        parsedWord = null;
    }
}

function renderSectionsConfig(files) {
    const container = document.getElementById('uq-sheets-container');
    const fileNames = Object.keys(files).filter(name => files[name].count > 0);

    if (!fileNames.length) {
        container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
            background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">
            لا توجد أسئلة صالحة</div>`;
        return;
    }

    container.innerHTML = `
        <div style="margin:14px 0 8px;color:#FFB300;font-weight:900;font-size:13px;">
            📑 الملفات المكتشفة (${fileNames.length})
        </div>
        ${fileNames.map(name => {
            const s = files[name];
            const displayName = name.replace(/\.docx$/i, '');
            return `
                <div class="uq-sheet-card" data-sheet="${esc(name)}">
                    <div class="uq-sheet-header">
                        <span class="uq-sheet-title">📄 ${esc(displayName)}</span>
                        <span class="uq-sheet-count">${s.count} سؤال</span>
                    </div>
                    <div class="uq-grid">
                        <div><label>عدد الأسئلة</label>
                            <input type="number" class="uq-num uq-pick" min="0" max="${s.count}" value="${Math.min(10, s.count)}">
                        </div>
                        <div><label>درجة MCQ</label>
                            <input type="number" class="uq-num uq-mcq-pts" min="0.25" step="0.25" value="1">
                        </div>
                        <div><label>درجة T/F</label>
                            <input type="number" class="uq-num uq-tf-pts" min="0.25" step="0.25" value="1">
                        </div>
                    </div>
                </div>`;
        }).join('')}`;
}

/* ==========================================================
   📄 ADD QUESTIONS VIA WORD (append to existing quiz)
   ========================================================== */
async function addQuizQuestionsWord(quizId) {
    Swal.close();
    stopQuizDetailsPoll();
    await new Promise(r => setTimeout(r, 120));

    const r = await fetch(`/api/admin-quiz-details?id=${encodeURIComponent(quizId)}`);
    const d = await r.json();
    if (d.status !== 'success') return Swal.fire({icon:'error', text: d.message, background: '#1a2136', color: '#fff'});
    const quiz = d.quiz;

    parsedWord = null;

    const html = `
        <style>
            .aqw-file { padding:22px;border:2px dashed rgba(16,185,129,.5);border-radius:14px;
                background:rgba(16,185,129,.05);text-align:center;cursor:pointer;transition:all .25s;margin-bottom:14px; }
            .aqw-file:hover { background:rgba(16,185,129,.1);border-color:#10B981;transform:translateY(-1px); }
            .aqw-sheet-card { background:linear-gradient(160deg,rgba(20,26,40,.9),rgba(11,15,26,.96));
                border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;margin-bottom:10px;text-align:right; }
            .aqw-sheet-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;
                padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);gap:8px; }
            .aqw-sheet-title { color:#FFD54F;font-weight:900;font-size:13px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap;flex:1; }
            .aqw-sheet-count { padding:3px 10px;border-radius:8px;background:rgba(16,185,129,.15);
                color:#6EE7B7;border:1px solid rgba(16,185,129,.4);font-size:10.5px;font-weight:800;white-space:nowrap; }
            .aqw-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px; }
            .aqw-grid label { display:block;font-size:10.5px;color:#8b93a7;margin-bottom:4px;font-weight:800; }
            .aqw-num { width:100%;padding:8px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);
                border-radius:8px;color:#fff;font-size:13px;font-weight:800;text-align:center;outline:none; }
            .aqw-section-select { width:100%;padding:9px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.15);
                border-radius:8px;color:#fff;font-size:12px;font-family:'Cairo',sans-serif;outline:none;margin-top:8px; }
        </style>
        <div style="text-align:right;">
            <div style="padding:10px 14px;background:rgba(16,185,129,0.1);
                border:1px solid rgba(16,185,129,0.4);border-radius:12px;margin-bottom:14px;
                color:#6EE7B7;font-size:12px;font-weight:800;text-align:center;">
                ➕ إضافة أسئلة جديدة للكويز الحالي (مش استبدال)
            </div>

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
        title: '📄 إضافة أسئلة من Word',
        html, width: 720, background: '#1a2136', color: '#fff',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus"></i> إضافة الأسئلة',
        cancelButtonText: 'إلغاء',
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
                if (container) container.innerHTML = `<div style="text-align:center;padding:30px;">
                    <i class="fas fa-spinner fa-spin fa-2x" style="color:#10B981;"></i>
                    <div style="color:#8b93a7;font-size:12px;margin-top:10px;">جاري قراءة الملفات...</div></div>`;

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
                        container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
                            background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">${esc(d.message)}</div>`;
                        parsedWord = null;
                        return;
                    }

                    parsedWord = { files: d.files };
                    renderAddSections(d.files, quiz);
                } catch(e) {
                    container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
                        background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">
                        فشل قراءة الملفات</div>`;
                    parsedWord = null;
                }
            };

            window.renderAddSections = function(files, quiz) {
                const container = document.getElementById('aqw-sheets-container');
                const fileNames = Object.keys(files).filter(name => files[name].count > 0);

                if (!fileNames.length) {
                    container.innerHTML = `<div style="color:#f87171;padding:14px;text-align:center;
                        background:rgba(239,68,68,.1);border-radius:12px;font-size:12px;">
                        لا توجد أسئلة صالحة</div>`;
                    return;
                }

                const existingSecNames = (quiz.sections_config || []).map(s => s.name);

                container.innerHTML = `
                    <div style="margin:14px 0 8px;color:#FFB300;font-weight:900;font-size:13px;">
                        📑 الملفات المكتشفة (${fileNames.length})
                    </div>
                    ${fileNames.map(name => {
                        const s = files[name];
                        const displayName = name.replace(/\.docx$/i, '');
                        const secOpts = existingSecNames.map(sn => 
                            `<option value="${esc(sn)}" ${sn === displayName ? 'selected' : ''}>${esc(sn)}</option>`
                        ).join('');
                        return `
                            <div class="aqw-sheet-card" data-sheet="${esc(name)}">
                                <div class="aqw-sheet-header">
                                    <span class="aqw-sheet-title">📄 ${esc(displayName)}</span>
                                    <span class="aqw-sheet-count">${s.count} سؤال</span>
                                </div>
                                <label style="display:block;font-size:10.5px;color:#8b93a7;margin-bottom:4px;font-weight:800;">الشيت في الكويز</label>
                                <select class="aqw-section-select">
                                    ${secOpts}
                                    <option value="__new__" ${!existingSecNames.includes(displayName) ? 'selected' : ''}>➕ شيت جديد: ${esc(displayName)}</option>
                                </select>
                                <div class="aqw-grid" style="margin-top:8px;">
                                    <div><label>عدد يُسحب</label>
                                        <input type="number" class="aqw-num aqw-pick" min="0" max="${s.count}" value="${Math.min(10, s.count)}">
                                    </div>
                                    <div><label>درجة MCQ</label>
                                        <input type="number" class="aqw-num aqw-mcq-pts" min="0.25" step="0.25" value="1">
                                    </div>
                                    <div><label>درجة T/F</label>
                                        <input type="number" class="aqw-num aqw-tf-pts" min="0.25" step="0.25" value="1">
                                    </div>
                                </div>
                            </div>`;
                    }).join('')}`;
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
                if (pickCount > section.count) {
                    return Swal.showValidationMessage(`الملف "${sheetName}" فيه ${section.count} سؤال فقط`);
                }

                newSections.push({
                    sourceName: sheetName,
                    targetSection: targetSection === '__new__' ? sheetName.replace(/\.docx$/i, '') : targetSection,
                    questions: section.questions,
                    num_to_pick: pickCount,
                    mcq_points: mcqPts,
                    tf_points: tfPts
                });
            }

            if (!newSections.length) return Swal.showValidationMessage('حدد عدد أسئلة');
            return { newSections };
        }
    });

    if (!result.isConfirmed) return;

    const existingSections = quiz.sections_config || [];
    const newSections = result.value.newSections;

    const combined = existingSections.map(s => ({
        name: s.name,
        all_questions: [...(s.all_questions || [])],
        num_to_pick: s.num_to_pick || 0,
        mcq_points: s.mcq_points || 1,
        tf_points: s.tf_points || 1
    }));

    for (const newSec of newSections) {
        const existing = combined.find(s => s.name === newSec.targetSection);
        if (existing) {
            existing.all_questions.push(...newSec.questions);
            if (existing.num_to_pick < newSec.num_to_pick) {
                existing.num_to_pick = Math.min(
                    existing.num_to_pick + newSec.num_to_pick,
                    existing.all_questions.length
                );
            }
        } else {
            combined.push({
                name: newSec.targetSection,
                all_questions: newSec.questions,
                num_to_pick: Math.min(newSec.num_to_pick, newSec.questions.length),
                mcq_points: newSec.mcq_points,
                tf_points: newSec.tf_points
            });
        }
    }

    await saveQuizSections(quizId, quiz, combined,
        () => reopenQuizQuestionsTab(quizId)
    );
}

/* ==========================================================
   TAB INTEGRATION
   ========================================================== */
const _origSwitchTab = window.switchTab;
window.switchTab = function(sec, el) {
    _origSwitchTab(sec, el);
    if (sec === 'quizzes') {
        currentQuizSubject = null;
        loadQuizzes();
    }
};
