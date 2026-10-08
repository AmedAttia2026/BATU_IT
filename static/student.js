const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let currentStudent = null;
let allSubjects = [];
let allActiveSessions = [];
let selectedSession = null;
let html5Qr = null;
let dashboardRefreshInterval = null;
let qrScannerStarting = false; // منع التشغيل المزدوج
let qrAutoSubmitLocked = false; // ✅ لمنع الإرسال المزدوج بعد مسح QR

/* =========================================================
   🔒 قفل الجهاز — جهاز واحد = طالب واحد فقط
   ========================================================= */
const DEVICE_OWNER_ID_KEY = 'nx_device_owner_id';
const DEVICE_OWNER_NAME_KEY = 'nx_device_owner_name';

function getDeviceOwner() {
    try {
        return {
            id: localStorage.getItem(DEVICE_OWNER_ID_KEY),
            name: localStorage.getItem(DEVICE_OWNER_NAME_KEY) || ''
        };
    } catch (e) {
        return { id: null, name: '' };
    }
}

function setDeviceOwner(id, name) {
    try {
        localStorage.setItem(DEVICE_OWNER_ID_KEY, id);
        localStorage.setItem(DEVICE_OWNER_NAME_KEY, name || '');
    } catch (e) {}
}

/* =========================================================
   🎫 Device Token
   ========================================================= */
function getDeviceToken() {
    let t = localStorage.getItem('nx_device_token');
    if(!t) {
        t = 'DEV_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem('nx_device_token', t);
    }
    return t;
}

function handleYearChange() {
    const yr = document.getElementById('login-year').value;
    const deptGroup = document.getElementById('dept-group');
    if (yr === 'الفرقة الثالثة' || yr === 'الفرقة الرابعة') {
        deptGroup.style.display = 'block';
    } else {
        deptGroup.style.display = 'none';
    }
}

window.onload = () => {
    const saved = localStorage.getItem('nx_student_auth');
    if(saved) {
        currentStudent = JSON.parse(saved);
        showStudentUI();
    }
};

