/* ==========================================================
   STUDENT QUIZZES · Like Attendance (Subjects → Quizzes → Verify)
   ========================================================== */

let _allQuizzes = [];
let _quizQrScanner = null;
let _quizCurrentQrId = null;

async function loadStudentQuizzes() {
    const c = document.getElementById('quizzes-container');
    const wrapper = document.getElementById('quiz-section-wrapper');
    if (!c) return;

    if (typeof currentStudent === 'undefined' || !currentStudent || !currentStudent.student_id) {
        if (wrapper) wrapper.style.display = 'none';
        return;
    }

    c.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;">
        <i class="fas fa-spinner fa-spin fa-2x" style="color:#FFB300;"></i></div>`;

    try {
        const r = await fetch(`/api/student-quizzes?student_id=${encodeURIComponent(currentStudent.student_id)}`);
        const d = await r.json();

        if (d.status !== 'success' || !d.quizzes || !d.quizzes.length) {
            if (wrapper) wrapper.style.display = 'none';
            c.innerHTML = '';
            return;
        }

        _allQuizzes = d.quizzes;
        if (wrapper) wrapper.style.display = 'block';

        const bySubject = {};
        d.quizzes.forEach(q => {
            const sid = q.subject_id;
            if (!bySubject[sid]) {
                bySubject[sid] = { id: sid, name: q.subject_name || 'مادة', quizzes: [] };
            }
            bySubject[sid].quizzes.push(q);
        });

        let subjectImages = {};
        try {
            const subjectsRes = await fetch(
                `/api/student-init?year=${encodeURIComponent(currentStudent.year)}` +
                `&dept=${encodeURIComponent(currentStudent.department)}` +
                `&student_id=${encodeURIComponent(currentStudent.student_id)}`
            );
            const subjectsData = await subjectsRes.json();
            (subjectsData.subjects || []).forEach(s => {
                subjectImages[s.id] = s.image || '';
            });
        } catch(e) {}

        renderQuizSubjects(Object.values(bySubject), subjectImages);
    } catch(e) {
        if (wrapper) wrapper.style.display = 'none';
        c.innerHTML = '';
    }
}

function renderQuizSubjects(subjects, images) {
    const c = document.getElementById('quizzes-container');
    c.innerHTML = subjects.map(sub => {
        const img = images[sub.id] || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png';
        const openCount = sub.quizzes.filter(q =>
            q.broadcast_active && q.my_status !== 'completed' && q.my_status !== 'blocked'
        ).length;
        const statusBadge = openCount > 0
            ? `<span class="badge-open"><i class="fas fa-circle"></i> ${openCount} امتحان متاح</span>`
            : `<span class="badge-closed">لا امتحانات متاحة</span>`;

        return `
            <div class="subject-card" onclick="openQuizSubjectModal('${sub.id}')">
                <img src="${img}" alt="${sub.name}">
                <h2 class="sub-title">${escapeHtmlQ(sub.name)}</h2>
                <div class="session-status-badge" data-open="${openCount > 0 ? '1' : '0'}">
                    ${statusBadge}
                </div>
            </div>
        `;
    }).join('');
}

/* ==========================================================
   QUIZ LIST MODAL
   ========================================================== */
window.openQuizSubjectModal = function(subjectId) {
    const sub = _allQuizzes.filter(q => q.subject_id === subjectId);
    if (!sub.length) {
        return Swal.fire({
            icon: 'info', title: 'لا يوجد كويزات',
            text: 'لم يتم رفع أي كويزات لهذه المادة بعد',
            background: '#1a1f2c', color: '#fff',
            confirmButtonColor: '#FFB300'
        });
    }

    const subName = sub[0].subject_name || 'المادة';

    const cardsHtml = sub.map((q) => {
        const st = q.my_status;
        let statusBadge = '', actionText = 'ادخل الامتحان', actionIcon = 'fa-play',
            actionColor = '#FFB300', disabled = false;

        if (st === 'blocked') {
            statusBadge = `<span style="color:#f87171;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);">🚫 محظور</span>`;
            actionText = 'محظور'; actionIcon = 'fa-ban'; actionColor = '#EF4444'; disabled = true;
        } else if (st === 'completed') {
            statusBadge = `<span style="color:#10B981;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.4);">✅ ${q.my_score}/${q.my_total}</span>`;
            actionText = 'قدمت'; actionIcon = 'fa-check'; actionColor = '#6B7280'; disabled = true;
        } else if (st === 'in_progress') {
            statusBadge = `<span style="color:#FFB300;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(255,179,0,.15);border:1px solid rgba(255,179,0,.4);">⏳ جاري</span>`;
            actionText = 'استئناف'; actionIcon = 'fa-forward';
        } else if (!q.broadcast_active) {
            statusBadge = `<span style="color:#F59E0B;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);">⏳ لم يبدأ بعد</span>`;
            actionText = 'انتظر البدء'; actionIcon = 'fa-clock'; actionColor = '#6B7280'; disabled = true;
        } else {
            statusBadge = `<span style="color:#60A5FA;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.4);">🆕 متاح الآن</span>`;
        }

        return `
            <div style="background:linear-gradient(160deg,rgba(30,42,64,.9),rgba(15,20,33,.96));
                 border:1.5px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;
                 margin-bottom:12px;position:relative;overflow:hidden;
                 box-shadow:0 8px 24px rgba(0,0,0,.4);">
                <div style="position:absolute;top:0;right:0;width:4px;height:100%;
                    background:linear-gradient(180deg,${actionColor},transparent 90%);
                    box-shadow:0 0 16px ${actionColor};"></div>
                <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
                    <div style="width:44px;height:44px;border-radius:12px;
                        background:rgba(255,179,0,.15);border:1.5px solid rgba(255,179,0,.4);
                        display:flex;align-items:center;justify-content:center;
                        color:#FFB300;font-size:20px;flex-shrink:0;">
                        <i class="fas fa-file-pen"></i>
                    </div>
                    <div style="flex:1;text-align:right;min-width:0;">
                        <div style="color:#fff;font-weight:900;font-size:15px;margin-bottom:3px;">
                            ${escapeHtmlQ(q.title)}
                        </div>
                        <div style="color:#8b93a7;font-size:11px;font-weight:700;">
                            ⏱️ ${q.duration} دقيقة · ${q.questions_count} سؤال
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">
                    ${statusBadge}
                    ${q.broadcast_active ? `<span style="color:#FFD54F;font-size:11px;padding:3px 10px;border-radius:8px;background:rgba(255,179,0,.15);border:1px solid rgba(255,179,0,.4);">📡 بث مباشر</span>` : ''}
                </div>
                <button ${disabled ? 'disabled' : ''}
                    onclick="openQuizVerifyModal('${q.id}')"
                    style="width:100%;padding:12px;border-radius:12px;
                    border:none;background:linear-gradient(135deg,${actionColor},${actionColor === '#EF4444' ? '#DC2626' : '#FFD54F'});
                    color:${actionColor === '#EF4444' || actionColor === '#6B7280' ? '#fff' : '#0a0e17'};
                    font-weight:900;font-size:13px;font-family:'Cairo',sans-serif;
                    cursor:${disabled ? 'not-allowed' : 'pointer'};
                    opacity:${disabled ? '.4' : '1'};
                    box-shadow:0 6px 18px ${actionColor}55;">
                    <i class="fas ${actionIcon}"></i> ${actionText}
                </button>
            </div>
        `;
    }).join('');

    Swal.fire({
        background: '#0f1520', width: 480,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fas fa-times"></i> إغلاق',
        cancelButtonColor: '#374151',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <div style="padding:4px 4px 16px;border-bottom:1px solid rgba(255,255,255,.1);
                    margin-bottom:14px;text-align:center;">
                    <div style="width:54px;height:54px;border-radius:16px;
                        background:linear-gradient(135deg,rgba(255,179,0,.25),rgba(124,58,237,.15));
                        border:1.5px solid rgba(255,179,0,.5);margin:0 auto 10px;
                        display:flex;align-items:center;justify-content:center;
                        color:#FFD54F;font-size:22px;box-shadow:0 0 30px rgba(255,179,0,.3);">
                        <i class="fas fa-file-pen"></i>
                    </div>
                    <div style="color:#FFD54F;font-size:13px;font-weight:900;margin-bottom:4px;">
                        📝 الكويزات المتاحة
                    </div>
                    <div style="color:#fff;font-size:18px;font-weight:900;">
                        ${escapeHtmlQ(subName)}
                    </div>
                </div>
                <div style="max-height:55vh;overflow-y:auto;padding:2px;">
                    ${cardsHtml}
                </div>
            </div>
        `
    });
};

