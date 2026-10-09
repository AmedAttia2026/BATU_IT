const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let currentStudent = null;
let allSubjects = [];
let allActiveSessions = [];
let selectedSession = null;
let html5Qr = null;
let dashboardRefreshInterval = null;
let qrScannerStarting = false;
let qrAutoSubmitLocked = false;

/* =========================================================
   💾 Cache بسيط لتقليل الطلبات
   ========================================================= */
const nxCache = {
    history: { data: null, ts: 0, ttl: 30000 }, // 30 ثانية

    get(key) {
        const c = this[key];
        if (c && c.data && (Date.now() - c.ts) < c.ttl) return c.data;
        return null;
    },
    set(key, data) {
        if (this[key]) {
            this[key].data = data;
            this[key].ts = Date.now();
        }
    },
    clear(key) {
        if (this[key]) { this[key].data = null; this[key].ts = 0; }
    }
};

/* =========================================================
   🔒 قفل الجهاز
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

/* =========================================================
   🛡️ فحص كود ربط الشاشة (SCR)
   ========================================================= */
function isPairingCode(code) {
    if (typeof code !== 'string') return false;
    return code.trim().toUpperCase().startsWith('SCR');
}

function showPairingCodeWarning() {
    return Swal.fire({
        ...swalDark,
        icon: 'info',
        title: '🖥️ هذا كود ربط الشاشة',
        html: `
            <div style="text-align:center; line-height:1.9;">
                <p style="color:#fff; margin-bottom:12px;">
                    الكود اللي قرأته/كتبته <b style="color:#f87171;">ليس كود حضور</b>.
                </p>

                <div style="padding:14px; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.3); border-radius:14px; margin-bottom:14px;">
                    <p style="color:#22d3ee; font-weight:900; font-size:14px; margin:0;">
                        <i class="fas fa-user-tie"></i>
                        كود ربط الشاشة يُستخدم بواسطة
                    </p>
                    <p style="color:#FFB300; font-weight:900; font-size:15px; margin:6px 0 0;">
                        المعيد / دكتور المادة فقط
                    </p>
                </div>

                <div style="padding:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:12px;">
                    <p style="color:#8b93a7; font-size:12.5px; margin:0;">
                        <i class="fas fa-lightbulb" style="color:#10B981;"></i>
                        يرجى مسح <b style="color:#10B981;">كود الحضور</b> (6 خانات) الظاهر على شاشة العرض
                    </p>
                </div>
            </div>
        `,
        confirmButtonText: '<i class="fas fa-check"></i> فهمت',
        confirmButtonColor: '#FFB300'
    });
}

/* =========================================================
   ✅ التحكم بزر الدخول
   ========================================================= */
function showLoginBtn() {
    const btn = document.getElementById('login-submit-btn');
    if (btn) {
        btn.style.removeProperty('display');
        btn.style.display = 'block';
    }
}

function hideLoginBtn() {
    const btn = document.getElementById('login-submit-btn');
    if (btn) {
        btn.style.display = 'none';
    }
}

/* =========================================================
   ✅ الخطوة 1 → الخطوة 2
   ========================================================= */
function goToClassStep() {
    const name = document.getElementById('login-name').value.trim();
    const idInput = document.getElementById('login-id');
    idInput.value = idInput.value.replace(/[^0-9]/g, '');
    const id = idInput.value.trim();
    const yearEl = document.getElementById('login-year');
    const year = yearEl ? yearEl.value : '';

    if (!name || name.length < 3) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى إدخال اسم الطالب بشكل صحيح!'});
    }
    if (id.length !== 7 || isNaN(id)) {
        return Swal.fire({...swalDark, icon:'warning', text:'رقم الـ ID يجب أن يتكون من 7 أرقام!'});
    }
    if (!year) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار الفرقة الدراسية!'});
    }

    const step1 = document.getElementById('auth-step-1');
    const step2 = document.getElementById('auth-step-2');
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';

    setupStep2(year);
}