async function loginStudent() {
    const name = document.getElementById('login-name').value.trim();

    // ✅ تنظيف حقل الكود من أي حروف أو رموز (حماية إضافية بعد اللصق)
    const idInput = document.getElementById('login-id');
    idInput.value = idInput.value.replace(/[^0-9]/g, '');
    const id = idInput.value.trim();

    const year = document.getElementById('login-year').value;
    let dept = 'عام (IT)';

    if (year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة') {
        dept = document.getElementById('login-dept').value;
    }

    if(!name || name.length < 3) return Swal.fire({...swalDark, icon:'warning', text:'يرجى إدخال اسم الطالب بشكل صحيح!'});
    if(id.length !== 7 || isNaN(id)) return Swal.fire({...swalDark, icon:'warning', text:'رقم الـ ID يجب أن يتكون من 7 أرقام!'});
    if(!year) return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار الفرقة الدراسية!'});

    // 🔒 فحص قفل الجهاز
    const owner = getDeviceOwner();
    if (owner.id && owner.id !== id) {
        const confirmReset = await Swal.fire({
            ...swalDark,
            icon: 'warning',
            title: 'هذا الجهاز مرتبط بطالب آخر',
            html: `
                <div style="text-align:center; line-height:1.8;">
                    <p style="color:#fff; margin-bottom:8px;">هذا الجهاز مسجّل باسم:</p>
                    <p style="color:#FFB300; font-weight:900; font-size:16px; margin-bottom:12px;">${owner.name || '—'}</p>
                    <p style="color:#9CA3AF; font-size:13px;">لا يمكن استخدام نفس الجهاز لتسجيل حضور أكثر من طالب واحد.</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إعادة تعيين الجهاز',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#EF4444'
        });

        if (confirmReset.isConfirmed) {
            try {
                localStorage.removeItem(DEVICE_OWNER_ID_KEY);
                localStorage.removeItem(DEVICE_OWNER_NAME_KEY);
            } catch(e) {}
        } else {
            return;
        }
    }

    const res = await fetch('/api/student-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({student_name: name, student_id: id, year: year, department: dept})
    });
    const data = await res.json();
    if(data.status === 'success') {
        currentStudent = data.student;
        localStorage.setItem('nx_student_auth', JSON.stringify(currentStudent));
        showStudentUI();
    } else {
        Swal.fire({...swalDark, icon:'error', text: data.message});
    }
}

function showStudentUI() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'flex';

    document.getElementById('display-name').innerText = currentStudent.name;
    document.getElementById('display-id').innerText = currentStudent.student_id;

    const yrEl = document.getElementById('display-year');
    const dpEl = document.getElementById('display-dept');
    if (yrEl) yrEl.innerText = currentStudent.year || '';
    if (dpEl) dpEl.innerText = currentStudent.department || '';

    const nameParts = (currentStudent.name || '').trim().split(/\s+/);
    let initials = '•';
    if (nameParts.length >= 2) {
        initials = (nameParts[0][0] || '') + (nameParts[1][0] || '');
    } else if (nameParts.length === 1 && nameParts[0]) {
        initials = nameParts[0].substring(0, 2);
    }
    const av = document.getElementById('display-avatar');
    if (av) av.innerText = initials;

    loadDashboard();
}

function logoutStudent() {
    stopAutoRefresh();
    stopQrReader();
    localStorage.removeItem('nx_student_auth');
    location.reload();
}

async function loadDashboard() {
    document.getElementById('loading-screen').style.display = 'flex';
    const res = await fetch(`/api/student-init?year=${encodeURIComponent(currentStudent.year)}&dept=${encodeURIComponent(currentStudent.department)}`);
    const data = await res.json();
    document.getElementById('loading-screen').style.display = 'none';

    allSubjects = data.subjects || [];
    allActiveSessions = data.sessions || [];

    renderSubjectCards();
    startAutoRefresh();
}

function renderSubjectCards() {
    const container = document.getElementById('subjects-container');

    if(allSubjects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book fa-3x" style="color:var(--border); margin-bottom:15px;"></i>
                <h3 style="color:#fff;">لا توجد مواد مضافة لـ ${currentStudent.year}</h3>
                <p style="color:var(--text-muted); font-size:13px; margin-top:5px;">تأكد من قيام الدكتور أو الإدارة بإضافة مواد لفرقتك.</p>
            </div>`;
        return;
    }

    container.innerHTML = allSubjects.map(sub => {
        const activeCount = allActiveSessions.filter(s => s.subject_id === sub.id).length;
        const isOpen = activeCount > 0;

        const statusHtml = isOpen
            ? `<span class="badge-open"><i class="fas fa-circle"></i> مفتوح جلسة الآن</span>`
            : `<span class="badge-closed">لا توجد جلسات حالياً</span>`;

        return `
            <div class="subject-card" data-sub-id="${sub.id}" onclick="selectSubjectForAttendance('${sub.id}', '${sub.name}')">
                <img src="${sub.image || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'}" alt="subject">
                <h2 class="sub-title">${sub.name}</h2>
                <div class="session-status-badge" data-open="${isOpen ? '1' : '0'}">
                    ${statusHtml}
                </div>
            </div>
        `;
    }).join('');
}

/* =========================================================
   🔄 AUTO-REFRESH
   ========================================================= */
function startAutoRefresh() {
    stopAutoRefresh();
    dashboardRefreshInterval = setInterval(refreshSessionStatus, 15000);
}

function stopAutoRefresh() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}

async function refreshSessionStatus() {
    if (!currentStudent) return;
    try {
        const res = await fetch(`/api/student-init?year=${encodeURIComponent(currentStudent.year)}&dept=${encodeURIComponent(currentStudent.department)}`);
        const data = await res.json();

        const newSessions = data.sessions || [];
        const newSubjects = data.subjects || [];

        if (newSubjects.length !== allSubjects.length) {
            allSubjects = newSubjects;
            allActiveSessions = newSessions;
            renderSubjectCards();
            return;
        }

        allActiveSessions = newSessions;

        newSubjects.forEach(sub => {
            const card = document.querySelector(`.subject-card[data-sub-id="${sub.id}"]`);
            if (!card) return;

            const badge = card.querySelector('.session-status-badge');
            if (!badge) return;

            const activeCount = allActiveSessions.filter(s => s.subject_id === sub.id).length;
            const isOpen = activeCount > 0;
            const wasOpen = badge.dataset.open === '1';

            if (isOpen !== wasOpen) {
                badge.dataset.open = isOpen ? '1' : '0';
                badge.innerHTML = isOpen
                    ? `<span class="badge-open"><i class="fas fa-circle"></i> مفتوح جلسة الآن</span>`
                    : `<span class="badge-closed">لا توجد جلسات حالياً</span>`;

                badge.classList.add('bump');
                setTimeout(() => badge.classList.remove('bump'), 600);
            }
        });
    } catch (err) {
        // silent fail
    }
}

function selectSubjectForAttendance(subId, subName) {
    const filtered = allActiveSessions.filter(s => s.subject_id === subId);
    if(filtered.length === 0) {
        return Swal.fire({
            ...swalDark,
            icon: 'info',
            title: subName,
            text: 'لا توجد محاضرات أو سكاشن مفتوحة لتسجيل الحضور لهذه المادة في الوقت الحالي.'
        });
    }

    const buttonsHtml = filtered.map(s => `
        <div style="background:#1F2937; padding:12px; border-radius:10px; margin-bottom:8px; cursor:pointer; text-align:right; border:1px solid var(--border);" onclick="openVerifyModal('${s.session_id}', '${s.title}', '${subName}', '${s.type}')">
            <b style="color:var(--gold); font-size:15px;">${s.title}</b>
            <span style="font-size:11px; background:rgba(255,179,0,0.15); color:var(--gold); padding:2px 8px; border-radius:6px; margin-right:5px;">${s.type === 'Lecture' ? 'محاضرة' : 'سكشن'}</span>
            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">المحاضر: ${s.created_by}</p>
        </div>
    `).join('');

    Swal.fire({
        ...swalDark,
        title: `اختر الجلسة (${subName})`,
        html: buttonsHtml,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق'
    });
}

/* =========================================================
   ✅ فتح نافذة تأكيد الحضور — مع فحص "أنت مسجل بالفعل"
   ========================================================= */
async function openVerifyModal(sessId, title, subName, type) {
    Swal.close();
    qrAutoSubmitLocked = false; // ✅ تصفير القفل عند فتح نافذة جديدة

    /* فحص سريع: هل الطالب سجل في هذه الجلسة بالفعل؟ */
    try {
        const res = await fetch('/api/student-history', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({student_id: currentStudent.student_id})
        });
        const data = await res.json();

        if (data.history && Array.isArray(data.history)) {
            const already = data.history.find(h => h.session_id === sessId);
            if (already) {
                return Swal.fire({
                    ...swalDark,
                    icon: 'success',
                    title: 'أنت مسجل بالفعل ✅',
                    html: `
                        <div style="text-align:center; line-height:1.8;">
                            <p style="color:#fff; margin-bottom:6px;">لقد سجّلت حضورك في هذه الجلسة مسبقاً</p>
                            <p style="color:#10B981; font-weight:900; font-size:14px; margin-bottom:12px;">${already.subject_name} — ${already.session_title}</p>
                            <span style="font-size:12px; color:#9CA3AF; font-family:monospace;">
                                <i class="far fa-clock"></i> ${already.timestamp}
                            </span>
                        </div>
                    `,
                    confirmButtonText: 'حسناً'
                });
            }
        }
    } catch (e) { /* لو الاتصال فشل، نكمل عادي */ }

    selectedSession = sessId;
    document.getElementById('modal-sess-title').innerText = `${title} (${type === 'Lecture' ? 'محاضرة' : 'سكشن'})`;
    document.getElementById('modal-sess-sub').innerText = subName;
    document.getElementById('totp-input').value = '';
    document.getElementById('verify-modal').style.display = 'flex';
}

