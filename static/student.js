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
   💾 Cache بسيط
   ========================================================= */
const nxCache = {
    history: { data: null, ts: 0, ttl: 30000 },

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
    if (!t) {
        t = 'DEV_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem('nx_device_token', t);
    }
    return t;
}

/* =========================================================
   🛡️ فحص كود ربط الشاشة
   ========================================================= */
function isPairingCode(code) {
    if (typeof code !== 'string') return false;
    return code.trim().toUpperCase().startsWith('SCR');
}

function showPairingCodeWarning() {
    return Swal.fire({
        ...swalDark,
        icon: 'warning',
        title: 'هذا الكود ينسخه الدكتور / المعيد فقط',
        confirmButtonText: 'حسناً'
    });
}

/* =========================================================
   ✅ AUTO-LOGIN + Year/Dept Handler
   ========================================================= */
window.addEventListener('load', () => {
    const yearSelect = document.getElementById('login-year');
    const deptSelect = document.getElementById('login-dept');

    if (yearSelect && deptSelect) {
        yearSelect.addEventListener('change', (e) => {
            const isYear34 = (e.target.value === 'الفرقة الثالثة' || e.target.value === 'الفرقة الرابعة');
            deptSelect.style.display = isYear34 ? 'block' : 'none';
            if (!isYear34) deptSelect.value = '';
        });
    }

    const saved = localStorage.getItem('nx_student_auth');
    if (saved) {
        try {
            currentStudent = JSON.parse(saved);
            // Show loading FIRST to avoid blank moment
            const loadingEl = document.getElementById('loading-screen');
            const authEl = document.getElementById('auth-screen');
            if (loadingEl) loadingEl.style.display = 'flex';
            if (authEl) authEl.style.display = 'none';
            showStudentUI();
        } catch (e) {
            localStorage.removeItem('nx_student_auth');
            const loadingEl = document.getElementById('loading-screen');
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }
});

/* =========================================================
   ✅ تسجيل الدخول — صفحة واحدة
   ========================================================= */
async function loginStudent() {
    const name = document.getElementById('login-name').value.trim();
    const idInput = document.getElementById('login-id');
    idInput.value = idInput.value.replace(/[^0-9]/g, '');
    const id = idInput.value.trim();
    const year = document.getElementById('login-year').value;
    const deptSelect = document.getElementById('login-dept');
    const isYear34 = (year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة');
    const dept = isYear34 ? (deptSelect ? deptSelect.value : '') : 'عام (IT)';

    if (!name || name.length < 3) {
        return Swal.fire({...swalDark, icon: 'warning', text: 'يرجى إدخال اسم الطالب بشكل صحيح!'});
    }
    if (id.length !== 7 || isNaN(id)) {
        return Swal.fire({...swalDark, icon: 'warning', text: 'رقم الـ ID يجب أن يتكون من 7 أرقام!'});
    }
    if (!year) {
        return Swal.fire({...swalDark, icon: 'warning', text: 'يرجى اختيار الفرقة الدراسية!'});
    }
    if (isYear34 && !dept) {
        return Swal.fire({...swalDark, icon: 'warning', text: 'يرجى اختيار القسم!'});
    }

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
            } catch (e) {}
        } else {
            return;
        }
    }

    // 🔥 Show loading screen IMMEDIATELY (before closing Swal)
    const loadingEl = document.getElementById('loading-screen');
    if (loadingEl) loadingEl.style.display = 'flex';

    Swal.fire({
        title: 'جاري التحقق...',
        background: '#1a1f2c',
        color: '#fff',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const res = await fetch('/api/student-login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                student_name: name,
                student_id: id,
                year: year,
                department: dept
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            currentStudent = data.student;
            localStorage.setItem('nx_student_auth', JSON.stringify(currentStudent));
            Swal.close();
            showStudentUI();
        } else {
            Swal.close();
            if (loadingEl) loadingEl.style.display = 'none';
            Swal.fire({...swalDark, icon: 'error', text: data.message || 'فشل التسجيل'});
        }
    } catch (e) {
        Swal.close();
        if (loadingEl) loadingEl.style.display = 'none';
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال بالسيرفر'});
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
    if (classChip) classChip.style.display = 'none';

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
   📊 تحميل الداشبورد (مع Retry)
   ========================================================= */
async function loadDashboard() {
    const loadingEl = document.getElementById('loading-screen');
    if (loadingEl) loadingEl.style.display = 'flex';
    try {
        const res = await fetch(
            `/api/student-init?year=${encodeURIComponent(currentStudent.year)}` +
            `&dept=${encodeURIComponent(currentStudent.department)}` +
            `&student_id=${encodeURIComponent(currentStudent.student_id)}`
        );
        const data = await res.json();
        if (loadingEl) loadingEl.style.display = 'none';

        allSubjects = data.subjects || [];
        allActiveSessions = data.sessions || [];

        renderSubjectCards();
        startAutoRefresh();
    } catch (e) {
        if (loadingEl) loadingEl.style.display = 'none';
        const r = await Swal.fire({
            icon: 'error',
            title: 'تعذر تحميل البيانات',
            text: 'تحقق من الاتصال بالسيرفر',
            showCancelButton: true,
            confirmButtonText: 'إعادة المحاولة',
            cancelButtonText: 'تسجيل الخروج',
            confirmButtonColor: '#FFB300',
            cancelButtonColor: '#EF4444',
            background: '#1a1f2c',
            color: '#fff'
        });
        if (r.isConfirmed) loadDashboard();
        else if (r.dismiss === Swal.DismissReason.cancel) logoutStudent();
    }
}

function renderSubjectCards() {
    const container = document.getElementById('subjects-container');

    if (allSubjects.length === 0) {
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
    } catch (err) {}
}

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
   ✅ عرض جلسات المادة
   ========================================================= */
async function selectSubjectForAttendance(subId, subName) {
    const localSessions = allActiveSessions.filter(s => s.subject_id === subId);
    showSessionsModal(localSessions, subId, subName);
    refreshSessionsInBackground(subId, subName);
}

/* =========================================================
   🎨 المودال الاحترافي · قائمة سكرول واحدة
   ========================================================= */
function showSessionsModal(sessions, subId, subName) {
    if (sessions.length === 0) {
        return Swal.fire({
            ...swalDark,
            icon: 'info',
            title: subName,
            text: 'لا توجد محاضرات أو سكاشن مفتوحة لتسجيل الحضور لهذه المادة في الوقت الحالي.'
        });
    }

    const sorted = [...sessions].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'Lecture' ? -1 : 1;
        return (b.session_id || '').localeCompare(a.session_id || '');
    });

    const countLect = sessions.filter(s => s.type === 'Lecture').length;
    const countSec = sessions.filter(s => s.type === 'Section').length;

    const cardsHtml = sorted.map((s, idx) => {
        const isLecture = s.type === 'Lecture';
        const typeIcon = isLecture ? 'fa-chalkboard-teacher' : 'fa-users';
        const typeLabel = isLecture ? 'محاضرة' : 'سكشن';
        const typeColor = isLecture ? '#FFD54F' : '#60A5FA';
        const typeColorDark = isLecture ? '#FFB300' : '#3B82F6';
        const typeGlow = isLecture ? 'rgba(255,179,0,0.35)' : 'rgba(59,130,246,0.35)';

        const creatorRole = s.creator_role || 'doctor';
        const isTA = (creatorRole === 'ta');
        const creatorPrefix = isTA ? 'م.' : 'د.';
        const creatorIcon = isTA ? 'fa-user-graduate' : 'fa-user-tie';
        const creatorColor = isTA ? '#60A5FA' : '#34D399';
        const creatorName = (s.created_by || '').trim() || 'غير معروف';

        const safeTitle = (s.title || '').replace(/'/g, "\\'");
        const safeSub = (subName || '').replace(/'/g, "\\'");

        return `
            <div class="lux-sess-card ${isLecture ? 'lux-lecture' : 'lux-section'}"
                 style="--tc:${typeColor}; --tcd:${typeColorDark}; --tglow:${typeGlow}; --delay:${idx * 40}ms;"
                 onclick="openVerifyModal('${s.session_id}', '${safeTitle}', '${safeSub}', '${s.type}')">

                <div class="lux-card-glow"></div>

                <div class="lux-card-left">
                    <div class="lux-icon-wrap">
                        <i class="fas ${typeIcon}"></i>
                        <span class="lux-icon-ring"></span>
                    </div>
                </div>

                <div class="lux-card-body">
                    <div class="lux-type-badge">
                        <i class="fas ${typeIcon}"></i>
                        <span>${typeLabel}</span>
                    </div>

                    <div class="lux-title">${s.title}</div>

                    <div class="lux-creator" style="--cc:${creatorColor};">
                        <span class="lux-creator-avatar">
                            <i class="fas ${creatorIcon}"></i>
                        </span>
                        <span class="lux-creator-name">${creatorPrefix} ${creatorName}</span>
                    </div>
                </div>

                <div class="lux-card-arrow">
                    <i class="fas fa-arrow-left"></i>
                </div>
            </div>
        `;
    }).join('');

    Swal.fire({
        ...swalDark,
        width: 540,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fas fa-times"></i> إغلاق',
        cancelButtonColor: '#374151',
        customClass: { popup: 'lux-modal-popup' },
        html: `
            <style>
                .lux-modal-popup {
                    padding: 24px 20px 18px !important;
                    border-radius: 28px !important;
                    background:
                        radial-gradient(700px circle at 100% -10%, rgba(255,179,0,0.14), transparent 55%),
                        radial-gradient(600px circle at -10% 110%, rgba(124,58,237,0.10), transparent 55%),
                        radial-gradient(500px circle at 50% 50%, rgba(6,182,212,0.04), transparent 60%),
                        linear-gradient(165deg, #141a2b 0%, #0a0e18 100%) !important;
                    border: 1px solid rgba(255,179,0,0.18) !important;
                    box-shadow:
                        0 40px 100px rgba(0,0,0,0.85),
                        0 0 0 1px rgba(255,255,255,0.04),
                        inset 0 1px 0 rgba(255,255,255,0.06) !important;
                    overflow: hidden;
                    position: relative;
                }
                .lux-modal-popup::before {
                    content: "";
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    background: linear-gradient(90deg,
                        transparent, #FFB300 20%, #FFD54F 50%, #FFB300 80%, transparent);
                    background-size: 200% 100%;
                    animation: luxTopShimmer 4s linear infinite;
                    box-shadow: 0 0 30px rgba(255,179,0,0.6);
                    z-index: 5;
                }
                @keyframes luxTopShimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position:  200% 0; }
                }

                .lux-head {
                    position: relative;
                    padding: 2px 4px 16px;
                    margin-bottom: 14px;
                    text-align: center;
                }
                .lux-head::after {
                    content: "";
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 70%;
                    height: 1px;
                    background: linear-gradient(90deg,
                        transparent, rgba(255,179,0,0.4) 50%, transparent);
                }

                .lux-head-icon {
                    position: relative;
                    width: 58px;
                    height: 58px;
                    margin: 0 auto 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 20px;
                    background: linear-gradient(135deg,
                        rgba(255,179,0,0.25),
                        rgba(255,213,79,0.15),
                        rgba(124,58,237,0.15));
                    border: 1.5px solid rgba(255,179,0,0.5);
                    box-shadow:
                        0 0 40px rgba(255,179,0,0.35),
                        inset 0 0 24px rgba(255,179,0,0.15);
                    animation: luxHeadFloat 3.5s ease-in-out infinite;
                }
                @keyframes luxHeadFloat {
                    0%,100% { transform: translateY(0) rotate(0deg); }
                    50%     { transform: translateY(-4px) rotate(-3deg); }
                }
                .lux-head-icon::before {
                    content: "";
                    position: absolute;
                    inset: -6px;
                    border-radius: 24px;
                    border: 1px solid rgba(255,179,0,0.25);
                    animation: luxHeadRing 2.5s ease-in-out infinite;
                }
                @keyframes luxHeadRing {
                    0%,100% { transform: scale(1); opacity: 0.6; }
                    50%     { transform: scale(1.15); opacity: 0; }
                }
                .lux-head-icon i {
                    color: #FFD54F;
                    font-size: 24px;
                    filter: drop-shadow(0 0 14px rgba(255,179,0,0.9));
                    animation: luxHeadIcon 3s ease-in-out infinite;
                }
                @keyframes luxHeadIcon {
                    0%,100% { transform: scale(1); }
                    50%     { transform: scale(1.12); }
                }

                .lux-head-sub {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-family: 'Cairo', sans-serif;
                    font-size: 11.5px;
                    font-weight: 800;
                    color: #FFD54F;
                    letter-spacing: 0.5px;
                    padding: 4px 14px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, rgba(255,179,0,0.15), rgba(255,179,0,0.05));
                    border: 1px solid rgba(255,179,0,0.35);
                    margin-bottom: 10px;
                    box-shadow: 0 0 16px rgba(255,179,0,0.15);
                }
                .lux-head-sub i {
                    font-size: 10px;
                    animation: luxPointDown 1.5s ease-in-out infinite;
                }
                @keyframes luxPointDown {
                    0%,100% { transform: translateY(0); }
                    50%     { transform: translateY(3px); }
                }

                .lux-head-title {
                    font-family: 'Cairo', sans-serif;
                    font-size: 24px;
                    font-weight: 900;
                    background: linear-gradient(120deg,
                        #ffffff 0%, #ffd76a 40%, #ffffff 70%, #ffd76a 100%);
                    background-size: 200% 100%;
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    line-height: 1.3;
                    letter-spacing: 0.3px;
                    animation: luxTitleShine 5s ease-in-out infinite;
                    filter: drop-shadow(0 4px 16px rgba(255,179,0,0.3));
                }
                @keyframes luxTitleShine {
                    0%,100% { background-position: 0% 50%; }
                    50%     { background-position: 100% 50%; }
                }

                .lux-summary {
                    display: flex;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 14px;
                    padding: 0 4px;
                    flex-wrap: wrap;
                }
                .lux-summary-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-family: 'Cairo', sans-serif;
                    font-size: 11.5px;
                    font-weight: 800;
                    color: #b8c0d4;
                    padding: 5px 13px;
                    border-radius: 10px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    letter-spacing: 0.2px;
                }
                .lux-summary-item b {
                    color: #fff;
                    font-weight: 900;
                    font-size: 13px;
                }
                .lux-summary-item i { font-size: 11px; }

                .lux-scroll-wrap {
                    position: relative;
                    max-height: 55vh;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 6px 10px 6px 4px;
                    margin: 0 -6px;
                    border-radius: 16px;
                    background: rgba(0,0,0,0.15);
                    scroll-behavior: smooth;
                    scrollbar-width: thin;
                    scrollbar-color: #FFB300 rgba(0,0,0,0.3);
                }

                .lux-scroll-wrap::-webkit-scrollbar {
                    width: 8px;
                }
                .lux-scroll-wrap::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.35);
                    border-radius: 8px;
                    margin: 4px 0;
                    border: 1px solid rgba(255,255,255,0.03);
                }
                .lux-scroll-wrap::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg,
                        #FFE082 0%,
                        #FFD54F 30%,
                        #FFB300 70%,
                        #FF8F00 100%);
                    border-radius: 8px;
                    border: 1px solid rgba(255,179,0,0.6);
                    box-shadow:
                        0 0 12px rgba(255,179,0,0.6),
                        inset 0 1px 2px rgba(255,255,255,0.4);
                    transition: all 0.3s ease;
                }
                .lux-scroll-wrap::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg,
                        #FFF3C4 0%,
                        #FFE082 30%,
                        #FFD54F 70%,
                        #FFB300 100%);
                    box-shadow:
                        0 0 20px rgba(255,179,0,0.9),
                        inset 0 1px 2px rgba(255,255,255,0.6);
                    border-color: #FFD54F;
                }

                .lux-scroll-wrap::before {
                    content: "";
                    position: sticky;
                    top: 0;
                    left: 0; right: 0;
                    height: 12px;
                    margin: -6px -10px 0 -4px;
                    background: linear-gradient(180deg,
                        rgba(20,26,43,0.9) 0%,
                        transparent 100%);
                    pointer-events: none;
                    z-index: 3;
                    display: block;
                }
                .lux-scroll-wrap::after {
                    content: "";
                    position: sticky;
                    bottom: 0;
                    left: 0; right: 0;
                    height: 16px;
                    margin: 0 -10px -6px -4px;
                    background: linear-gradient(0deg,
                        rgba(20,26,43,0.9) 0%,
                        transparent 100%);
                    pointer-events: none;
                    z-index: 3;
                    display: block;
                }

                .lux-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding: 2px 0;
                }

                .lux-sess-card {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 13px;
                    padding: 15px 16px;
                    border-radius: 16px;
                    cursor: pointer;
                    overflow: hidden;
                    background:
                        linear-gradient(155deg,
                            rgba(30,42,64,0.85) 0%, rgba(15,20,33,0.98) 100%);
                    border: 1.5px solid rgba(255,255,255,0.07);
                    box-shadow:
                        0 6px 24px rgba(0,0,0,0.45),
                        inset 0 1px 0 rgba(255,255,255,0.05);
                    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                    animation: luxCardEnter 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
                    animation-delay: var(--delay, 0ms);
                }
                @keyframes luxCardEnter {
                    from { opacity: 0; transform: translateY(14px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }

                .lux-sess-card::before {
                    content: "";
                    position: absolute;
                    top: 0; right: 0;
                    width: 4px;
                    height: 100%;
                    background: linear-gradient(180deg, var(--tc), transparent 90%);
                    box-shadow: 0 0 20px var(--tglow);
                    z-index: 3;
                }

                .lux-card-glow {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(400px circle at 100% 50%,
                        var(--tglow), transparent 45%);
                    opacity: 0;
                    transition: opacity 0.45s ease;
                    pointer-events: none;
                    z-index: 1;
                }

                .lux-sess-card:hover {
                    transform: translateY(-4px) scale(1.015);
                    border-color: var(--tcd);
                    box-shadow:
                        0 18px 40px rgba(0,0,0,0.6),
                        0 0 0 1px var(--tglow),
                        0 0 30px var(--tglow),
                        inset 0 1px 0 rgba(255,255,255,0.1);
                    background:
                        linear-gradient(155deg,
                            rgba(42,55,82,0.9) 0%, rgba(20,26,42,0.98) 100%);
                }
                .lux-sess-card:hover .lux-card-glow { opacity: 1; }

                .lux-card-left {
                    position: relative;
                    z-index: 2;
                    flex-shrink: 0;
                }
                .lux-icon-wrap {
                    position: relative;
                    width: 52px;
                    height: 52px;
                    border-radius: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg,
                        rgba(255,255,255,0.06), rgba(0,0,0,0.4));
                    border: 1.5px solid var(--tglow);
                    box-shadow:
                        0 0 20px var(--tglow),
                        inset 0 0 16px rgba(0,0,0,0.3);
                    transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .lux-icon-wrap i {
                    font-size: 21px;
                    color: var(--tc);
                    filter: drop-shadow(0 0 10px var(--tglow));
                    transition: all 0.4s ease;
                }
                .lux-icon-ring {
                    position: absolute;
                    inset: -4px;
                    border-radius: 19px;
                    border: 1px solid var(--tglow);
                    opacity: 0;
                    transition: all 0.4s ease;
                }
                .lux-sess-card:hover .lux-icon-wrap {
                    transform: scale(1.08) rotate(-6deg);
                }
                .lux-sess-card:hover .lux-icon-wrap i {
                    transform: scale(1.15);
                }
                .lux-sess-card:hover .lux-icon-ring {
                    opacity: 1;
                    animation: luxIconRing 1.8s ease-in-out infinite;
                }
                @keyframes luxIconRing {
                    0%,100% { transform: scale(1); opacity: 0.7; }
                    50%     { transform: scale(1.18); opacity: 0; }
                }

                .lux-card-body {
                    flex: 1;
                    min-width: 0;
                    position: relative;
                    z-index: 2;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    text-align: right;
                }

                .lux-type-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    align-self: flex-end;
                    font-family: 'Cairo', sans-serif;
                    font-size: 10.5px;
                    font-weight: 900;
                    color: var(--tc);
                    padding: 3px 11px;
                    border-radius: 20px;
                    background: linear-gradient(135deg,
                        rgba(255,255,255,0.08), rgba(0,0,0,0.3));
                    border: 1px solid var(--tglow);
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                    box-shadow: 0 0 10px var(--tglow);
                }
                .lux-type-badge i { font-size: 10px; }

                .lux-title {
                    font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
                    font-size: 17px;
                    font-weight: 900;
                    color: #ffffff;
                    direction: ltr;
                    text-align: right;
                    letter-spacing: 0.5px;
                    line-height: 1.3;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    text-shadow:
                        0 2px 8px rgba(0,0,0,0.6),
                        0 0 20px rgba(255,255,255,0.05);
                    transition: all 0.35s ease;
                }
                .lux-sess-card:hover .lux-title {
                    color: var(--tc);
                    text-shadow:
                        0 2px 12px rgba(0,0,0,0.7),
                        0 0 24px var(--tglow);
                }

                .lux-creator {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    align-self: flex-end;
                    padding: 4px 11px 4px 5px;
                    border-radius: 20px;
                    background: linear-gradient(135deg,
                        rgba(255,255,255,0.05), rgba(0,0,0,0.25));
                    border: 1px solid rgba(255,255,255,0.08);
                    transition: all 0.3s ease;
                }
                .lux-creator-avatar {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, var(--cc), rgba(0,0,0,0.4));
                    color: #0a0e17;
                    font-size: 10px;
                    box-shadow: 0 0 10px var(--cc);
                    flex-shrink: 0;
                }
                .lux-creator-name {
                    font-family: 'Cairo', sans-serif;
                    font-size: 11.5px;
                    font-weight: 800;
                    color: #d4d9e6;
                    letter-spacing: 0.3px;
                    white-space: nowrap;
                }
                .lux-sess-card:hover .lux-creator {
                    border-color: var(--cc);
                    box-shadow: 0 0 14px var(--cc);
                }
                .lux-sess-card:hover .lux-creator-name {
                    color: var(--cc);
                }

                .lux-card-arrow {
                    position: relative;
                    z-index: 2;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.25);
                    font-size: 12px;
                    flex-shrink: 0;
                    transition: all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
                }
                .lux-sess-card:hover .lux-card-arrow {
                    background: var(--tcd);
                    border-color: var(--tcd);
                    color: #0a0e17;
                    transform: translateX(-6px) scale(1.1);
                    box-shadow: 0 0 24px var(--tglow);
                }

                @media (max-width: 520px) {
                    .lux-modal-popup { padding: 20px 14px 16px !important; border-radius: 24px !important; }
                    .lux-head { padding-bottom: 12px; margin-bottom: 12px; }
                    .lux-head-icon { width: 50px; height: 50px; border-radius: 16px; margin-bottom: 10px; }
                    .lux-head-icon i { font-size: 21px; }
                    .lux-head-sub { font-size: 10.5px; padding: 3px 11px; }
                    .lux-head-title { font-size: 19px; }
                    .lux-summary { margin-bottom: 10px; gap: 6px; }
                    .lux-summary-item { font-size: 10.5px; padding: 4px 10px; }
                    .lux-summary-item b { font-size: 12px; }
                    .lux-scroll-wrap {
                        max-height: 58vh;
                        padding: 4px 8px 4px 2px;
                        margin: 0 -4px;
                    }
                    .lux-scroll-wrap::-webkit-scrollbar { width: 6px; }
                    .lux-list { gap: 9px; }
                    .lux-sess-card { padding: 13px 14px; gap: 11px; border-radius: 14px; }
                    .lux-icon-wrap { width: 46px; height: 46px; border-radius: 13px; }
                    .lux-icon-wrap i { font-size: 18px; }
                    .lux-title { font-size: 15px; }
                    .lux-type-badge { font-size: 10px; padding: 3px 10px; }
                    .lux-creator-name { font-size: 10.5px; }
                    .lux-creator-avatar { width: 20px; height: 20px; font-size: 9px; }
                    .lux-card-arrow { width: 28px; height: 28px; font-size: 11px; }
                }
            </style>

            <div class="lux-head">
                <div class="lux-head-icon">
                    <i class="fas fa-book-open"></i>
                </div>

                <div class="lux-head-sub">
                    <span>اختر الجلسة لتسجيل الحضور</span>
                    <i class="fas fa-hand-point-down"></i>
                </div>

                <div class="lux-head-title">${subName}</div>
            </div>

            <div class="lux-summary">
                ${countLect > 0 ? `
                    <span class="lux-summary-item">
                        <i class="fas fa-chalkboard-teacher" style="color:#FFB300;"></i>
                        <b>${countLect}</b> محاضرة
                    </span>
                ` : ''}
                ${countSec > 0 ? `
                    <span class="lux-summary-item">
                        <i class="fas fa-users" style="color:#3B82F6;"></i>
                        <b>${countSec}</b> سكشن
                    </span>
                ` : ''}
            </div>

            <div class="lux-scroll-wrap">
                <div class="lux-list">
                    ${cardsHtml}
                </div>
            </div>
        `
    });
}

async function refreshSessionsInBackground(subId, subName) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

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
        }
    } catch (e) {
        console.debug('Background refresh skipped:', e.message);
    }
}

/* =========================================================
   ✅ فتح نافذة تأكيد الحضور
   ========================================================= */
function openVerifyModal(sessId, title, subName, type) {
    Swal.close();
    qrAutoSubmitLocked = false;
    selectedSession = sessId;

    document.getElementById('modal-sess-title').innerText =
        `${title} (${type === 'Lecture' ? 'محاضرة' : 'سكشن'})`;
    document.getElementById('modal-sess-sub').innerText = subName;
    document.getElementById('totp-input').value = '';
    document.getElementById('verify-modal').style.display = 'flex';

    checkIfAlreadyRegistered(sessId);
}

async function checkIfAlreadyRegistered(sessId) {
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
            console.debug('History check skipped:', e.message);
            return;
        }
    }

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

        if (res.ok) {
            setDeviceOwner(currentStudent.student_id, currentStudent.name);
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

        if (!history || history.length === 0) {
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