/* =========================================================
   ✅ الرجوع من الخطوة 2 → الخطوة 1
   ========================================================= */
function backToStep1() {
    const step1 = document.getElementById('auth-step-1');
    const step2 = document.getElementById('auth-step-2');
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';

    const deptEl = document.getElementById('login-dept');
    if (deptEl) deptEl.value = '';

    const classGroup = document.getElementById('class-group');
    if (classGroup) {
        classGroup.style.display = 'none';
        classGroup.innerHTML = '';
    }

    hideLoginBtn();
}

/* =========================================================
   ✅ تجهيز الخطوة 2 حسب الفرقة
   ========================================================= */
function setupStep2(year) {
    const isYear34 = (year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة');
    const deptGroup = document.getElementById('dept-group');
    const classGroup = document.getElementById('class-group');

    // 🔒 إخفاء زر الدخول دايماً في البداية
    hideLoginBtn();

    if (isYear34) {
        // ===== سنة 3/4 =====
        if (deptGroup) deptGroup.style.display = 'block';
        const deptEl = document.getElementById('login-dept');
        if (deptEl) deptEl.value = '';

        // نظهر الـ Class فوراً لكن معطّل
        if (classGroup) {
            classGroup.style.display = 'block';
            classGroup.innerHTML = `
                <select id="login-class" class="custom-select" disabled style="opacity:0.55;">
                    <option value="" disabled selected>اختر القسم أولاً لعرض الفصول</option>
                </select>
            `;
        }
    } else {
        // ===== سنة 1/2 =====
        if (deptGroup) deptGroup.style.display = 'none';
        loadClassesFor(year, 'عام (IT)');
    }
}

/* =========================================================
   ✅ تحميل الفصول من السيرفر
   ========================================================= */
async function loadClassesFor(year, dept) {
    const classGroup = document.getElementById('class-group');
    if (!classGroup) return;

    // 🔒 إخفاء زر الدخول دائماً قبل التحميل
    hideLoginBtn();

    classGroup.style.display = 'block';
    classGroup.innerHTML = `
        <select class="custom-select" disabled style="opacity:0.55;">
            <option value="" disabled selected>جاري تحميل الفصول...</option>
        </select>
    `;

    try {
        const url = `/api/available-classes?year=${encodeURIComponent(year)}&dept=${encodeURIComponent(dept)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'success' && Array.isArray(data.classes) && data.classes.length > 0) {
            classGroup.innerHTML = `
                <select id="login-class" class="custom-select">
                    <option value="" disabled selected>اختر الفصل (Class)</option>
                    ${data.classes.map(c => `<option value="${c}">Class ${c}</option>`).join('')}
                </select>
            `;
        } else {
            classGroup.innerHTML = `
                <select id="login-class" class="custom-select" disabled style="opacity:0.55;">
                    <option value="" disabled selected>لا توجد فصول متاحة بعد — تواصل مع الدكتور</option>
                </select>
            `;
        }
    } catch (e) {
        console.error("loadClassesFor error:", e);
        classGroup.innerHTML = `
            <select id="login-class" class="custom-select" disabled style="opacity:0.55;">
                <option value="" disabled selected>فشل تحميل الفصول</option>
            </select>
        `;
    }
}

/* =========================================================
   ✅ AUTO-LOGIN
   ========================================================= */
window.addEventListener('load', () => {
    const saved = localStorage.getItem('nx_student_auth');
    if (saved) {
        try {
            currentStudent = JSON.parse(saved);
            showStudentUI();
        } catch (e) {
            localStorage.removeItem('nx_student_auth');
        }
    }
});

/* =========================================================
   ✅ Event Delegation — للـ dept والـ class
   ========================================================= */
document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.id) return;

    // ===== تغيير القسم =====
    if (t.id === 'login-dept') {
        hideLoginBtn();

        const yearEl = document.getElementById('login-year');
        const year = yearEl ? yearEl.value : '';
        const dept = t.value;
        if (year && dept) {
            loadClassesFor(year, dept);
        }
    }

    // ===== تغيير الفصل =====
    if (t.id === 'login-class') {
        if (t.value && t.value !== '') {
            showLoginBtn();
        } else {
            hideLoginBtn();
        }
    }
});

/* =========================================================
   ✅ تسجيل الدخول — Final Submit
   ========================================================= */
async function loginStudent() {
    const name = document.getElementById('login-name').value.trim();

    const idInput = document.getElementById('login-id');
    idInput.value = idInput.value.replace(/[^0-9]/g, '');
    const id = idInput.value.trim();

    const year = document.getElementById('login-year').value;
    let dept = 'عام (IT)';

    if (year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة') {
        const deptEl = document.getElementById('login-dept');
        dept = deptEl ? deptEl.value : '';
    }

    const classEl = document.getElementById('login-class');
    const classNumber = classEl ? classEl.value : '';

    if (!name || name.length < 3) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى إدخال اسم الطالب بشكل صحيح!'});
    }
    if (id.length !== 7 || isNaN(id)) {
        return Swal.fire({...swalDark, icon:'warning', text:'رقم الـ ID يجب أن يتكون من 7 أرقام!'});
    }
    if (!year) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار الفرقة الدراسية!'});
    }
    if ((year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة') && !dept) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار القسم!'});
    }
    if (!classEl || !classNumber) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار الفصل (Class)!'});
    }

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

    Swal.fire({ title: 'جاري التحقق...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

    try {
        const res = await fetch('/api/student-login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_name: name,
                student_id: id,
                year: year,
                department: dept,
                class_number: classNumber
            })
        });
        const data = await res.json();
        Swal.close();

        if (data.status === 'success') {
            currentStudent = data.student;
            localStorage.setItem('nx_student_auth', JSON.stringify(currentStudent));
            showStudentUI();
        } else {
            Swal.fire({...swalDark, icon:'error', text: data.message || 'فشل التسجيل'});
        }
    } catch (e) {
        Swal.close();
        Swal.fire({...swalDark, icon:'error', text: 'تعذر الاتصال بالسيرفر'});
    }
}

/* =========================================================
   ✅ عرض الواجهة الرئيسية
   ========================================================= */
function showStudentUI() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-ui').style.display = 'flex';

    document.getElementById('display-name').innerText = currentStudent.name;
    document.getElementById('display-id').innerText = currentStudent.student_id;

    const yrEl = document.getElementById('display-year');
    const dpEl = document.getElementById('display-dept');
    if (yrEl) yrEl.innerText = currentStudent.year || '';
    if (dpEl) dpEl.innerText = currentStudent.department || '';

    const classChip = document.getElementById('display-class-chip');
    const classEl = document.getElementById('display-class');
    if (currentStudent.class_number && classChip && classEl) {
        classEl.innerText = `Class ${currentStudent.class_number}`;
        classChip.style.display = 'inline-flex';
    } else if (classChip) {
        classChip.style.display = 'none';
    }

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
    nxCache.clear('history');
    localStorage.removeItem('nx_student_auth');
    location.reload();
}

/* =========================================================
   📊 تحميل الداشبورد
   ========================================================= */
async function loadDashboard() {
    document.getElementById('loading-screen').style.display = 'flex';
    try {
        const res = await fetch(
            `/api/student-init?year=${encodeURIComponent(currentStudent.year)}` +
            `&dept=${encodeURIComponent(currentStudent.department)}` +
            `&student_id=${encodeURIComponent(currentStudent.student_id)}`
        );
        const data = await res.json();
        document.getElementById('loading-screen').style.display = 'none';

        allSubjects = data.subjects || [];
        allActiveSessions = data.sessions || [];

        renderSubjectCards();
        startAutoRefresh();
    } catch (e) {
        document.getElementById('loading-screen').style.display = 'none';
        Swal.fire({...swalDark, icon:'error', text: 'تعذر تحميل البيانات'});
    }
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
        const res = await fetch(
            `/api/student-init?year=${encodeURIComponent(currentStudent.year)}` +
            `&dept=${encodeURIComponent(currentStudent.department)}` +
            `&student_id=${encodeURIComponent(currentStudent.student_id)}`
        );
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
        // silent
    }
}

/* =========================================================
   ✅ Force refresh لما الطالب يرجع للتاب أو يفتح النافذة
   ========================================================= */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentStudent && typeof refreshSessionStatus === 'function') {
        refreshSessionStatus();
    }
});

window.addEventListener('focus', () => {
    if (currentStudent && typeof refreshSessionStatus === 'function') {
        refreshSessionStatus();
    }
});

/* =========================================================
   ✅ عرض جلسات المادة — نسخة محسّنة (بدون تعليق)
   ========================================================= */
async function selectSubjectForAttendance(subId, subName) {
    // ✅ 1. اعرض الجلسات من البيانات المحلية فوراً (بدون انتظار)
    const localSessions = allActiveSessions.filter(s => s.subject_id === subId);

    // ✅ 2. اعرض المودال فوراً - تجربة سلسة
    showSessionsModal(localSessions, subId, subName);

    // ✅ 3. في الخلفية (بدون blocking) - حدّث البيانات
    refreshSessionsInBackground(subId, subName);
}

/* ✅ دالة عرض المودال - منفصلة عشان نستخدمها مرتين */
function showSessionsModal(sessions, subId, subName) {
    if (sessions.length === 0) {
        return Swal.fire({
            ...swalDark,
            icon: 'info',
            title: subName,
            text: 'لا توجد محاضرات أو سكاشن مفتوحة لتسجيل الحضور لهذه المادة في الوقت الحالي.'
        });
    }

    const classBadge = currentStudent && currentStudent.class_number
        ? `<div style="margin-bottom:10px; padding:8px 12px; background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); border-radius:10px; font-size:12px; color:#22d3ee; font-weight:800; text-align:right;">
             <i class="fas fa-layer-group"></i> فصلك: Class ${currentStudent.class_number}
           </div>`
        : '';

    const buttonsHtml = classBadge + sessions.map(s => `
        <div style="background:#1F2937; padding:12px; border-radius:10px; margin-bottom:8px; cursor:pointer; text-align:right; border:1px solid var(--border);" onclick="openVerifyModal('${s.session_id}', '${s.title}', '${subName}', '${s.type}')">
            <b style="color:var(--gold); font-size:15px;">${s.title}</b>
            <span style="font-size:11px; background:rgba(255,179,0,0.15); color:var(--gold); padding:2px 8px; border-radius:6px; margin-right:5px;">${s.type === 'Lecture' ? 'محاضرة' : 'سكشن'}</span>
            <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">المحاضر: ${s.created_by}</p>
        </div>
    `).join('');

    Swal.fire({
        ...swalDark,
        title: `الجلسات المتاحة (${subName})`,
        html: buttonsHtml,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق'
    });
}

/* ✅ تحديث في الخلفية - بدون blocking */
async function refreshSessionsInBackground(subId, subName) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 ثواني max

        const res = await fetch(
            `/api/student-init?year=${encodeURIComponent(currentStudent.year)}` +
            `&dept=${encodeURIComponent(currentStudent.department)}` +
            `&student_id=${encodeURIComponent(currentStudent.student_id)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data.status === 'success') {
            allSubjects = data.subjects || allSubjects;
            allActiveSessions = data.sessions || [];
            renderSubjectCards();
            // ملاحظة: لا نعيد فتح المودال - عشان ما نزعجش المستخدم
        }
    } catch (e) {
        // فشل/timeout - نستخدم البيانات المحلية اللي معروضة بالفعل
        console.debug('Background refresh skipped:', e.message);
    }
}

/* =========================================================
   ✅ فتح نافذة تأكيد الحضور — نسخة محسّنة
   ========================================================= */
function openVerifyModal(sessId, title, subName, type) {
    Swal.close();
    qrAutoSubmitLocked = false;
    selectedSession = sessId;

    // ✅ 1. اعرض المودال فوراً (بدون أي انتظار)
    document.getElementById('modal-sess-title').innerText =
        `${title} (${type === 'Lecture' ? 'محاضرة' : 'سكشن'})`;
    document.getElementById('modal-sess-sub').innerText = subName;
    document.getElementById('totp-input').value = '';
    document.getElementById('verify-modal').style.display = 'flex';

    // ✅ 2. في الخلفية - افحص لو الطالب مسجل قبل كده (non-blocking)
    checkIfAlreadyRegistered(sessId);
}

/* ✅ فحص إذا كان الطالب مسجل بالفعل - بدون blocking */
async function checkIfAlreadyRegistered(sessId) {
    // ✅ جرّب الكاش الأول
    let history = nxCache.get('history');

    if (!history) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch('/api/student-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: currentStudent.student_id }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            history = data.history || [];
            nxCache.set('history', history);
        } catch (e) {
            // فشل الفحص - الطالب يقدر يجرب عادي، والسيرفر هيرفض لو مسجل
            console.debug('History check skipped:', e.message);
            return;
        }
    }

    // ✅ تحقق: لو الطالب لسه فاتح نفس الجلسة ومسجل بالفعل
    if (selectedSession === sessId) {
        const already = history.find(h => h.session_id === sessId);
        if (already) {
            closeVerifyModal();
            Swal.fire({
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
   📷 QR Scanner
   ========================================================= */
async function stopQrReader() {
    const r = document.getElementById('reader');

    if (html5Qr) {
        try {
            const state = html5Qr.getState ? html5Qr.getState() : null;
            if (state === 2 || state === 3) {
                try { await html5Qr.stop(); } catch (e) {}
            }
            try { html5Qr.clear(); } catch (e) {}
        } catch (e) {}
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

    if (r.style.display === 'block' || html5Qr) {
        await stopQrReader();
        return;
    }

    if (qrScannerStarting) return;
    qrScannerStarting = true;

    r.style.display = 'block';
    r.innerHTML = '<div style="text-align:center; padding:20px; color:#FFB300;"><i class="fas fa-spinner fa-spin fa-2x"></i><br><br>جاري تشغيل الكاميرا...</div>';

    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        if (html5Qr) {
            try { await html5Qr.stop(); } catch(e) {}
            try { html5Qr.clear(); } catch(e) {}
            html5Qr = null;
        }

        r.innerHTML = '';
        html5Qr = new Html5Qrcode("reader", { verbose: false });

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

        const onScanSuccess = (decodedText) => {
            if (qrAutoSubmitLocked) return;

            const raw = (decodedText || '').trim();

            /* ✅ فحص كود ربط الشاشة فور المسح */
            if (raw.toUpperCase().startsWith('SCR')) {
                qrAutoSubmitLocked = true;
                stopQrReader();
                showPairingCodeWarning().then(() => {
                    qrAutoSubmitLocked = false;
                });
                return;
            }

            qrAutoSubmitLocked = true;

            const input = document.getElementById('totp-input');
            const cleanCode = raw.substring(0, 6).toUpperCase();
            if (input) input.value = cleanCode;

            stopQrReader();

            setTimeout(() => {
                submitAttendanceFinal(true);
            }, 250);
        };

        const onScanError = () => {};

        let started = false;
        let lastError = null;

        try {
            await html5Qr.start({ facingMode: "environment" }, config, onScanSuccess, onScanError);
            started = true;
        } catch (err1) { lastError = err1; }

        if (!started) {
            try {
                await html5Qr.start({ facingMode: "user" }, config, onScanSuccess, onScanError);
                started = true;
            } catch (err2) { lastError = err2; }
        }

        if (!started) {
            try {
                const devices = await Html5Qrcode.getCameras();
                if (devices && devices.length > 0) {
                    await html5Qr.start(devices[0].id, config, onScanSuccess, onScanError);
                    started = true;
                }
            } catch (err3) { lastError = err3; }
        }

        if (!started) throw lastError || new Error("No camera available");

        qrScannerStarting = false;

    } catch (err) {
        qrScannerStarting = false;
        await stopQrReader();

        const errStr = String(err).toLowerCase();
        let title = 'تعذر تشغيل الكاميرا';
        let msg = 'حدث خطأ غير متوقع، جرب مرة أخرى';

        if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
            title = 'صلاحية الكاميرا مرفوضة';
            msg = 'يرجى السماح بالوصول للكاميرا من إعدادات المتصفح';
        } else if (errStr.includes('notfound') || errStr.includes('no camera')) {
            title = 'لا توجد كاميرا';
            msg = 'هذا الجهاز لا يحتوي على كاميرا متاحة';
        } else if (errStr.includes('notreadable') || errStr.includes('in use')) {
            title = 'الكاميرا مشغولة';
            msg = 'الكاميرا مستخدمة من تطبيق آخر';
        } else if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            title = 'اتصال غير آمن';
            msg = 'تشغيل الكاميرا يحتاج اتصال HTTPS';
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
            `
        });
    }
}

/* =========================================================
   ✅ إرسال الحضور
   ========================================================= */
async function submitAttendanceFinal(fromQr = false) {
    const rawCode = document.getElementById('totp-input').value.trim();

    /* ✅ فحص كود ربط الشاشة أولاً */
    if (isPairingCode(rawCode)) {
        document.getElementById('totp-input').value = '';
        qrAutoSubmitLocked = false;
        return showPairingCodeWarning();
    }

    const code = rawCode;
    if (code.length !== 6) {
        return Swal.fire({...swalDark, icon:'warning', text:'الرمز السري يتكون من 6 خانات!'});
    }

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
                </div>
            `
        });
    }

    Swal.fire({title: 'جاري تسجيل حضورك...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});

    try {
        const res = await fetch('/api/submit-attendance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_id: currentStudent.student_id,
                student_name: currentStudent.name,
                session_id: selectedSession,
                code: code,
                device_token: getDeviceToken(),
                scan_type: fromQr ? 'qr' : 'manual'
            })
        });
        const data = await res.json();
        if(res.ok) {
            setDeviceOwner(currentStudent.student_id, currentStudent.name);

            // ✅ امسح الكاش عشان المرة الجاية يجيب history محدّث
            nxCache.clear('history');

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
            if (fromQr) qrAutoSubmitLocked = false;
            Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
        }
    } catch (e) {
        if (fromQr) qrAutoSubmitLocked = false;
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: 'تعذر الاتصال بالسيرفر'});
    }
}