/* =========================================================
   ✅ إغلاق نافذة التأكيد
   ========================================================= */
function closeVerifyModal() {
    stopQrReader();

    const modalEl = document.getElementById('verify-modal');
    if (modalEl) modalEl.style.display = 'none';

    const inputEl = document.getElementById('totp-input');
    if (inputEl) inputEl.value = '';

    selectedSession = null;
    qrAutoSubmitLocked = false;
}

/* =========================================================
   📷 QR Scanner — نسخة محسّنة مع Fallback وحل المشاكل
   ✅ عند المسح: يملأ الحقل ويُرسل تلقائياً
   ========================================================= */
async function stopQrReader() {
    const r = document.getElementById('reader');

    if (html5Qr) {
        try {
            const state = html5Qr.getState ? html5Qr.getState() : null;
            // 2 = SCANNING, 3 = PAUSED
            if (state === 2 || state === 3) {
                try {
                    await html5Qr.stop();
                } catch (e) { /* تجاهل */ }
            }
            try {
                html5Qr.clear();
            } catch (e) { /* تجاهل */ }
        } catch (e) { /* تجاهل */ }
        html5Qr = null;
    }

    if (r) {
        r.style.display = 'none';
        r.innerHTML = '';
    }
    qrScannerStarting = false;
}