/* ==========================================================
   VERIFY MODAL
   ========================================================== */
window.openQuizVerifyModal = function(quizId) {
    Swal.close();
    _quizCurrentQrId = quizId;
    _quizQrScanner = null;

    const quiz = _allQuizzes.find(q => q.id === quizId);
    const title = quiz ? quiz.title : 'الامتحان';
    const duration = quiz ? quiz.duration : 0;

    Swal.fire({
        background: '#0f1520', width: 500,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fas fa-times"></i> إلغاء',
        cancelButtonColor: '#374151',
        html: `
            <div style="text-align:right;font-family:'Cairo',sans-serif;">
                <div style="text-align:center;margin-bottom:16px;">
                    <div style="width:60px;height:60px;border-radius:18px;
                        background:linear-gradient(135deg,rgba(255,179,0,.25),rgba(255,213,79,.15));
                        border:2px solid rgba(255,179,0,.55);margin:0 auto 12px;
                        display:flex;align-items:center;justify-content:center;
                        color:#FFD54F;font-size:26px;box-shadow:0 0 40px rgba(255,179,0,.35);">
                        <i class="fas fa-shield-halved"></i>
                    </div>
                    <div style="color:#fff;font-size:18px;font-weight:900;margin-bottom:4px;">
                        ${escapeHtmlQ(title)}
                    </div>
                    <div style="color:#8b93a7;font-size:12px;font-weight:700;">
                        ⏱️ ${duration} دقيقة · تحقق قبل الدخول
                    </div>
                </div>

                <div style="background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.3);
                    border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:12px;
                    color:#22d3ee;line-height:1.8;text-align:right;">
                    <i class="fas fa-info-circle"></i>
                    اطلب من الدكتور الكود الظاهر على شاشة العرض، أو امسح الـ QR.
                </div>

                <button onclick="startQuizQrScan()"
                    style="width:100%;padding:12px;margin-bottom:12px;border-radius:12px;
                    border:1px solid rgba(255,179,0,.4);background:rgba(255,179,0,.1);
                    color:#FFD54F;font-weight:900;font-size:13px;font-family:'Cairo',sans-serif;
                    cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <i class="fas fa-camera"></i> مسح QR
                </button>

                <div id="quiz-qr-reader" style="display:none;margin-bottom:12px;
                    border-radius:14px;overflow:hidden;border:2px solid rgba(255,179,0,.4);"></div>

                <div style="text-align:center;color:#8b93a7;font-size:11px;
                    margin-bottom:10px;font-weight:700;">
                    — أو اكتب الكود يدوياً —
                </div>

                <input type="text" id="quiz-verify-input" maxlength="6" placeholder="XXXXXX"
                    style="width:100%;padding:16px;background:rgba(0,0,0,.55);
                    border:2px solid rgba(255,179,0,.4);border-radius:14px;
                    color:#FFD54F;font-family:'Plus Jakarta Sans',monospace;font-size:26px;
                    font-weight:900;letter-spacing:12px;text-align:center;
                    text-transform:uppercase;outline:none;margin-bottom:12px;"
                    oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)">

                <button onclick="submitQuizVerify()" id="quiz-verify-submit"
                    style="width:100%;padding:14px;border-radius:12px;border:none;
                    background:linear-gradient(135deg,#10B981,#059669);color:#fff;
                    font-weight:900;font-size:14px;font-family:'Cairo',sans-serif;
                    cursor:pointer;box-shadow:0 8px 24px rgba(16,185,129,.4);">
                    <i class="fas fa-rocket"></i> ادخل الامتحان
                </button>
            </div>
        `,
        didOpen: () => {
            setTimeout(() => {
                const inp = document.getElementById('quiz-verify-input');
                if (inp) {
                    inp.focus();
                    inp.addEventListener('keypress', e => {
                        if (e.key === 'Enter') submitQuizVerify();
                    });
                }
            }, 100);
        },
        willClose: () => { stopQuizQrScan(); }
    });
};