/* =========================================================
   📜 سجل الحضور
   ========================================================= */
async function openHistoryModal() {
    document.getElementById('history-modal').style.display = 'flex';
    const list = document.getElementById('history-list-container');
    list.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i></div>`;

    try {
        // ✅ جرّب الكاش الأول
        let history = nxCache.get('history');

        if (!history) {
            const res = await fetch('/api/student-history', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({student_id: currentStudent.student_id})
            });
            const data = await res.json();
            history = data.history || [];
            nxCache.set('history', history);
        }

        if(!history || history.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fas fa-box-open fa-3x" style="color:var(--border); margin-bottom:15px;"></i><h3 style="color:#fff;">لا يوجد حضور مسجل بعد</h3></div>`;
            return;
        }
        list.innerHTML = history.map(h => `
            <div class="comp-card">
                <div class="comp-header">
                    <span class="comp-sub">${h.subject_name}</span>
                    <span class="badge-resolved"><i class="fas fa-check-circle"></i> حاضر</span>
                </div>
                <p style="color:#fff; font-size:14px; margin:5px 0;">${h.session_title} (${h.session_type === 'Lecture' ? 'محاضرة' : 'سكشن'})</p>
                <span style="font-size:12px; color:var(--text-muted); font-family:monospace;"><i class="far fa-clock"></i> ${h.timestamp}</span>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<div class="empty-state"><h3 style="color:#f87171;">تعذر تحميل السجل</h3></div>`;
    }
}

function closeHistoryModal() {
    document.getElementById('history-modal').style.display = 'none';
}