async function toggleQrReader() {
    const r = document.getElementById('reader');
    if (!r) return;

    // لو شغال، نقفله
    if (r.style.display === 'block' || html5Qr) {
        await stopQrReader();
        return;
    }

    // منع التشغيل المزدوج
    if (qrScannerStarting) return;
    qrScannerStarting = true;

    r.style.display = 'block';
    r.innerHTML = '<div style="text-align:center; padding:20px; color:#FFB300;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>جاري تشغيل الكاميرا...</div>';

    // تأخير بسيط للسماح للمتصفح ببناء الـ DOM
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        // تنظيف أي instance قديم
        if (html5Qr) {
            try { await html5Qr.stop(); } catch(e) {}
            try { html5Qr.clear(); } catch(e) {}
            html5Qr = null;
        }

        r.innerHTML = '';
        html5Qr = new Html5Qrcode("reader", { verbose: false });

        // إعدادات مربع المسح — متجاوب مع حجم الشاشة
        const config = {
            fps: 10,
            qrbox: function(viewfinderWidth, viewfinderHeight) {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const size = Math.floor(minEdge * 0.75);
                return { width: size, height: size };
            },
            aspectRatio: 1.0,
            disableFlip: false
        };

        // ✅ دالة نجاح المسح: تملأ الحقل + ترسل تلقائياً
        const onScanSuccess = (decodedText) => {
            // 🛡️ منع الإرسال المزدوج لو نفس الكود اتقرأ مرتين
            if (qrAutoSubmitLocked) return;
            qrAutoSubmitLocked = true;

            const input = document.getElementById('totp-input');
            const cleanCode = (decodedText || '').trim().substring(0, 6).toUpperCase();
            if (input) input.value = cleanCode;

            // إيقاف الكاميرا فوراً
            stopQrReader();

            // ✅ إرسال فوري بعد 250ms
            setTimeout(() => {
                submitAttendanceFinal(true); // true = مسح QR
            }, 250);
        };

        const onScanError = () => { /* تجاهل الأخطاء العادية */ };

        let started = false;
        let lastError = null;

        // المحاولة 1: الكاميرا الخلفية
        try {
            await html5Qr.start(
                { facingMode: "environment" },
                config,
                onScanSuccess,
                onScanError
            );
            started = true;
        } catch (err1) {
            lastError = err1;
            console.warn("Back camera failed:", err1);
        }

        // المحاولة 2: الكاميرا الأمامية (لو الخلفية فشلت)
        if (!started) {
            try {
                await html5Qr.start(
                    { facingMode: "user" },
                    config,
                    onScanSuccess,
                    onScanError
                );
                started = true;
            } catch (err2) {
                lastError = err2;
                console.warn("Front camera failed:", err2);
            }
        }

        // المحاولة 3: أي كاميرا متاحة
        if (!started) {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    await html5Qr.start(
                        devices[0].id,
                        config,
                        onScanSuccess,
                        onScanError
                    );
                    started = true;
                }
            } catch (err3) {
                lastError = err3;
                console.warn("Any camera failed:", err3);
            }
        }

        if (!started) {
            throw lastError || new Error("No camera available");
        }

        qrScannerStarting = false;

    } catch (err) {
        qrScannerStarting = false;
        await stopQrReader();

        const errStr = String(err).toLowerCase();
        let title = 'تعذر تشغيل الكاميرا';
        let msg = 'حدث خطأ غير متوقع، جرب مرة أخرى';

        if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
            title = 'صلاحية الكاميرا مرفوضة';
            msg = 'يرجى السماح بالوصول للكاميرا من إعدادات المتصفح ثم إعادة المحاولة';
        } else if (errStr.includes('notfound') || errStr.includes('no camera') || errStr.includes('devicesnotfound')) {
            title = 'لا توجد كاميرا';
            msg = 'هذا الجهاز لا يحتوي على كاميرا متاحة';
        } else if (errStr.includes('notreadable') || errStr.includes('in use') || errStr.includes('trackstarterror')) {
            title = 'الكاميرا مشغولة';
            msg = 'الكاميرا مستخدمة من تطبيق آخر — يرجى إغلاقه ثم إعادة المحاولة';
        } else if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            title = 'اتصال غير آمن';
            msg = 'تشغيل الكاميرا يحتاج اتصال HTTPS — يمكنك استخدام الرمز اليدوي';
        } else if (errStr.includes('overconstrained')) {
            title = 'الكاميرا غير مدعومة';
            msg = 'إعدادات الكاميرا المطلوبة غير متوفرة';
        }

        Swal.fire({
            ...swalDark,
            icon: 'error',
            title: title,
            html: `
                <div style="text-align:center; line-height:1.8;">
                    <p style="color:#fff; margin-bottom:12px;">${msg}</p>
                    <p style="font-size:12px; color:#9CA3AF;">💡 يمكنك استخدام الرمز اليدوي بدلاً من الكاميرا</p>
                </div>
            `,
            confirmButtonText: 'حسناً'
        });
    }
}