async function startQuizQrScan() {
    const readerEl = document.getElementById('quiz-qr-reader');
    if (!readerEl) return;

    if (typeof Html5Qrcode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode';
        document.head.appendChild(script);
        await new Promise(r => script.onload = r);
    }

    readerEl.style.display = 'block';
    readerEl.innerHTML = '<div style="padding:20px;text-align:center;color:#FFB300;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>جاري تشغيل الكاميرا...</div>';

    await new Promise(r => setTimeout(r, 200));

    try {
        readerEl.innerHTML = '';
        if (_quizQrScanner) { try { await _quizQrScanner.stop(); } catch(e) {} _quizQrScanner = null; }
        _quizQrScanner = new Html5Qrcode("quiz-qr-reader", { verbose: false });

        const config = { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; }, aspectRatio: 1.0 };

        const onSuccess = async (decodedText) => {
            const code = (decodedText || '').trim().substring(0, 6).toUpperCase();
            if (code.length === 6) {
                await stopQuizQrScan();
                const inp = document.getElementById('quiz-verify-input');
                if (inp) inp.value = code;
                submitQuizVerify('qr');
            }
        };

        let started = false;
        try { await _quizQrScanner.start({ facingMode: "environment" }, config, onSuccess, () => {}); started = true; }
        catch(e1) {
            try { await _quizQrScanner.start({ facingMode: "user" }, config, onSuccess, () => {}); started = true; } catch(e2) {}
        }
    } catch(e) {
        readerEl.style.display = 'none';
        Swal.fire({icon:'warning', title:'تعذر تشغيل الكاميرا', text:'استخدم الكود اليدوي',
            background: '#0f1520', color: '#fff', confirmButtonColor: '#FFB300'});
    }
}

async function stopQuizQrScan() {
    if (_quizQrScanner) {
        try { await _quizQrScanner.stop(); } catch(e) {}
        try { _quizQrScanner.clear(); } catch(e) {}
        _quizQrScanner = null;
    }
    const el = document.getElementById('quiz-qr-reader');
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

async function submitQuizVerify(scanType = 'manual') {
    const code = (document.getElementById('quiz-verify-input').value || '').trim().toUpperCase();
    if (code.length !== 6) {
        return Swal.fire({icon:'warning', title:'الكود لازم 6 خانات',
            background: '#0f1520', color: '#fff', confirmButtonColor: '#FFB300'});
    }

    const btn = document.getElementById('quiz-verify-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحقق...'; }

    try {
        const r = await fetch('/api/quiz-quick-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quiz_id: _quizCurrentQrId,
                student_id: currentStudent.student_id,
                student_name: currentStudent.name,
                code: code,
                scan_type: scanType
            })
        });
        const d = await r.json();

        if (d.status === 'success') {
            sessionStorage.setItem('nx_quiz_start', JSON.stringify(d));
            window.location.href = '/exam?verified=1';
        } else if (d.status === 'blocked') {
            Swal.fire({icon:'error', title:'محظور', text: d.message || 'أنت محظور من هذا الامتحان',
                background: '#0f1520', color: '#fff', confirmButtonColor: '#EF4444'});
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> ادخل الامتحان'; }
        } else if (d.status === 'already_done') {
            Swal.fire({icon:'info', title:'قدمت الامتحان', text:`درجتك: ${d.score}/${d.total}`,
                background: '#0f1520', color: '#fff', confirmButtonColor: '#FFB300'});
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> ادخل الامتحان'; }
        } else {
            Swal.fire({icon:'error', title:'كود غير صحيح', text: d.message || 'حاول مرة أخرى',
                background: '#0f1520', color: '#fff', confirmButtonColor: '#EF4444'});
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> ادخل الامتحان'; }
        }
    } catch(e) {
        Swal.fire({icon:'error', title:'تعذر الاتصال',
            background: '#0f1520', color: '#fff', confirmButtonColor: '#EF4444'});
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-rocket"></i> ادخل الامتحان'; }
    }
}

function escapeHtmlQ(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ==========================================================
   HOOKS
   ========================================================== */
const _origLoadDashboard_quizzes = window.loadDashboard;
if (typeof _origLoadDashboard_quizzes === 'function') {
    window.loadDashboard = async function() {
        try { await _origLoadDashboard_quizzes.apply(this, arguments); } catch(e) {}
        loadStudentQuizzes();
    };
}

const _origShowStudentUI_quizzes = window.showStudentUI;
if (typeof _origShowStudentUI_quizzes === 'function') {
    window.showStudentUI = function() {
        _origShowStudentUI_quizzes.apply(this, arguments);
        setTimeout(loadStudentQuizzes, 800);
    };
}

window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof currentStudent !== 'undefined' && currentStudent && currentStudent.student_id) {
            loadStudentQuizzes();
        }
    }, 1200);
});