/* =========================================================
   ✅ إرسال الحضور — يدعم وضع QR (تلقائي) و اليدوي
   ========================================================= */
async function submitAttendanceFinal(fromQr = false) {
    const code = document.getElementById('totp-input').value.trim();
    if(code.length !== 6) return Swal.fire({...swalDark, icon:'warning', text:'الرمز السري يتكون من 6 خانات!'});

    // 🔒 فحص قفل الجهاز
    const owner = getDeviceOwner();
    if (owner.id && owner.id !== currentStudent.student_id) {
        return Swal.fire({
            ...swalDark,
            icon: 'error',
            title: 'هذا الجهاز مرتبط بطالب آخر',
            html: `
                <div style="text-align:center; line-height:1.8;">
                    <p style="color:#fff; margin-bottom:8px;">لا يمكن استخدام هذا الجهاز لتسجيل حضور أكثر من طالب.</p>
                    <p style="color:#FFB300; font-weight:900; font-size:14px; margin-bottom:12px;">مسجّل باسم: ${owner.name || owner.id}</p>
                    <p style="color:#9CA3AF; font-size:12px;">يُرجى استخدام جهازك الخاص أو التواصل مع الإدارة.</p>
                </div>
            `,
            confirmButtonText: 'فهمت'
        });
    }

    Swal.fire({title: 'جاري تسجيل حضورك...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});

    const res = await fetch('/api/submit-attendance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            student_id: currentStudent.student_id,
            student_name: currentStudent.name,
            session_id: selectedSession,
            code: code,
            device_token: getDeviceToken(),
            scan_type: fromQr ? 'qr' : 'manual'   // ✅ تحديد نوع الإدخال للسيرفر
        })
    });
    const data = await res.json();
    if(res.ok) {
        setDeviceOwner(currentStudent.student_id, currentStudent.name);

        closeVerifyModal();
        Swal.fire({...swalDark, icon:'success', title:'تم بنجاح!', text: data.message});
        if (typeof confetti === 'function') {
            const colors = ['#FFB300', '#FFD54F', '#10B981', '#7C3AED', '#06B6D4'];
            confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0 }, colors });
            confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1 }, colors });
            setTimeout(() => {
                confetti({ particleCount: 60, spread: 100, origin: { y: 0.6 }, colors });
            }, 200);
        }
    } else {
        // ✅ لو فشل الإرسال التلقائي بعد المسح، نفتح القفل للسماح بإعادة المحاولة
        if (fromQr) qrAutoSubmitLocked = false;
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

/* =========================================================
   سجل الحضور
   ========================================================= */
async function openHistoryModal() {
    document.getElementById('history-modal').style.display = 'flex';
    const res = await fetch('/api/student-history', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({student_id: currentStudent.student_id})
    });
    const data = await res.json();
    const list = document.getElementById('history-list-container');
    if(!data.history || data.history.length === 0) {
        list.innerHTML = `<div class="empty-state"><i class="fas fa-box-open fa-3x" style="color:var(--border); margin-bottom:15px;"></i><h3 style="color:#fff;">لا يوجد حضور مسجل بعد</h3></div>`;
        return;
    }
    list.innerHTML = data.history.map(h => `
        <div class="comp-card">
            <div class="comp-header">
                <span class="comp-sub">${h.subject_name}</span>
                <span class="badge-resolved"><i class="fas fa-check-circle"></i> حاضر</span>
            </div>
            <p style="color:#fff; font-size:14px; margin:5px 0;">${h.session_title} (${h.session_type === 'Lecture' ? 'محاضرة' : 'سكشن'})</p>
            <span style="font-size:12px; color:var(--text-muted); font-family:monospace;"><i class="far fa-clock"></i> ${h.timestamp}</span>
        </div>
    `).join('');
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}
