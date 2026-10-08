const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let allData = { subjects:[], sessions:[], staff:[], classes:[] };
let activeLiveSession = null;
let qrGenerator = null;
let liveCodeInterval = null;
let activeSubjectYear = 'all';
let activeSubjectDept = 'all';
let currentInspectedSessionId = null;
let currentSessionRecords = [];
let currentSessionsFilter = null;
let currentAdminRole = 'super_admin';
let currentAdminUsername = '';
let currentAdminAllowedClasses = [];
let lastQrCodeRendered = null;
let manualCodeVisible = false;

/* =========================================================
   🖥️ شاشات التحكم
   ========================================================= */
function showLoading() {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'none';
}
function showLoginScreen() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
}
function showMainApp() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
}

/* =========================================================
   🔑 AUTO-LOGIN
   ========================================================= */
const ADMIN_STORAGE_KEY = 'nx_admin_auth';

function saveAdminCredentials(username, password) {
    try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
            username, password, savedAt: Date.now()
        }));
    } catch (e) {}
}

function getSavedAdminCredentials() {
    try {
        const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || !data.username || !data.password) return null;
        return data;
    } catch (e) { return null; }
}

function clearAdminCredentials() {
    try { localStorage.removeItem(ADMIN_STORAGE_KEY); } catch (e) {}
}

window.onload = async () => {
    const passInput = document.getElementById('pass');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    showLoading();
    const loggedIn = await tryAutoLogin();
    if (!loggedIn) showLoginScreen();
};

async function tryAutoLogin() {
    try {
        const res = await fetch('/api/admin-data', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.status === 'success') {
            allData = data;
            showMainApp();
            applyAdminData(data);
            return true;
        }
    } catch (e) {}

    const saved = getSavedAdminCredentials();
    if (!saved) return false;

    try {
        const res = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username: saved.username, password: saved.password })
        });
        const data = await res.json();
        if (res.ok && data.status === 'success') {
            enterAdminDashboard();
            return true;
        } else {
            clearAdminCredentials();
            return false;
        }
    } catch (e) { return false; }
}

function enterAdminDashboard() { showMainApp(); loadAdminData(); }

async function handleLogin() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value.trim();
    if (!u || !p) return Swal.fire({ ...swalDark, icon: 'warning', text: 'يرجى إدخال البيانات!' });

    Swal.fire({ title: 'جاري التحقق...', background: '#161b26', color: '#fff', didOpen: () => Swal.showLoading() });

    try {
        const res = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        Swal.close();

        if (res.ok && data.status === 'success') {
            saveAdminCredentials(u, p);
            enterAdminDashboard();
        } else {
            Swal.fire({ ...swalDark, icon: 'error', title: 'خطأ', text: data.message || 'بيانات غير صحيحة!' });
        }
    } catch (err) {
        Swal.close();
        Swal.fire({ ...swalDark, icon: 'error', text: 'تعذر الاتصال بالسيرفر!' });
    }
}

async function loadAdminData() {
    try {
        const res = await fetch('/api/admin-data', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.status === 'unauthorized') { clearAdminCredentials(); return location.reload(); }
        allData = data;
        applyAdminData(data);
    } catch (e) {}
}

/* ✅ تحديث صامت في الخلفية */
async function refreshDataSilently() {
    try {
        const res = await fetch('/api/admin-data', { credentials: 'same-origin' });
        const data = await res.json();
        if (data.status === 'success') {
            allData = data;
            applyAdminData(data);
        }
    } catch (e) {}
}

function adminLogout() {
    clearAdminCredentials();
    window.location.href = '/logout-gateway-vip-x9v2-pL7q-2026';
}

/* =========================================================
   تطبيق البيانات
   ========================================================= */
function applyAdminData(data) {
    currentAdminRole = data.currentAdmin.role || 'super_admin';
    currentAdminUsername = data.currentAdmin.username || '';
    currentAdminAllowedClasses = data.currentAdmin.allowed_classes || [];

    const adminName = (data.currentAdmin.name || '').trim() || 'مرحباً';
    const roleMap = {
        super_admin: { label: 'الآدمن الرئيسي', icon: 'fa-shield-halved', cls: 'role-super' },
        doctor: { label: 'دكتور مادة', icon: 'fa-user-tie', cls: 'role-doctor' },
        ta: { label: 'معيد', icon: 'fa-user-graduate', cls: 'role-ta' }
    };
    const role = roleMap[data.currentAdmin.role] || { label: '', icon: 'fa-user', cls: 'role-default' };

    const nameEl = document.getElementById('welcome-name');
    if (nameEl) nameEl.innerText = adminName;

    const badgeEl = document.getElementById('welcome-role-badge');
    if (badgeEl && role.label) {
        badgeEl.className = 'welcome-role-badge ' + role.cls;
        badgeEl.innerHTML = `<i class="fas ${role.icon}"></i><span>${role.label}</span>`;
    }
    const iconEl = document.getElementById('welcome-icon');
    if (iconEl) iconEl.className = 'welcome-icon-wrap ' + role.cls;

    if (data.currentAdmin.role !== 'super_admin') {
        document.querySelectorAll('.super-only').forEach(el => el.style.display = 'none');
    }
    if (data.currentAdmin.role === 'ta') {
        document.querySelectorAll('.staff-manager-only').forEach(el => el.style.display = 'none');
    }

    renderSessionsView();
    renderSubjectsTable();
    renderStaff(data.staff);
}

function switchTab(sec, el) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(`sec-${sec}`).classList.add('active');
    if(el) el.classList.add('active');
    if(window.innerWidth <= 1024) toggleSidebar();
}

/* =========================================================
   🎬 شاشة الجلسات
   ========================================================= */
function renderSessionsView() {
    if (currentSessionsFilter === null) {
        renderAdminSubjectsGrid();
    } else {
        renderSubjectDetails(currentSessionsFilter);
    }
}

function renderAdminSubjectsGrid() {
    const viewSubjects = document.getElementById('sessions-subjects-view');
    const viewSessions = document.getElementById('sessions-list-view');
    if (viewSubjects) viewSubjects.style.display = 'block';
    if (viewSessions) viewSessions.style.display = 'none';

    const grid = document.getElementById('admin-subjects-grid');
    if (!grid) return;

    if (allData.subjects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1;">
                <i class="fas fa-book fa-3x" style="color:var(--nx-line-strong); margin-bottom:14px;"></i>
                <h3 style="color:#fff; font-size:15px; margin:0;">لا توجد مواد مصرح بها لك</h3>
                <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">تواصل مع الإدارة</p>
            </div>`;
        return;
    }

    grid.innerHTML = allData.subjects.map(sub => {
        const safeName = (sub.name || '').replace(/'/g, "\\'");
        return `
            <div class="admin-subject-card" onclick="openSubjectSessions('${sub.id}', '${safeName}')">
                <img src="${sub.image || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'}" alt="${sub.name}">
                <h3>${sub.name}</h3>
                <p>${sub.year || ''}${sub.department ? ' · ' + sub.department : ''}</p>
            </div>
        `;
    }).join('');
}

function openSubjectSessions(subId, subName) {
    currentSessionsFilter = subId;
    const vSubjects = document.getElementById('sessions-subjects-view');
    const vSessions = document.getElementById('sessions-list-view');
    if (vSubjects) vSubjects.style.display = 'none';
    if (vSessions) vSessions.style.display = 'block';
    document.getElementById('sessions-subject-title').innerText = subName;
    renderSubjectDetails(subId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToSubjects() {
    currentSessionsFilter = null;
    closeLiveScreen();
    renderAdminSubjectsGrid();
}

/* =========================================================
   ✅ عرض تفاصيل المادة — حسب الدور
   ========================================================= */
function renderSubjectDetails(subId) {
    const isTA = (currentAdminRole === 'ta');
    const isDoctorOrAdmin = (currentAdminRole === 'doctor' || currentAdminRole === 'super_admin');

    const classesSection = document.getElementById('classes-section');
    const addClassBtn = document.getElementById('btn-add-class');
    const lecturesTitle = document.getElementById('lectures-section-title');
    const newSessionBtn = document.getElementById('btn-new-session');
    const newSessionBtnText = document.getElementById('btn-new-session-text');

    if (classesSection) {
        classesSection.style.display = isTA ? 'none' : 'block';
    }
    if (addClassBtn) {
        addClassBtn.style.display = isDoctorOrAdmin ? 'inline-flex' : 'none';
    }

    if (lecturesTitle) {
        lecturesTitle.innerText = isTA ? 'السكاشن' : 'المحاضرات';
    }

    if (newSessionBtnText) {
        newSessionBtnText.innerText = isTA ? 'سكشن جديد' : 'محاضرة جديدة';
    }

    if (newSessionBtn) {
        if (isTA) {
            newSessionBtn.setAttribute('onclick', 'openNewSectionChoiceModal()');
        } else {
            newSessionBtn.setAttribute('onclick', 'createSessionModal()');
        }
        newSessionBtn.style.display = 'inline-flex';
    }

    renderFilteredSessionsTable(subId);

    if (!isTA) renderClassesTable(subId);
}

/* =========================================================
   ✅ Helper: نوع الجلسة
   ========================================================= */
function getSessionTypeDisplay(sess) {
    const t = sess.type || 'Lecture';
    if (t === 'Lecture') {
        return { icon: 'fa-chalkboard-teacher', label: 'محاضرة', cls: 'type-lecture' };
    } else if (t === 'Section') {
        return { icon: 'fa-users', label: 'سكشن', cls: 'type-section' };
    }
    return { icon: 'fa-book', label: t, cls: '' };
}

/* =========================================================
   ✅ جدول الجلسات — محاضرات للدكتور / سكاشن للمعيد
   ========================================================= */
function renderFilteredSessionsTable(subId) {
    const isTA = (currentAdminRole === 'ta');
    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;

    let filtered;
    if (isTA) {
        filtered = allData.sessions.filter(s =>
            s.subject_id === subId &&
            s.type === 'Section' &&
            s.created_by_username === currentAdminUsername
        );
    } else {
        filtered = allData.sessions.filter(s =>
            s.subject_id === subId &&
            s.type === 'Lecture'
        );
    }

    filtered.sort((a, b) => {
        const idA = String(a.session_id || '');
        const idB = String(b.session_id || '');
        return idB.localeCompare(idA);
    });

    const countBadge = document.getElementById('sessions-count-badge');
    if (countBadge) countBadge.innerText = filtered.length;

    if (filtered.length === 0) {
        const emptyIcon = isTA ? 'fa-users' : 'fa-chalkboard-teacher';
        const emptyTitle = isTA ? 'لا توجد سكاشن بعد' : 'لا توجد محاضرات بعد';
        const emptyHint = isTA
            ? 'اضغط "سكشن جديد" أعلى الصفحة للبدء'
            : 'اضغط "محاضرة جديدة" لإنشاء أول محاضرة';

        tbody.innerHTML = `
            <tr><td colspan="6" style="padding:40px 20px;">
                <div style="text-align:center;">
                    <i class="fas ${emptyIcon} fa-2x" style="color:var(--nx-line-strong); margin-bottom:12px;"></i>
                    <h3 style="color:#fff; font-size:14px; margin:0;">${emptyTitle}</h3>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">${emptyHint}</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => {
        const typeInfo = getSessionTypeDisplay(s);
        const classInfo = s.class_number
            ? `<span style="color:#22d3ee; font-size:10.5px; font-family:monospace;">
                <i class="fas fa-layer-group"></i> Class ${s.class_number}
               </span>`
            : '';

        return `
        <tr class="clickable-row" ondblclick="openSessionAttendanceModal('${s.session_id}')" title="اضغط مرتين لفتح الكشف">
            <td>
                <span class="sess-type-badge ${typeInfo.cls}">
                    <i class="fas ${typeInfo.icon}"></i> ${typeInfo.label}
                </span>
                ${classInfo ? `<div style="margin-top:5px;">${classInfo}</div>` : ''}
            </td>
            <td>
                <b>${s.title}</b>
                <button class="edit-title-btn" onclick="event.stopPropagation(); editSessionTitle('${s.session_id}', '${(s.title || '').replace(/'/g, "\\'")}')" title="تعديل العنوان">
                    <i class="fas fa-pen"></i>
                </button>
            </td>
            <td>
                <button type="button" 
                    class="sess-status ${s.is_open ? 'sess-status-open' : 'sess-status-closed'}" 
                    onclick="event.stopPropagation(); toggleSession('${s.session_id}', ${!s.is_open})">
                    <i class="fas fa-circle"></i> ${s.is_open ? 'مفتوحة' : 'مغلقة'}
                </button>
            </td>
            <td style="color:#fff; font-size:13px;">${s.created_by || '—'}</td>
            <td style="color:var(--text-muted); font-size:11px;">${s.created_at || ''}</td>
            <td>
                <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-gold" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); startLiveBroadcast('${s.session_id}', '${s.title}', '${s.subject_name}')"><i class="fas fa-qrcode"></i> بث</button>
                    <button class="btn btn-outline" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); openSessionAttendanceModal('${s.session_id}')"><i class="fas fa-users"></i> الكشف</button>
                    <button class="btn btn-red" style="padding:6px 10px;" onclick="event.stopPropagation(); deleteSession('${s.session_id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

/* =========================================================
   ✅ تعديل عنوان الجلسة — Optimistic
   ========================================================= */
async function editSessionTitle(sessionId, currentTitle) {
    const { value: newTitle } = await Swal.fire({
        ...swalDark,
        title: 'تعديل عنوان الجلسة',
        input: 'text',
        inputValue: currentTitle,
        inputPlaceholder: 'مثال: LEC 5 أو Class1_Sec1',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#FFB300',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        inputValidator: (value) => {
            if (!value || !value.trim()) return 'يرجى إدخال عنوان!';
            return null;
        }
    });

    if (!newTitle) return;

    const sess = allData.sessions.find(s => s.session_id === sessionId);
    const oldTitle = sess ? sess.title : '';
    if (sess) sess.title = newTitle.trim();
    renderFilteredSessionsTable(currentSessionsFilter);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'update_session_title',
                session_id: sessionId,
                new_title: newTitle.trim()
            })
        });
        const data = await res.json();
        if (data.status !== 'success') {
            if (sess) sess.title = oldTitle;
            renderFilteredSessionsTable(currentSessionsFilter);
            Swal.fire({...swalDark, icon: 'error', text: data.message});
        }
    } catch (e) {
        if (sess) sess.title = oldTitle;
        renderFilteredSessionsTable(currentSessionsFilter);
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال'});
    }
}

/* =========================================================
   ✅ جدول الفصول (للدكتور/الآدمن فقط)
   ========================================================= */
function renderClassesTable(subId) {
    const tbody = document.getElementById('classes-table-body');
    if (!tbody) return;

    const filtered = (allData.classes || []).filter(c => c.subject_id === subId);

    const badge = document.getElementById('classes-count-badge');
    if (badge) badge.innerText = filtered.length;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="4" style="padding:30px 20px;">
                <div style="text-align:center;">
                    <i class="fas fa-layer-group fa-2x" style="color:var(--nx-line-strong); margin-bottom:10px;"></i>
                    <h3 style="color:#fff; font-size:13px; margin:0;">لا توجد فصول</h3>
                    <p style="color:var(--text-muted); font-size:11.5px; margin-top:5px;">اضغط "إضافة فصل جديد" لإنشاء أول فصل</p>
                </div>
            </td></tr>`;
        return;
    }

    filtered.sort((a, b) => (parseInt(a.class_number) || 0) - (parseInt(b.class_number) || 0));

    tbody.innerHTML = filtered.map(c => {
        const classKey = `${c.subject_id}|Class${c.class_number}`;

        const allClassSessions = allData.sessions.filter(s =>
            s.subject_id === c.subject_id &&
            s.type === 'Section' &&
            String(s.class_number) === String(c.class_number)
        );

        const assignedTAs = (allData.staff || []).filter(u =>
            u.role === 'ta' && (u.allowed_classes || []).includes(classKey)
        );

        let chipsHtml = '';
        if (assignedTAs.length === 0) {
            chipsHtml = `<span style="color:#6b7385; font-size:11px;">— لا يوجد معيدون</span>`;
        } else {
            chipsHtml = assignedTAs.map(ta =>
                `<span style="display:inline-flex; align-items:center; gap:5px; background:rgba(16,185,129,0.12); color:#10B981; padding:3px 10px; border-radius:8px; font-size:11px; font-weight:700; margin:2px;">
                    <i class="fas fa-user-graduate"></i> ${ta.name}
                </span>`
            ).join('');
        }

        const actionsHtml = `
            <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                <button type="button" class="btn btn-green"
                    onclick="event.stopPropagation(); openAssignTAsModal('${c.class_id}')"
                    style="padding:7px 14px; font-size:12px;">
                    <i class="fas fa-user-plus"></i> تعيين
                    ${assignedTAs.length > 0 ? `<span style="background:rgba(255,255,255,0.2); padding:1px 7px; border-radius:8px; font-size:10.5px;">${assignedTAs.length}</span>` : ''}
                </button>
                <button type="button" class="btn btn-outline"
                    onclick="event.stopPropagation(); openClassDetailsModal('${c.class_id}')"
                    style="padding:7px 14px; font-size:12px;">
                    <i class="fas fa-eye"></i> عرض
                </button>
            </div>
        `;

        const deleteBtnHtml = `
            <button class="btn btn-red" style="padding:5px 12px; font-size:11.5px;"
                onclick="event.stopPropagation(); deleteClass('${c.class_id}')">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const sessionCount = allClassSessions.length;

        return `
        <tr class="clickable-row" ondblclick="openClassSessionsModal('${c.class_id}')" title="اضغط مرتين لعرض السكاشن">
            <td>
                <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(6,182,212,0.12); color:#22d3ee; padding:6px 16px; border-radius:10px; font-family:monospace; font-weight:900; font-size:14px;">
                    <i class="fas fa-layer-group"></i> Class ${c.class_number}
                </span>
                ${sessionCount > 0 ? `
                    <div style="margin-top:5px; font-size:10.5px; color:#8b93a7;">
                        <i class="fas fa-users"></i> ${sessionCount} سكشن
                    </div>
                ` : ''}
            </td>
            <td style="min-width:180px; text-align:center; padding:10px 14px;">
                <div style="display:flex; flex-wrap:wrap; gap:2px; justify-content:center;">
                    ${chipsHtml}
                </div>
            </td>
            <td>${actionsHtml}</td>
            <td>${deleteBtnHtml}</td>
        </tr>
        `;
    }).join('');
}

/* =========================================================
   ✅ نافذة فتح سكشن جديد (شاشة واحدة) — للمعيد
   ✅ الفصل + العنوان معاً — بدون "التالي"
   ========================================================= */
async function openNewSectionChoiceModal() {
    const subjectId = currentSessionsFilter;
    if (!subjectId) {
        return Swal.fire({...swalDark, icon: 'error', text: 'لم يتم اختيار مادة!'});
    }

    const subject = allData.subjects.find(s => s.id === subjectId);
    if (!subject) {
        return Swal.fire({...swalDark, icon: 'error', text: 'المادة غير موجودة!'});
    }

    const allowedClasses = getTaClassesForSubject(subjectId);

    if (allowedClasses.length === 0) {
        return Swal.fire({
            ...swalDark,
            icon: 'warning',
            title: 'لا توجد فصول مُعيَّنة',
            html: `
                <div style="text-align:center; line-height:1.9;">
                    <p style="color:#fff; margin-bottom:8px;">لم يتم تعيينك لأي فصل في مادة</p>
                    <p style="color:#FFB300; font-weight:900; font-size:14px; margin-bottom:12px;">${subject.name}</p>
                    <p style="color:#9CA3AF; font-size:12px;">تواصل مع الدكتور لتعيينك على فصل.</p>
                </div>
            `
        });
    }

    const isSingle = allowedClasses.length === 1;
    const initialClass = allowedClasses[0];

    // ✅ لو فصل واحد → locked. لو أكثر → select بس في نفس الشاشة
    let classFieldHtml = '';
    if (isSingle) {
        classFieldHtml = `
            <div class="locked-subject-field" style="margin-bottom:14px;">
                <i class="fas fa-layer-group"></i>
                <span>Class ${initialClass}</span>
            </div>
        `;
    } else {
        const classOptions = allowedClasses.map(n =>
            `<option value="${n}">Class ${n}</option>`
        ).join('');
        classFieldHtml = `
            <select id="cs-class-num"
                class="login-input"
                style="font-size:15px; padding:14px 18px; font-weight:800; text-align:center; font-family:'Plus Jakarta Sans',monospace; color:#22d3ee; margin-bottom:14px;">
                ${classOptions}
            </select>
        `;
    }

    const initialTitle = generateClassTitle(subjectId, initialClass);

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'فتح سكشن جديد',
        width: 480,
        html: `
            <div class="locked-subject-field" style="margin-bottom:12px;">
                <i class="fas fa-book"></i>
                <span>${subject.name}</span>
            </div>

            ${classFieldHtml}

            <input id="cs-title" class="login-input" placeholder="اسم السكشن (مثلاً: Class1_Sec1)" value="${initialTitle}"
                style="font-family:monospace; font-weight:800; text-align:center; font-size:15px; margin-bottom:0;">

            <p style="color:#8b93a7; font-size:11px; margin:10px 0 0; text-align:right;">
                <i class="fas fa-info-circle" style="color:var(--nx-gold);"></i>
                العنوان الافتراضي جاهز — يمكنك تعديله يدوياً.
            </p>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> فتح السكشن',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusConfirm: false,
        didOpen: () => {
            if (!isSingle) {
                const classSel = document.getElementById('cs-class-num');
                const titleInput = document.getElementById('cs-title');
                if (classSel && titleInput) {
                    classSel.addEventListener('change', () => {
                        titleInput.value = generateClassTitle(subjectId, classSel.value);
                    });
                }
            }
        },
        preConfirm: () => {
            const titleEl = document.getElementById('cs-title');
            const title = titleEl ? titleEl.value.trim() : '';
            if (!title) {
                Swal.showValidationMessage('يرجى إدخال اسم السكشن!');
                return false;
            }

            let classNumber;
            if (isSingle) {
                classNumber = initialClass;
            } else {
                const sel = document.getElementById('cs-class-num');
                classNumber = sel ? sel.value : null;
                if (!classNumber) {
                    Swal.showValidationMessage('يرجى اختيار الفصل!');
                    return false;
                }
            }

            return {
                subject_id: subjectId,
                subject_name: subject.name,
                type: 'Section',
                title: title,
                class_number: classNumber
            };
        }
    });

    if (form) {
        await sendCreateSession(form);
    }
}

/* =========================================================
   ✅ createSessionForClass — نسخة بسيطة
   ========================================================= */
async function createSessionForClass(subjectId, classNumber) {
    const subject = allData.subjects.find(s => s.id === subjectId);
    if (!subject) return Swal.fire({...swalDark, icon: 'error', text: 'المادة غير موجودة!'});

    const initialTitle = generateClassTitle(subjectId, classNumber);

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'فتح سكشن جديد',
        width: 480,
        html: `
            <div class="locked-subject-field" style="margin-bottom:12px;">
                <i class="fas fa-book"></i>
                <span>${subject.name}</span>
            </div>
            <div class="locked-subject-field" style="margin-bottom:14px;">
                <i class="fas fa-layer-group"></i>
                <span>Class ${classNumber}</span>
            </div>
            <input id="cs-title" class="login-input" placeholder="اسم السكشن" value="${initialTitle}"
                style="font-family:monospace; font-weight:800; text-align:center; font-size:15px; margin-bottom:0;">
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> فتح السكشن',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusConfirm: false,
        preConfirm: () => {
            const title = document.getElementById('cs-title').value.trim();
            if (!title) {
                Swal.showValidationMessage('يرجى إدخال اسم السكشن!');
                return false;
            }
            return {
                subject_id: subjectId,
                subject_name: subject.name,
                type: 'Section',
                title: title,
                class_number: classNumber
            };
        }
    });

    if (form) await sendCreateSession(form);
}

/* =========================================================
   ✅ نافذة عرض سكاشن فصل معيّن
   ========================================================= */
function openClassSessionsModal(classId) {
    const cls = (allData.classes || []).find(c => c.class_id === classId);
    if (!cls) return;

    const isTA = (currentAdminRole === 'ta');

    let classSessions = allData.sessions.filter(s =>
        s.subject_id === cls.subject_id &&
        s.type === 'Section' &&
        String(s.class_number) === String(cls.class_number)
    );

    if (isTA) {
        classSessions = classSessions.filter(s =>
            s.created_by_username === currentAdminUsername
        );
    }

    classSessions.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

    let sessionsHtml = '';

    if (classSessions.length === 0) {
        let emptyMsg = isTA
            ? 'لم تفتح أي سكشن في هذا الفصل بعد'
            : 'المعيد عليه فتح سكشن جديد من حسابه';

        sessionsHtml = `
            <div style="text-align:center; padding:30px 20px; background:rgba(0,0,0,0.25); border-radius:14px; border:1px dashed rgba(255,255,255,0.15);">
                <i class="fas fa-user-slash fa-2x" style="color:var(--text-muted); margin-bottom:10px;"></i>
                <p style="color:#fff; font-size:13px; margin:0;">لا توجد سكاشن في هذا الفصل</p>
                <p style="color:#9CA3AF; font-size:11.5px; margin-top:6px;">${emptyMsg}</p>
            </div>
        `;
    } else {
        sessionsHtml = classSessions.map(s => {
            const isOpen = s.is_open;
            const statusClass = isOpen ? 'sess-status-open' : 'sess-status-closed';
            const statusText = isOpen ? 'مفتوحة' : 'مغلقة';

            return `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px 14px; margin-bottom:8px; text-align:right;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="background:rgba(59,130,246,0.15); color:#3B82F6; padding:4px 12px; border-radius:8px; font-size:11.5px; font-weight:800; font-family:monospace;">
                                <i class="fas fa-users"></i> ${s.title}
                            </span>
                            <span class="sess-status ${statusClass}" style="padding:4px 12px; font-size:10.5px;">
                                <i class="fas fa-circle"></i> ${statusText}
                            </span>
                        </div>
                        <div style="font-size:10.5px; color:#8b93a7;">
                            ${s.created_at || ''}
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                        <div style="font-size:11px; color:#8b93a7;">
                            <i class="fas fa-user-graduate"></i> ${s.created_by || '—'}
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-gold" 
                                onclick="event.stopPropagation(); Swal.close(); startLiveBroadcast('${s.session_id}', '${s.title}', '${s.subject_name}')"
                                style="padding:5px 12px; font-size:11px;">
                                <i class="fas fa-qrcode"></i> بث
                            </button>
                            <button type="button" class="btn btn-outline" 
                                onclick="event.stopPropagation(); Swal.close(); openSessionAttendanceModal('${s.session_id}')"
                                style="padding:5px 12px; font-size:11px;">
                                <i class="fas fa-users"></i> الكشف
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    Swal.fire({
        ...swalDark,
        title: `📁 Class ${cls.class_number} · سكاشن الفصل`,
        width: 620,
        html: `
            <div style="text-align:right; max-height:65vh; overflow-y:auto;">
                <div style="background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); padding:10px 14px; border-radius:12px; margin-bottom:14px;">
                    <p style="color:#22d3ee; font-size:12.5px; margin:0; font-weight:800;">
                        <i class="fas fa-book"></i> ${cls.subject_name}
                    </p>
                    <p style="color:#8b93a7; font-size:11px; margin:4px 0 0;">
                        <i class="fas fa-users"></i> ${classSessions.length} سكشن في هذا الفصل
                    </p>
                </div>
                ${sessionsHtml}
            </div>
        `,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#FFB300',
        showCancelButton: (!isTA && classSessions.length > 0),
        cancelButtonText: '📋 عرض كل السكاشن',
        cancelButtonColor: '#3B82F6'
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            openClassDetailsModal(classId);
        }
    });
}

/* =========================================================
   ✅ نافذة تفاصيل الفصل الكامل (للدكتور/الآدمن)
   ========================================================= */
async function openClassDetailsModal(classId) {
    Swal.fire({
        title: 'جاري التحميل...',
        background: '#161b26', color: '#fff',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    const res = await fetch(`/api/class-tas?class_id=${classId}`);
    const data = await res.json();
    Swal.close();

    if (data.status !== 'success') {
        return Swal.fire({...swalDark, icon: 'error', text: data.message || 'فشل التحميل'});
    }

    const cls = data.class;
    const tas = data.tas || [];

    let contentHtml = '';
    if (tas.length === 0) {
        contentHtml = `
            <div style="text-align:center; padding:30px 20px; background:rgba(0,0,0,0.25); border-radius:14px; border:1px dashed rgba(255,255,255,0.15);">
                <i class="fas fa-user-slash fa-2x" style="color:var(--text-muted); margin-bottom:10px;"></i>
                <p style="color:#fff; font-size:13px; margin:0;">لا يوجد معيدون معيّنون لهذا الفصل</p>
                <p style="color:#9CA3AF; font-size:11.5px; margin-top:6px;">اضغط "تعيين" لإضافة معيدين</p>
            </div>
        `;
    } else {
        contentHtml = tas.map(ta => {
            const sessions = ta.class_sessions || [];
            let sessionsHtml = '';
            if (sessions.length === 0) {
                sessionsHtml = `<p style="color:#6b7385; font-size:11px; text-align:center; padding:8px; margin:0;">لا توجد جلسات بعد</p>`;
            } else {
                sessionsHtml = sessions.map(s => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:7px 12px; background:rgba(0,0,0,0.3); border-radius:8px; margin-top:5px; font-size:11.5px;">
                        <span style="color:#FFB300; font-weight:800; font-family:monospace;">${s.title}</span>
                        <span style="color:#9CA3AF; font-size:10.5px;">${s.created_at || ''}</span>
                        <span style="background:rgba(16,185,129,0.15); color:#10B981; padding:2px 8px; border-radius:6px; font-weight:800; font-size:10.5px;">
                            <i class="fas fa-users"></i> ${s.attendance_count || 0}
                        </span>
                    </div>
                `).join('');
            }

            return `
                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:12px 14px; margin-bottom:10px; text-align:right;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <div style="width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #10B981, #059669); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:13px; flex-shrink:0;">
                            ${(ta.name || '?').charAt(0)}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="color:#fff; font-weight:900; font-size:13.5px;">${ta.name}</div>
                            <div style="color:#8b93a7; font-size:10.5px; font-family:monospace;">@${ta.username}</div>
                        </div>
                    </div>
                    <p style="color:#8b93a7; font-size:10.5px; margin:0 0 4px;">جلسات هذا المعيد في Class ${cls.class_number}:</p>
                    ${sessionsHtml}
                </div>
            `;
        }).join('');
    }

    Swal.fire({
        ...swalDark,
        title: `📁 Class ${cls.class_number} · ${cls.subject_name}`,
        width: 560,
        html: `
            <div style="text-align:right; max-height:60vh; overflow-y:auto;">
                <div style="background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); padding:10px 14px; border-radius:12px; margin-bottom:14px;">
                    <p style="color:#22d3ee; font-size:12.5px; margin:0; font-weight:800;">
                        <i class="fas fa-users"></i> ${tas.length} معيد معيّن
                    </p>
                </div>
                ${contentHtml}
            </div>
        `,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#FFB300'
    });
}

/* =========================================================
   ✅ نافذة تعيين معيدين لفصل
   ========================================================= */
async function openAssignTAsModal(classId) {
    const cls = (allData.classes || []).find(c => c.class_id === classId);
    if (!cls) return;

    const classKey = `${cls.subject_id}|Class${cls.class_number}`;

    const availableTAs = (allData.staff || []).filter(u =>
        u.role === 'ta' && (u.allowed_subjects || []).includes(cls.subject_id)
    );

    if (availableTAs.length === 0) {
        return Swal.fire({
            ...swalDark,
            icon: 'info',
            title: 'لا يوجد معيدون متاحون',
            html: `
                <div style="text-align:center; line-height:1.9;">
                    <p style="color:#fff; margin-bottom:8px;">لا يوجد معيدون معيّنون على مادة</p>
                    <p style="color:#FFB300; font-weight:900; font-size:14px; margin-bottom:12px;">${cls.subject_name}</p>
                    <p style="color:#9CA3AF; font-size:12px;">
                        اذهب إلى <b style="color:#FFB300;">"إدارة الطاقم"</b> أولاً لإضافة معيدين لهذه المادة.
                    </p>
                </div>
            `
        });
    }

    const taListHtml = availableTAs.map(ta => {
        const isAssigned = (ta.allowed_classes || []).includes(classKey);
        return `
            <label class="ta-assign-item"
                style="display:flex; align-items:center; gap:10px; padding:11px 14px; background:${isAssigned ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)'}; border:1px solid ${isAssigned ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}; border-radius:12px; cursor:pointer; margin-bottom:7px; text-align:right; transition:all 0.2s ease;">
                <input type="checkbox" class="assign-ta-checkbox" value="${ta.username}" ${isAssigned ? 'checked' : ''}
                       style="width:18px; height:18px; accent-color:#10B981; flex-shrink:0; cursor:pointer;">
                <div style="flex:1; min-width:0;">
                    <div style="color:#fff; font-weight:800; font-size:13.5px;">${ta.name}</div>
                    <div style="color:#8b93a7; font-size:11px; font-family:monospace; margin-top:2px;">@${ta.username}</div>
                </div>
                ${isAssigned ? '<i class="fas fa-check-circle" style="color:#10B981; font-size:16px;"></i>' : ''}
            </label>
        `;
    }).join('');

    const { value: selectedUsernames, isConfirmed } = await Swal.fire({
        ...swalDark,
        title: `تعيين معيدين · Class ${cls.class_number}`,
        width: 540,
        html: `
            <div style="text-align:right;">
                <div style="background:rgba(6,182,212,0.08); border:1px solid rgba(6,182,212,0.25); padding:10px 14px; border-radius:12px; margin-bottom:14px;">
                    <p style="color:#22d3ee; font-size:12.5px; margin:0; font-weight:800;">
                        <i class="fas fa-book"></i> ${cls.subject_name}
                    </p>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <p style="color:#8b93a7; font-size:11px; margin:0;">
                        <i class="fas fa-users"></i> المتاحون: <b style="color:#fff;">${availableTAs.length}</b>
                    </p>
                    <button type="button" onclick="toggleAllTaAssign()" 
                        style="background:transparent; border:1px solid rgba(255,179,0,0.4); color:#FFB300; padding:4px 10px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; font-family:'Cairo',sans-serif;">
                        <i class="fas fa-check-double"></i> تحديد / إلغاء الكل
                    </button>
                </div>

                <div style="max-height:340px; overflow-y:auto; padding-left:4px;">
                    ${taListHtml}
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-save"></i> حفظ',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusConfirm: false,
        preConfirm: () => {
            const selected = Array.from(document.querySelectorAll('.assign-ta-checkbox:checked')).map(cb => cb.value);
            return selected;
        }
    });

    if (!isConfirmed) return;

    /* ✅ تحديث فوري في الذاكرة */
    const targetSet = new Set(selectedUsernames || []);
    availableTAs.forEach(ta => {
        const classes = ta.allowed_classes || [];
        const has = classes.includes(classKey);
        const should = targetSet.has(ta.username);
        if (should && !has) {
            ta.allowed_classes = [...classes, classKey];
        } else if (!should && has) {
            ta.allowed_classes = classes.filter(c => c !== classKey);
        }
    });
    renderClassesTable(currentSessionsFilter);

    const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            action: 'assign_class_tas',
            class_id: classId,
            ta_usernames: selectedUsernames || []
        })
    });
    const data = await res.json();

    if (data.status === 'success') {
        Swal.fire({
            ...swalDark,
            icon: 'success',
            title: 'تم الحفظ ✅',
            timer: 1400,
            showConfirmButton: false
        });
        refreshDataSilently();
    } else {
        Swal.fire({...swalDark, icon: 'error', title: 'خطأ', text: data.message});
        refreshDataSilently();
    }
}

function toggleAllTaAssign() {
    const checkboxes = document.querySelectorAll('.assign-ta-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => { cb.checked = !allChecked; });
}

/* =========================================================
   ✅ إضافة فصل جديد — Optimistic
   ========================================================= */
async function addClass() {
    if (!currentSessionsFilter) return;
    const subjectId = currentSessionsFilter;
    const subject = allData.subjects.find(s => s.id === subjectId);
    if (!subject) return;

    const existingClasses = (allData.classes || []).filter(c => c.subject_id === subjectId);
    const maxNum = existingClasses.reduce((m, c) => Math.max(m, parseInt(c.class_number) || 0), 0);
    const suggested = maxNum + 1;

    const { value: classNum } = await Swal.fire({
        ...swalDark,
        title: 'إضافة فصل جديد',
        html: `
            <div style="text-align:right;">
                <p style="color:#9aa2b5; font-size:12px; margin-bottom:10px;">
                    المادة: <b style="color:#FFB300;">${subject.name}</b>
                </p>
                <label style="color:#9aa2b5; font-size:12px; display:block; margin-bottom:6px;">
                    Class رقم
                </label>
                <input id="new-class-num" class="login-input ltr-input" type="number" 
                    min="1" max="100" value="${suggested}">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-plus"></i> إضافة',
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const val = document.getElementById('new-class-num').value.trim();
            if (!val || isNaN(val) || parseInt(val) < 1) {
                Swal.showValidationMessage('يرجى إدخال رقم Class صحيح!');
                return false;
            }
            const dup = existingClasses.find(c => String(c.class_number) === String(val));
            if (dup) {
                Swal.showValidationMessage(`Class ${val} موجود بالفعل!`);
                return false;
            }
            return val;
        }
    });

    if (!classNum) return;

    /* ✅ ضيف مؤقتًا في الذاكرة */
    const tempClass = {
        class_id: 'TEMP_' + Date.now(),
        subject_id: subjectId,
        subject_name: subject.name,
        class_number: parseInt(classNum),
        created_by: 'أنت',
        created_by_username: currentAdminUsername,
        created_at: 'الآن'
    };
    allData.classes.push(tempClass);
    renderClassesTable(subjectId);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_class',
                subject_id: subjectId,
                class_number: parseInt(classNum)
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            const idx = allData.classes.findIndex(c => c.class_id === tempClass.class_id);
            if (idx >= 0 && data.class_id) {
                allData.classes[idx] = {
                    class_id: data.class_id,
                    subject_id: data.subject_id,
                    subject_name: data.subject_name,
                    class_number: data.class_number,
                    created_by: 'أنت',
                    created_by_username: currentAdminUsername,
                    created_at: 'الآن'
                };
            }
            renderClassesTable(subjectId);
            Swal.fire({...swalDark, icon: 'success', title: `تم إنشاء Class ${classNum} ✅`, timer: 1200, showConfirmButton: false});
            refreshDataSilently();
        } else {
            allData.classes = allData.classes.filter(c => c.class_id !== tempClass.class_id);
            renderClassesTable(subjectId);
            Swal.fire({...swalDark, icon: 'error', title: 'خطأ', text: data.message});
        }
    } catch (e) {
        allData.classes = allData.classes.filter(c => c.class_id !== tempClass.class_id);
        renderClassesTable(subjectId);
        Swal.fire({...swalDark, icon: 'error', title: 'خطأ', text: 'تعذر الاتصال'});
    }
}

/* =========================================================
   ✅ حذف فصل — Optimistic
   ========================================================= */
async function deleteClass(classId) {
    const cls = (allData.classes || []).find(c => c.class_id === classId);
    if (!cls) return;

    const affectedTAs = (allData.staff || []).filter(u => {
        const c = (u.allowed_classes || []);
        return c.includes(`${cls.subject_id}|Class${cls.class_number}`);
    });

    let warnHtml = '';
    if (affectedTAs.length > 0) {
        warnHtml = `
            <div style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.35); border-radius:10px; padding:10px 14px; margin:10px 0;">
                <p style="color:#f87171; font-size:12.5px; font-weight:800; margin:0;">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${affectedTAs.length} معيد معيّن على هذا الفصل — سيتم إزالة الصلاحية
                </p>
            </div>
        `;
    }

    const result = await Swal.fire({
        ...swalDark, icon: 'warning', title: 'حذف الفصل',
        html: `
            <div style="text-align:center;">
                <p style="color:#fff; margin-bottom:10px;">سيتم حذف الفصل:</p>
                <p style="color:#22d3ee; font-weight:900; font-size:18px; font-family:monospace; margin-bottom:12px;">
                    Class ${cls.class_number}
                </p>
                ${warnHtml}
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف نهائي',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusCancel: true
    });

    if (!result.isConfirmed) return;

    const idx = allData.classes.findIndex(c => c.class_id === classId);
    const removed = idx >= 0 ? allData.classes.splice(idx, 1)[0] : null;
    const subjectId = cls.subject_id;

    const classKey = `${cls.subject_id}|Class${cls.class_number}`;
    allData.staff.forEach(u => {
        if (u.allowed_classes && u.allowed_classes.includes(classKey)) {
            u.allowed_classes = u.allowed_classes.filter(c => c !== classKey);
        }
    });

    renderClassesTable(subjectId);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_class', class_id: classId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف', timer: 1100, showConfirmButton: false});
            refreshDataSilently();
        } else {
            if (removed) allData.classes.splice(idx, 0, removed);
            renderClassesTable(subjectId);
            Swal.fire({...swalDark, icon: 'error', text: data.message});
            refreshDataSilently();
        }
    } catch (e) {
        if (removed) allData.classes.splice(idx, 0, removed);
        renderClassesTable(subjectId);
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال'});
    }
}

function renderSessions(list) { renderSessionsView(); }

/* =========================================================
   أدوات مساعدة
   ========================================================= */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
}

function toggleAdminPasswordVisibility() {
    const passInput = document.getElementById('pass');
    const icon = document.getElementById('toggle-admin-pass-icon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash');
        icon.style.color = 'var(--gold)';
    } else {
        passInput.type = 'password';
        icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye');
        icon.style.color = 'var(--text-muted)';
    }
}

/* =========================================================
   نافذة عرض طلاب الجلسة
   ========================================================= */
async function openSessionAttendanceModal(sessionId) {
    currentInspectedSessionId = sessionId;
    const container = document.getElementById('sess-glass-cards-container');
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><br>جاري جلب الكشف...</div>`;
    document.getElementById('session-attendance-modal').style.display = 'flex';
    document.getElementById('session-student-search').value = '';

    const res = await fetch(`/api/session-attendance?session_id=${sessionId}`);
    const data = await res.json();

    if(data.status === 'success') {
        const sess = data.session || {};
        const typeInfo = getSessionTypeDisplay(sess);
        document.getElementById('sess-modal-title').innerText = `📜 ${sess.subject_name} - ${sess.title} (${typeInfo.label})`;
        document.getElementById('sess-modal-count').innerText = data.records.length;

        currentSessionRecords = data.records || [];
        document.getElementById('sess-btn-add-manual').onclick = () => addManualStudentAttendanceModal(sessionId);
        document.getElementById('sess-btn-export-excel').onclick = () => location.href = `/api/export-attendance-csv?session_id=${sessionId}`;
        renderGlassStudentCards(currentSessionRecords, sessionId);
    } else {
        Swal.fire({...swalDark, icon: 'error', text: data.message || 'فشل التحميل'});
    }
}

function filterSessionStudents() {
    const q = document.getElementById('session-student-search').value.toLowerCase().trim();
    if (!q) { renderGlassStudentCards(currentSessionRecords, currentInspectedSessionId); return; }
    const filtered = currentSessionRecords.filter(r =>
        (r.student_name && r.student_name.toLowerCase().includes(q)) ||
        (r.student_id && r.student_id.includes(q))
    );
    renderGlassStudentCards(filtered, currentInspectedSessionId);
}

function renderGlassStudentCards(records, sessionId) {
    const container = document.getElementById('sess-glass-cards-container');
    if(!records || records.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; background:rgba(30,41,59,0.5); border-radius:16px; border:1px dashed rgba(255,255,255,0.15);">
                <i class="fas fa-user-clock fa-2x" style="color:var(--text-muted); margin-bottom:10px;"></i>
                <h3 style="color:#fff; font-size:14px; margin:0;">لا توجد نتائج</h3>
            </div>`;
        return;
    }

    container.innerHTML = records.map(r => {
        const isManual = r.is_manual || (r.ip && r.ip.includes("ADMIN"));
        const scanType = r.scan_type || '';
        const entryClass = isManual ? 'manual-entry' : 'auto-entry';

        let entryIcon = '🖥️';
        let entryLabel = 'QR';
        if (isManual) { entryIcon = '✍️'; entryLabel = 'يدوي'; }
        else if (scanType === 'manual') { entryIcon = '⌨️'; entryLabel = 'كود'; }
        else if (scanType === 'qr') { entryIcon = '📷'; entryLabel = 'QR'; }

        let timeShort = r.timestamp || '';
        const m = timeShort.match(/(\d{1,2}:\d{2}):\d{2}\s*(AM|PM)/i);
        if (m) timeShort = m[1] + ' ' + m[2];

        return `
            <div class="glass-student-card ${entryClass}">
                <div class="gsc-main">
                    <span class="gsc-dot"></span>
                    <span class="gsc-name" title="${r.student_name}">${r.student_name}</span>
                    <span class="gsc-sep">·</span>
                    <span class="gsc-id">${r.student_id}</span>
                    <span class="gsc-sep gsc-hide-xs">·</span>
                    <span class="gsc-type gsc-hide-xs">${entryIcon} ${entryLabel}</span>
                    <span class="gsc-sep">·</span>
                    <span class="gsc-time">${timeShort}</span>
                </div>
                <div class="gsc-actions">
                    <button class="gsc-btn gsc-btn-edit" onclick="event.stopPropagation(); editAttendanceRecordModal('${sessionId}', '${r.student_id}', '${r.student_name}')"><i class="fas fa-edit"></i></button>
                    <button class="gsc-btn gsc-btn-del" onclick="event.stopPropagation(); deleteSessionAttendanceRecord('${sessionId}', '${r.student_id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function closeSessionAttendanceModal() {
    document.getElementById('session-attendance-modal').style.display = 'none';
    currentInspectedSessionId = null;
    refreshDataSilently();
}

/* =========================================================
   عمليات الحضور اليدوية
   ========================================================= */
async function addManualStudentAttendanceModal(sessionId) {
    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة حضور طالب يدوياً',
        html: `
            <input id="man-name" class="login-input" placeholder="اسم الطالب رباعي">
            <input id="man-id" class="login-input ltr-input" placeholder="كود الطالب (7 أرقام)" maxlength="7">
        `,
        preConfirm: () => {
            const name = document.getElementById('man-name').value.trim();
            const sid = document.getElementById('man-id').value.trim();
            if(!name || sid.length !== 7 || isNaN(sid)) return Swal.showValidationMessage('يرجى إدخال اسم رباعي وكود من 7 أرقام!');
            return { student_name: name, student_id: sid };
        }
    });

    if(!form) return;

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'add_manual_attendance', session_id: sessionId, ...form })
    });
    const data = await res.json();
    if(data.status === 'success') {
        Swal.fire({...swalDark, icon:'success', title:'تم!', text: data.message, timer: 1300, showConfirmButton: false});
        openSessionAttendanceModal(sessionId);
    } else {
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

async function editAttendanceRecordModal(sessionId, oldId, oldName) {
    const { value: form } = await Swal.fire({
        ...swalDark, title: 'تعديل بيانات الحضور',
        html: `
            <input id="ed-att-name" class="login-input" value="${oldName}" placeholder="اسم الطالب">
            <input id="ed-att-id" class="login-input ltr-input" value="${oldId}" placeholder="كود الطالب" maxlength="7">
        `,
        preConfirm: () => ({
            new_name: document.getElementById('ed-att-name').value.trim(),
            new_id: document.getElementById('ed-att-id').value.trim()
        })
    });

    if(form && form.new_name && form.new_id) {
        await fetch('/api/admin-action', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'edit_attendance_record', session_id: sessionId, old_id: oldId, ...form })
        });
        openSessionAttendanceModal(sessionId);
    }
}

/* =========================================================
   ✅ حذف سجل الحضور — Optimistic
   ========================================================= */
async function deleteSessionAttendanceRecord(sessionId, studentId) {
    const record = currentSessionRecords.find(r => r.student_id === studentId);
    const studentName = record ? record.student_name : '';

    const result = await Swal.fire({
        ...swalDark, icon: 'warning', title: 'حذف سجل الحضور',
        html: `
            <div style="text-align:center;">
                <p style="color:#fff; margin-bottom:10px;">هل تريد حذف تسجيل حضور هذا الطالب؟</p>
                ${studentName ? `<p style="color:#FFB300; font-weight:900; font-size:15px; margin-bottom:6px;">${studentName}</p>` : ''}
                <p style="color:#9CA3AF; font-family:monospace; font-size:13px;">${studentId}</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusCancel: true
    });

    if (!result.isConfirmed) return;

    const idx = currentSessionRecords.findIndex(r => r.student_id === studentId);
    const removed = idx >= 0 ? currentSessionRecords.splice(idx, 1)[0] : null;
    document.getElementById('sess-modal-count').innerText = currentSessionRecords.length;
    renderGlassStudentCards(currentSessionRecords, sessionId);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_attendance_record', session_id: sessionId, student_id: studentId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف', timer: 1000, showConfirmButton: false});
        } else {
            if (removed) currentSessionRecords.splice(idx, 0, removed);
            document.getElementById('sess-modal-count').innerText = currentSessionRecords.length;
            renderGlassStudentCards(currentSessionRecords, sessionId);
            Swal.fire({...swalDark, icon: 'error', text: data.message});
        }
    } catch (e) {
        if (removed) currentSessionRecords.splice(idx, 0, removed);
        document.getElementById('sess-modal-count').innerText = currentSessionRecords.length;
        renderGlassStudentCards(currentSessionRecords, sessionId);
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال'});
    }
}

/* =========================================================
   ✅ فلترة المواد
   ========================================================= */
function filterSubjectsTab(yearValue, btnEl) {
    activeSubjectYear = yearValue;
    activeSubjectDept = 'all';

    document.querySelectorAll('#subject-nav-filters .com-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const deptFilters = document.getElementById('dept-sub-filters');
    if (yearValue === 'الفرقة الثالثة' || yearValue === 'الفرقة الرابعة') {
        deptFilters.style.display = 'flex';
        document.querySelectorAll('#dept-sub-filters .sub-btn').forEach(btn => btn.classList.remove('active'));
        const firstBtn = document.querySelector('#dept-sub-filters .sub-btn');
        if (firstBtn) firstBtn.classList.add('active');
    } else {
        deptFilters.style.display = 'none';
    }

    renderSubjectsTable();
}

function filterSubjectsDept(deptValue, btnEl) {
    activeSubjectDept = deptValue;
    document.querySelectorAll('#dept-sub-filters .sub-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderSubjectsTable();
}

function renderSubjectsTable() {
    let filteredSubs = allData.subjects;

    if (activeSubjectYear !== 'all') {
        filteredSubs = filteredSubs.filter(s => s.year === activeSubjectYear);
        if (activeSubjectYear === 'الفرقة الثالثة' || activeSubjectYear === 'الفرقة الرابعة') {
            if (activeSubjectDept !== 'all') {
                filteredSubs = filteredSubs.filter(s =>
                    s.department === activeSubjectDept || s.department === 'عام (IT)'
                );
            }
        }
    }

    const tbody = document.getElementById('subjects-table-body');
    if(!tbody) return;

    if(filteredSubs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:30px;">لا توجد مواد.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredSubs.map(s => {
        let deptColor = '#3B82F6';
        let bgDeptColor = 'rgba(59, 130, 246, 0.2)';
        if (s.department === 'Software') { deptColor = '#10B981'; bgDeptColor = 'rgba(16, 185, 129, 0.2)'; }
        else if (s.department === 'Network') { deptColor = '#EF4444'; bgDeptColor = 'rgba(239, 68, 68, 0.2)'; }

        return `
        <tr>
            <td><img src="${s.image || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'}" width="35" height="35" style="border-radius:6px; object-fit:contain; background:#fff; padding:2px;"></td>
            <td style="color:var(--gold); font-weight:bold; font-size:15px;">${s.name}</td>
            <td>
                <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <span style="color:#fff; font-size:12px; font-weight:bold;">${s.year || '-'}</span>
                    <span style="background:${bgDeptColor}; color:${deptColor}; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:bold;">${s.department || '-'}</span>
                </div>
            </td>
            <td style="color:var(--text-muted); font-size:12px;">${s.added_by || 'الآدمن'}</td>
            <td>
                ${allData.currentAdmin.role === 'super_admin' ? `
                    <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
                        <button class="btn btn-gold" style="padding:4px 10px; font-size:12px;" onclick="editSubject('${s.id}')"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn btn-red" style="padding:4px 10px; font-size:12px;" onclick="deleteSubject('${s.id}')"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                ` : '-'}
            </td>
        </tr>
    `}).join('');
}

/* =========================================================
   ✅ إضافة / تعديل / حذف مادة
   ========================================================= */
async function addSubject() {
    let defaultYear = 'الفرقة الأولى';
    if (activeSubjectYear !== 'all') defaultYear = activeSubjectYear;

    const isYear34 = (defaultYear === 'الفرقة الثالثة' || defaultYear === 'الفرقة الرابعة');
    const hasActiveDept = (activeSubjectDept !== 'all');
    const autoPickedDept = (isYear34 && hasActiveDept) ? activeSubjectDept : null;
    let defaultDept = 'Software';
    if (autoPickedDept) defaultDept = autoPickedDept;

    const isYear12 = (defaultYear === 'الفرقة الأولى' || defaultYear === 'الفرقة الثانية');
    const finalDept = isYear12 ? 'عام (IT)' : defaultDept;

    const years = ['الفرقة الأولى', 'الفرقة الثانية', 'الفرقة الثالثة', 'الفرقة الرابعة'];
    const yearOptionsHtml = years.map(y =>
        `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`
    ).join('');

    const depts = ['عام (IT)', 'Software', 'Network'];
    const deptOptionsHtml = depts.map(d =>
        `<option value="${d}" ${d === finalDept ? 'selected' : ''}>${d}</option>`
    ).join('');

    let initialHint = isYear12 ? '<i class="fas fa-lock"></i> القسم ثابت (عام IT)' : '<i class="fas fa-info-circle"></i> اختر القسم';

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة مادة جديدة',
        html: `
            <input id="as-name" class="login-input" placeholder="اسم المادة">
            <select id="as-year" class="login-input">${yearOptionsHtml}</select>
            <select id="as-dept" class="login-input" ${isYear12 ? 'disabled' : ''} style="${isYear12 ? 'opacity:0.55;' : ''}">${deptOptionsHtml}</select>
            <p id="as-dept-hint" style="text-align:right; font-size:11px; color:var(--gold); margin-top:-8px; margin-bottom:8px;">${initialHint}</p>
            <p style="text-align:right; font-size:12px; color:var(--text-muted);">صورة المادة:</p>
            <input type="file" id="as-file" class="login-input" accept="image/*">
        `,
        didOpen: () => {
            const yearSel = document.getElementById('as-year');
            const deptSel = document.getElementById('as-dept');
            yearSel.addEventListener('change', () => {
                const y = yearSel.value;
                if (y === 'الفرقة الأولى' || y === 'الفرقة الثانية') {
                    deptSel.value = 'عام (IT)';
                    deptSel.disabled = true;
                    deptSel.style.opacity = '0.55';
                } else {
                    deptSel.disabled = false;
                    deptSel.style.opacity = '1';
                    if (deptSel.value === 'عام (IT)') deptSel.value = 'Software';
                }
            });
        },
        preConfirm: () => {
            const name = document.getElementById('as-name').value.trim();
            const year = document.getElementById('as-year').value;
            const dept = document.getElementById('as-dept').value;
            const file = document.getElementById('as-file').files[0];
            if (!name) return Swal.showValidationMessage('يرجى كتابة اسم المادة!');
            return new Promise(resolve => {
                if (file) {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name, year, department: dept, image: e.target.result });
                    reader.readAsDataURL(file);
                } else {
                    resolve({ name, year, department: dept, image: 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png' });
                }
            });
        }
    });

    if (!form) return;

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_subject', sub: 'add', subject: form })
    });
    const data = await res.json();
    if (data.status === 'success') {
        Swal.fire({...swalDark, icon:'success', title:'تمت الإضافة ✅', timer: 1200, showConfirmButton: false});
        refreshDataSilently();
    } else {
        Swal.fire({...swalDark, icon:'error', text: data.message});
    }
}

async function editSubject(id) {
    const sub = allData.subjects.find(s => s.id === id);
    if (!sub) return Swal.fire({...swalDark, icon:'error', text:'المادة غير موجودة!'});

    const currentName = (sub.name || '').replace(/"/g, '&quot;');
    const isYear12 = (sub.year === 'الفرقة الأولى' || sub.year === 'الفرقة الثانية');

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'تعديل المادة',
        html: `
            <input id="es-name" class="login-input" value="${currentName}" placeholder="اسم المادة">
            <select id="es-year" class="login-input">
                <option ${sub.year === 'الفرقة الأولى' ? 'selected' : ''}>الفرقة الأولى</option>
                <option ${sub.year === 'الفرقة الثانية' ? 'selected' : ''}>الفرقة الثانية</option>
                <option ${sub.year === 'الفرقة الثالثة' ? 'selected' : ''}>الفرقة الثالثة</option>
                <option ${sub.year === 'الفرقة الرابعة' ? 'selected' : ''}>الفرقة الرابعة</option>
            </select>
            <select id="es-dept" class="login-input" ${isYear12 ? 'disabled' : ''} style="${isYear12 ? 'opacity:0.55;' : ''}">
                <option ${sub.department === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option>
                <option ${sub.department === 'Software' ? 'selected' : ''}>Software</option>
                <option ${sub.department === 'Network' ? 'selected' : ''}>Network</option>
            </select>
            <input type="file" id="es-file" class="login-input" accept="image/*" style="margin-top:8px;">
        `,
        didOpen: () => {
            const yearSel = document.getElementById('es-year');
            const deptSel = document.getElementById('es-dept');
            yearSel.addEventListener('change', () => {
                const y = yearSel.value;
                if (y === 'الفرقة الأولى' || y === 'الفرقة الثانية') {
                    deptSel.value = 'عام (IT)';
                    deptSel.disabled = true;
                    deptSel.style.opacity = '0.55';
                } else {
                    deptSel.disabled = false;
                    deptSel.style.opacity = '1';
                    if (deptSel.value === 'عام (IT)') deptSel.value = 'Software';
                }
            });
        },
        preConfirm: () => {
            const name = document.getElementById('es-name').value.trim();
            const year = document.getElementById('es-year').value;
            const dept = document.getElementById('es-dept').value;
            const file = document.getElementById('es-file').files[0];
            if (!name) return Swal.showValidationMessage('يرجى كتابة اسم المادة!');
            return new Promise(resolve => {
                if (file) {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name, year, department: dept, image: e.target.result });
                    reader.readAsDataURL(file);
                } else {
                    resolve({ name, year, department: dept });
                }
            });
        }
    });

    if (!form) return;

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_subject', sub: 'edit', id: id, subject: form })
    });
    const data = await res.json();
    if (data.status === 'success') {
        Swal.fire({...swalDark, icon:'success', title:'تم التعديل ✅', timer: 1200, showConfirmButton: false});
        refreshDataSilently();
    } else {
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

async function deleteSubject(id) {
    const sub = allData.subjects.find(s => s.id === id);
    const subName = sub ? sub.name : '';

    const result = await Swal.fire({
        ...swalDark, icon: 'warning', title: 'حذف المادة',
        html: `
            <div style="text-align:center;">
                <p style="color:#fff; margin-bottom:10px;">هل تريد حذف هذه المادة؟</p>
                ${subName ? `<p style="color:#FFB300; font-weight:900; font-size:15px; margin-bottom:12px;">${subName}</p>` : ''}
                <p style="color:#f87171; font-size:12.5px;">
                    <i class="fas fa-exclamation-triangle"></i> سيتم حذف الجلسات والفصول والسجلات
                </p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف نهائي',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusCancel: true
    });

    if (!result.isConfirmed) return;

    await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_subject', sub: 'delete', id: id })
    });

    Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف', timer: 1200, showConfirmButton: false});
    refreshDataSilently();
}

/* =========================================================
   ✅ توليد العناوين
   ========================================================= */
function generateLectureTitle(subjectId) {
    const prefix = 'LEC';
    const regex = new RegExp(`^${prefix}\\s+(\\d+)$`, 'i');
    let maxNum = 0;
    allData.sessions.forEach(s => {
        if (s.subject_id === subjectId && s.type === 'Lecture') {
            const match = (s.title || '').trim().match(regex);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        }
    });
    return `${prefix} ${maxNum + 1}`;
}

function generateClassTitle(subjectId, classNumber) {
    let maxSec = 0;
    const regex = /^Class\d+_Sec(\d+)$/i;

    allData.sessions.forEach(s => {
        if (s.subject_id === subjectId
            && s.type === 'Section'
            && String(s.class_number) === String(classNumber)) {
            const match = (s.title || '').trim().match(regex);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxSec) maxSec = n;
            }
        }
    });

    return `Class${classNumber}_Sec${maxSec + 1}`;
}

/* =========================================================
   ✅ الفصول المتاحة للمعيد
   ========================================================= */
function getTaClassesForSubject(subjectId) {
    const classes = [];
    currentAdminAllowedClasses.forEach(item => {
        const parts = item.split('|');
        if (parts[0] === subjectId && parts[1] && parts[1].startsWith('Class')) {
            const num = parts[1].replace('Class', '');
            if (!classes.includes(num)) classes.push(num);
        }
    });
    classes.sort((a, b) => parseInt(a) - parseInt(b));
    return classes;
}

/* =========================================================
   ✅ فتح محاضرة جديدة (للدكتور/الآدمن)
   ========================================================= */
async function createSessionModal() {
    let subjectsToShow = allData.subjects;
    const isInsideSubject = currentSessionsFilter !== null;
    if (isInsideSubject) subjectsToShow = allData.subjects.filter(s => s.id === currentSessionsFilter);

    if (subjectsToShow.length === 0) return Swal.fire({...swalDark, icon:'warning', text:'لا توجد مواد!'});

    if (currentAdminRole === 'super_admin') return createSessionModalSuperAdmin(subjectsToShow, isInsideSubject);
    if (currentAdminRole === 'doctor') return createSessionModalDoctor(subjectsToShow, isInsideSubject);
    if (currentAdminRole === 'ta') return openNewSectionChoiceModal();
}

async function createSessionModalSuperAdmin(subjectsToShow, isInsideSubject) {
    const firstSub = subjectsToShow[0];
    const initialTitle = generateLectureTitle(firstSub.id);

    let subjectFieldHtml = '';
    if (isInsideSubject) {
        subjectFieldHtml = `
            <div class="locked-subject-field"><i class="fas fa-book"></i><span>${firstSub.name}</span></div>
            <input type="hidden" id="sw-sub" value="${firstSub.id}" data-name="${firstSub.name}">
        `;
    } else {
        const subOpts = subjectsToShow.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
        subjectFieldHtml = `<select id="sw-sub" class="login-input">${subOpts}</select>`;
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'فتح جلسة (آدمن)',
        html: `
            ${subjectFieldHtml}
            <select id="sw-type" class="login-input">
                <option value="Lecture">محاضرة (Lecture)</option>
                <option value="Section">سكشن (Section)</option>
            </select>
            <div id="sec-fields" style="display:none; background:rgba(0,0,0,0.35); padding:12px; border-radius:12px; margin-bottom:12px;">
                <label style="color:#9aa2b5; font-size:11px; display:block; text-align:right; margin-bottom:6px;">Class رقم</label>
                <input id="sw-class-num" class="login-input ltr-input" type="number" min="1" max="100" value="1">
            </div>
            <input id="sw-title" class="login-input" placeholder="عنوان الجلسة" value="${initialTitle}">
        `,
        didOpen: () => {
            const typeSel = document.getElementById('sw-type');
            const subSel = document.getElementById('sw-sub');
            const titleInput = document.getElementById('sw-title');
            const secFields = document.getElementById('sec-fields');
            const classNum = document.getElementById('sw-class-num');

            const update = () => {
                const subId = subSel.value;
                const type = typeSel.value;
                if (type === 'Lecture') {
                    secFields.style.display = 'none';
                    titleInput.value = generateLectureTitle(subId);
                } else {
                    secFields.style.display = 'block';
                    titleInput.value = generateClassTitle(subId, classNum.value || '1');
                }
            };
            typeSel.addEventListener('change', update);
            classNum.addEventListener('input', update);
            if (subSel && !isInsideSubject) subSel.addEventListener('change', update);
            update();
        },
        preConfirm: () => {
            const sel = document.getElementById('sw-sub');
            const type = document.getElementById('sw-type').value;
            const title = document.getElementById('sw-title').value.trim();
            const result = {
                subject_id: sel.value,
                subject_name: sel.getAttribute('data-name'),
                type: type, title: title || 'عام'
            };
            if (type === 'Section') result.class_number = document.getElementById('sw-class-num').value || '1';
            return result;
        }
    });

    if (form) await sendCreateSession(form);
}

async function createSessionModalDoctor(subjectsToShow, isInsideSubject) {
    const firstSub = subjectsToShow[0];
    const initialTitle = generateLectureTitle(firstSub.id);

    let subjectFieldHtml = '';
    if (isInsideSubject) {
        subjectFieldHtml = `
            <div class="locked-subject-field"><i class="fas fa-book"></i><span>${firstSub.name}</span></div>
            <input type="hidden" id="sw-sub" value="${firstSub.id}" data-name="${firstSub.name}">
        `;
    } else {
        const subOpts = subjectsToShow.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
        subjectFieldHtml = `<select id="sw-sub" class="login-input">${subOpts}</select>`;
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'فتح محاضرة جديدة',
        html: `
            ${subjectFieldHtml}
            <div style="background:rgba(255,179,0,0.08); border:1px solid rgba(255,179,0,0.25); padding:10px 14px; border-radius:10px; margin-bottom:12px; text-align:right;">
                <p style="color:var(--gold); font-size:12px; margin:0;">
                    <i class="fas fa-info-circle"></i> يمكنك تغيير رقم الـ LEC يدوياً لو عايز.
                </p>
            </div>
            <input id="sw-title" class="login-input" placeholder="عنوان المحاضرة" value="${initialTitle}">
        `,
        didOpen: () => {
            const subSel = document.getElementById('sw-sub');
            const titleInput = document.getElementById('sw-title');
            const update = () => { titleInput.value = generateLectureTitle(subSel.value); };
            if (subSel && !isInsideSubject) subSel.addEventListener('change', update);
        },
        preConfirm: () => {
            const sel = document.getElementById('sw-sub');
            const title = document.getElementById('sw-title').value.trim();
            if (!title) return Swal.showValidationMessage('يرجى إدخال عنوان المحاضرة!');
            return { subject_id: sel.value, subject_name: sel.getAttribute('data-name'), type: 'Lecture', title: title };
        }
    });

    if (form) await sendCreateSession(form);
}

/* =========================================================
   ✅ إرسال إنشاء الجلسة — Optimistic
   ========================================================= */
async function sendCreateSession(form) {
    const tempSession = {
        session_id: 'TEMP_' + Date.now(),
        subject_id: form.subject_id,
        subject_name: form.subject_name,
        type: form.type,
        title: form.title,
        is_open: true,
        created_by: 'أنت',
        created_by_username: currentAdminUsername,
        created_at: 'الآن'
    };
    if (form.type === 'Section') tempSession.class_number = form.class_number;

    allData.sessions.unshift(tempSession);
    if (currentSessionsFilter === form.subject_id) {
        renderFilteredSessionsTable(form.subject_id);
    }

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_session', session: form })
        });
        const data = await res.json();

        if (data.status === 'success') {
            const idx = allData.sessions.findIndex(s => s.session_id === tempSession.session_id);
            if (idx >= 0 && data.session) {
                allData.sessions[idx] = data.session;
            }
            if (currentSessionsFilter === form.subject_id) {
                renderFilteredSessionsTable(form.subject_id);
            }
            Swal.fire({...swalDark, icon: 'success', title: 'تم الإنشاء ✅', timer: 1200, showConfirmButton: false});
            refreshDataSilently();
        } else {
            allData.sessions = allData.sessions.filter(s => s.session_id !== tempSession.session_id);
            if (currentSessionsFilter === form.subject_id) {
                renderFilteredSessionsTable(form.subject_id);
            }
            Swal.fire({...swalDark, icon: 'error', title: 'خطأ', text: data.message || 'فشل الإنشاء'});
        }
    } catch (err) {
        allData.sessions = allData.sessions.filter(s => s.session_id !== tempSession.session_id);
        if (currentSessionsFilter === form.subject_id) {
            renderFilteredSessionsTable(form.subject_id);
        }
        Swal.fire({...swalDark, icon: 'error', title: 'خطأ', text: 'تعذر الاتصال!'});
    }
}

/* =========================================================
   ✅ البث المباشر
   ========================================================= */
function startLiveBroadcast(sessId, title, subName) {
    activeLiveSession = sessId;
    lastQrCodeRendered = null;
    manualCodeVisible = false;

    const box = document.getElementById('live-box');
    box.style.display = 'block';
    document.getElementById('live-session-title').innerText = title;
    document.getElementById('live-session-sub').innerText = subName;
    document.getElementById('qr-canvas').innerHTML = '';

    qrGenerator = new QRCode(document.getElementById("qr-canvas"), { width: 600, height: 600, correctLevel: QRCode.CorrectLevel.H });

    const manualSection = document.getElementById('live-manual-section');
    const toggleBtn = document.getElementById('toggle-manual-btn');
    if (manualSection) manualSection.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-keyboard"></i> إظهار الكود اليدوي';

    const fsBtn = document.getElementById('fullscreen-btn');
    if (fsBtn && !document.fullscreenElement) fsBtn.innerHTML = '<i class="fas fa-expand"></i> ملء الشاشة';

    clearInterval(liveCodeInterval);
    fetchLiveCode();
    liveCodeInterval = setInterval(fetchLiveCode, 1000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleManualCode() {
    manualCodeVisible = !manualCodeVisible;
    const manualSection = document.getElementById('live-manual-section');
    const toggleBtn = document.getElementById('toggle-manual-btn');
    if (manualSection) manualSection.style.display = manualCodeVisible ? 'flex' : 'none';
    if (toggleBtn) {
        toggleBtn.innerHTML = manualCodeVisible
            ? '<i class="fas fa-eye-slash"></i> إخفاء الكود اليدوي'
            : '<i class="fas fa-keyboard"></i> إظهار الكود اليدوي';
    }
}

function toggleLiveFullscreen() {
    const box = document.getElementById('live-box');
    if (!document.fullscreenElement) {
        if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
        else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
}

document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreen-btn');
    if (!btn) return;
    btn.innerHTML = document.fullscreenElement
        ? '<i class="fas fa-compress"></i> إنهاء ملء الشاشة'
        : '<i class="fas fa-expand"></i> ملء الشاشة';
});

function closeLiveScreen() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    clearInterval(liveCodeInterval);
    lastQrCodeRendered = null;
    manualCodeVisible = false;
    const box = document.getElementById('live-box');
    if (box) box.style.display = 'none';
    activeLiveSession = null;
}

async function fetchLiveCode() {
    if (!activeLiveSession) return;
    const res = await fetch(`/api/live-code?session_id=${activeLiveSession}`);
    const data = await res.json();

    const manualCodeEl = document.getElementById('live-code-display');
    if (manualCodeEl) manualCodeEl.innerText = data.manual_code || data.code || '------';

    const manualBar = document.getElementById('live-timer-bar');
    if (manualBar) {
        const interval = data.manual_interval || 10;
        const remaining = (data.manual_remaining !== undefined) ? data.manual_remaining : data.remaining;
        manualBar.style.width = ((remaining / interval) * 100) + '%';
    }

    const qrCode = data.qr_code || data.code;
    if (qrCode && qrCode !== lastQrCodeRendered && qrGenerator) {
        lastQrCodeRendered = qrCode;
        try { qrGenerator.clear(); qrGenerator.makeCode(qrCode); } catch (e) {}
    }

    const qrBar = document.getElementById('qr-timer-bar');
    if (qrBar && data.qr_remaining !== undefined) {
        qrBar.style.width = ((data.qr_remaining / (data.qr_interval || 3)) * 100) + '%';
    }
}

/* =========================================================
   ✅ TOGGLE SESSION — Optimistic
   ========================================================= */
async function toggleSession(id, isOpen) {
    const sess = allData.sessions.find(s => s.session_id === id);
    if (!sess) return;
    const old = sess.is_open;
    sess.is_open = isOpen;
    renderFilteredSessionsTable(currentSessionsFilter);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggle_session', session_id: id, is_open: isOpen })
        });
        const data = await res.json();
        if (data.status !== 'success') {
            sess.is_open = old;
            renderFilteredSessionsTable(currentSessionsFilter);
            Swal.fire({...swalDark, icon: 'error', text: data.message || 'خطأ'});
        }
    } catch (e) {
        sess.is_open = old;
        renderFilteredSessionsTable(currentSessionsFilter);
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال'});
    }
}

/* =========================================================
   ✅ DELETE SESSION — Optimistic
   ========================================================= */
async function deleteSession(id) {
    const result = await Swal.fire({
        ...swalDark, icon: 'warning', title: 'حذف الجلسة',
        html: `<p style="color:#fff; margin-bottom:10px;">هل تريد حذف هذه الجلسة؟</p>
               <p style="color:#f87171; font-size:13px;"><i class="fas fa-exclamation-triangle"></i> سيتم حذف كل السجلات</p>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#374151',
        reverseButtons: true, focusCancel: true
    });

    if (!result.isConfirmed) return;

    const idx = allData.sessions.findIndex(s => s.session_id === id);
    const removed = idx >= 0 ? allData.sessions.splice(idx, 1)[0] : null;
    renderFilteredSessionsTable(currentSessionsFilter);

    try {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_session', session_id: id })
        });
        const data = await res.json();

        if (data.status === 'success') {
            Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف', timer: 1100, showConfirmButton: false});
            refreshDataSilently();
        } else {
            if (removed) allData.sessions.splice(idx, 0, removed);
            renderFilteredSessionsTable(currentSessionsFilter);
            Swal.fire({...swalDark, icon: 'error', text: data.message});
        }
    } catch (e) {
        if (removed) allData.sessions.splice(idx, 0, removed);
        renderFilteredSessionsTable(currentSessionsFilter);
        Swal.fire({...swalDark, icon: 'error', text: 'تعذر الاتصال'});
    }
}

/* =========================================================
   ✅ إدارة الطاقم
   ========================================================= */
function canEditStaff(targetUser) {
    if (!targetUser) return false;
    if (targetUser.username === currentAdminUsername) return false;
    if (currentAdminRole === 'super_admin') return true;
    if (currentAdminRole === 'doctor') {
        if (targetUser.role !== 'ta') return false;
        const mySubs = (allData.currentAdmin.allowed_subjects || []);
        const targetSubs = targetUser.allowed_subjects || [];
        const hasCommon = targetSubs.some(s => mySubs.includes(s));
        const createdByHim = (targetUser.created_by === currentAdminUsername);
        return hasCommon || createdByHim;
    }
    return false;
}

function getGroupedSubjectsHTML(allowedSubjects = [], allowedClasses = [], subjectsList = null) {
    const subs = subjectsList || allData.subjects;

    if (subs.length === 0) {
        return `<div style="background:#000; padding:12px; border-radius:10px; text-align:center; color:var(--text-muted); font-size:12px;">لا توجد مواد متاحة</div>`;
    }

    const parsed = {};
    allowedClasses.forEach(item => {
        const parts = item.split('|');
        if (parts.length === 2) {
            const sub = parts[0];
            const cls = (parts[1] || '').replace('Class', '');
            if (!parsed[sub]) parsed[sub] = new Set();
            parsed[sub].add(cls);
        }
    });

    let html = '<div style="background:#000; padding:12px; border-radius:10px; max-height:400px; overflow-y:auto; text-align:right;">';

    subs.forEach(s => {
        const subId = s.id;
        const isSubjectChecked = allowedSubjects.includes(subId) ? 'checked' : '';
        const existingClasses = parsed[subId] ? Array.from(parsed[subId]).sort((a,b) => parseInt(a)-parseInt(b)) : [];

        const availableClasses = (allData.classes || [])
            .filter(c => c.subject_id === subId)
            .sort((a,b) => (parseInt(a.class_number)||0) - (parseInt(b.class_number)||0));

        let classesHtml = '';
        if (existingClasses.length === 0) {
            classesHtml = '<p style="color:#6b7385; font-size:11px; margin:4px 0;">لا توجد فصول مُعيَّنة بعد</p>';
        } else {
            classesHtml = existingClasses.map(cls => `
                <span class="cls-chip" data-subject="${subId}" data-class="${cls}"
                      style="display:inline-flex; align-items:center; gap:5px; background:rgba(6,182,212,0.15); color:#22d3ee; padding:3px 8px; border-radius:6px; font-size:11px; margin:2px; font-family:monospace; font-weight:800;">
                    Class ${cls}
                    <i class="fas fa-times" style="cursor:pointer; opacity:0.7;" onclick="removeClassChip(this)"></i>
                </span>
            `).join('');
        }

        const classOptionsHtml = availableClasses.length === 0
            ? '<option value="">لا توجد فصول</option>'
            : '<option value="">— اختر —</option>' + availableClasses.map(c =>
                `<option value="${c.class_number}">Class ${c.class_number}</option>`
            ).join('');

        const addBtnDisabled = availableClasses.length === 0 ? 'disabled' : '';

        html += `
            <div class="sub-block" data-sub-id="${subId}"
                 style="border-bottom:1px dashed rgba(255,255,255,0.08); padding-bottom:10px; margin-bottom:10px;">
                <label style="display:block; font-size:13px; margin-bottom:6px; cursor:pointer; font-weight:800; color:#fff;">
                    <input type="checkbox" class="sub-checkbox" value="${subId}" data-name="${s.name}" ${isSubjectChecked}>
                    ${s.name}
                </label>

                <div style="padding-right:22px;">
                    <p style="color:#8b93a7; font-size:10.5px; margin:0 0 6px;">الفصول المُعيَّنة:</p>
                    <div class="cls-list" data-sub-id="${subId}">${classesHtml}</div>

                    <div style="display:flex; gap:6px; margin-top:8px; align-items:flex-end;">
                        <div style="flex:1;">
                            <label style="color:#8b93a7; font-size:10px; display:block; margin-bottom:3px; text-align:right;">اختر Class</label>
                            <select class="add-cls-select login-input" data-subject="${subId}"
                                    style="margin-bottom:0; padding:8px 10px; font-size:13px;" ${addBtnDisabled}>
                                ${classOptionsHtml}
                            </select>
                        </div>
                        <button type="button" class="btn btn-green" onclick="addClassToSub('${subId}')"
                                style="padding:8px 12px; font-size:12px;" ${addBtnDisabled}>
                            <i class="fas fa-plus"></i> إضافة
                        </button>
                    </div>
                    ${availableClasses.length === 0 ? `<p style="color:#6b7385; font-size:10.5px; margin:6px 0 0; text-align:right;">لا توجد فصول مُنشأة — أنشئها من "المحاضرات"</p>` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    return html;
}

function addClassToSub(subId) {
    const sel = document.querySelector(`.add-cls-select[data-subject="${subId}"]`);
    if (!sel || !sel.value) {
        return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار Class!'});
    }
    const clsNum = sel.value;

    const existing = document.querySelector(`.cls-chip[data-subject="${subId}"][data-class="${clsNum}"]`);
    if (existing) {
        return Swal.fire({...swalDark, icon:'info', text:`Class ${clsNum} مُضاف بالفعل!`});
    }

    const chip = document.createElement('span');
    chip.className = 'cls-chip';
    chip.setAttribute('data-subject', subId);
    chip.setAttribute('data-class', clsNum);
    chip.style.cssText = 'display:inline-flex; align-items:center; gap:5px; background:rgba(6,182,212,0.15); color:#22d3ee; padding:3px 8px; border-radius:6px; font-size:11px; margin:2px; font-family:monospace; font-weight:800;';
    chip.innerHTML = `Class ${clsNum} <i class="fas fa-times" style="cursor:pointer; opacity:0.7;" onclick="removeClassChip(this)"></i>`;

    const list = document.querySelector(`.cls-list[data-sub-id="${subId}"]`);
    if (list) {
        if (list.querySelector('p')) list.innerHTML = '';
        list.appendChild(chip);
    }

    const subCb = document.querySelector(`.sub-checkbox[value="${subId}"]`);
    if (subCb) subCb.checked = true;

    sel.value = '';
}

function removeClassChip(iconEl) {
    const chip = iconEl.closest('.cls-chip');
    if (!chip) return;
    const subId = chip.getAttribute('data-subject');
    chip.remove();

    const list = document.querySelector(`.cls-list[data-sub-id="${subId}"]`);
    if (list && list.querySelectorAll('.cls-chip').length === 0) {
        list.innerHTML = '<p style="color:#6b7385; font-size:11px; margin:4px 0;">لا توجد فصول مُعيَّنة بعد</p>';
    }
}

function collectSelectedClasses() {
    const result = [];
    document.querySelectorAll('.cls-chip').forEach(chip => {
        const subId = chip.getAttribute('data-subject');
        const cls = chip.getAttribute('data-class');
        result.push(`${subId}|Class${cls}`);
    });
    return result;
}

function collectSelectedSubjects() {
    const result = [];
    document.querySelectorAll('.sub-checkbox:checked').forEach(cb => result.push(cb.value));
    return result;
}

function bindStaffCheckboxes() {
    document.querySelectorAll('.sub-checkbox').forEach(subCb => {
        if (subCb.dataset.bound) return;
        subCb.dataset.bound = '1';
        subCb.addEventListener('change', () => {
            const subId = subCb.value;
            if (!subCb.checked) {
                document.querySelectorAll(`.cls-chip[data-subject="${subId}"]`).forEach(chip => chip.remove());
                const list = document.querySelector(`.cls-list[data-sub-id="${subId}"]`);
                if (list && list.querySelectorAll('.cls-chip').length === 0) {
                    list.innerHTML = '<p style="color:#6b7385; font-size:11px; margin:4px 0;">لا توجد فصول مُعيَّنة بعد</p>';
                }
            }
        });
    });
}

function renderStaff(list) {
    const tbody = document.getElementById('staff-table-body');
    if (!tbody) return;

    const visibleStaff = list.filter(u => u.username !== currentAdminUsername);

    if (visibleStaff.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="color:var(--text-muted); padding:30px;">لا يوجد أعضاء</td></tr>`;
        return;
    }

    tbody.innerHTML = visibleStaff.map(u => {
        let allowedNames = '-';
        if (u.allowed_subjects && u.allowed_subjects.length > 0) {
            allowedNames = u.allowed_subjects.map(subId => {
                let fSub = allData.subjects.find(gs => gs.id === subId);
                return fSub ? `<span style="background:rgba(255,179,0,0.1); color:var(--gold); padding:2px 6px; border-radius:4px; font-size:11px; margin:2px; display:inline-block;">${fSub.name}</span>` : '';
            }).join('');
        }

        let classesHtml = '';
        if (u.allowed_classes && u.allowed_classes.length > 0) {
            classesHtml = u.allowed_classes.map(item => {
                const parts = item.split('|');
                if (parts.length !== 2) return '';
                const clsNum = (parts[1] || '').replace('Class', '');
                return `<span style="background:rgba(6,182,212,0.12); color:#22d3ee; padding:2px 6px; border-radius:4px; font-size:10px; margin:2px; display:inline-block; font-family:monospace; font-weight:800;">Class ${clsNum}</span>`;
            }).join('');
        }

        let roleStr = u.role === 'doctor'
            ? '<i class="fas fa-user-tie" style="color:#10B981"></i> دكتور'
            : '<i class="fas fa-user-graduate" style="color:#3B82F6"></i> معيد';

        const isActive = u.is_active !== false;
        const statusBadge = isActive
            ? '<span class="status-badge status-active"><i class="fas fa-circle"></i> نشط</span>'
            : '<span class="status-badge status-inactive"><i class="fas fa-circle"></i> موقوف</span>';

        const canEdit = canEditStaff(u);

        return `
        <tr class="${!isActive ? 'row-inactive' : ''}">
            <td><b>${u.name}</b></td>
            <td style="font-family:monospace;">${u.username}</td>
            <td>
                ${allowedNames}
                ${classesHtml ? `<div style="margin-top:4px;">${classesHtml}</div>` : ''}
            </td>
            <td>${roleStr}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="staff-actions">
                    ${canEdit ? `<button class="gsc-btn gsc-btn-edit" onclick="editStaffModal('${u.username}')"><i class="fas fa-edit"></i></button>` : ''}
                    ${canEdit ? `<button class="gsc-btn ${isActive ? 'gsc-btn-del' : 'gsc-btn-activate'}" onclick="toggleStaffStatus('${u.username}', ${!isActive})"><i class="fas ${isActive ? 'fa-pause' : 'fa-play'}"></i></button>` : ''}
                    ${canEdit ? `<button class="gsc-btn gsc-btn-del" onclick="deleteStaff('${u.username}')"><i class="fas fa-trash"></i></button>` : ''}
                    ${!canEdit ? '<span style="color:var(--text-muted); font-size:11px;">-</span>' : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

async function editStaffModal(username) {
    const member = allData.staff.find(s => s.username === username);
    if (!member) return;
    if (!canEditStaff(member)) return Swal.fire({...swalDark, icon:'error', text:'غير مصرح!'});

    const canEditRole = (currentAdminRole === 'super_admin');
    let subjectsToShow = allData.subjects;
    if (currentAdminRole === 'doctor') {
        const mySubs = allData.currentAdmin.allowed_subjects || [];
        subjectsToShow = allData.subjects.filter(s => mySubs.includes(s.id));
    }

    let nameAndRoleHtml = '';
    if (canEditRole) {
        nameAndRoleHtml = `
            <input id="ed-name" class="login-input" value="${member.name}" placeholder="الاسم">
            <select id="ed-role" class="login-input">
                <option value="doctor" ${member.role === 'doctor' ? 'selected' : ''}>دكتور</option>
                <option value="ta" ${member.role === 'ta' ? 'selected' : ''}>معيد</option>
            </select>
        `;
    } else {
        nameAndRoleHtml = `
            <div class="locked-subject-field" style="margin-bottom:14px;">
                <i class="fas fa-user"></i><span>${member.name}</span>
                <span style="color:var(--text-muted); font-size:11px; margin-right:auto;">(${member.role === 'doctor' ? 'دكتور' : 'معيد'})</span>
            </div>
        `;
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: `تعديل صلاحيات (${member.name})`, width: 640,
        html: `
            ${nameAndRoleHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin: 12px 0 6px;">المواد والفصول المصرح بها:</p>
            ${getGroupedSubjectsHTML(member.allowed_subjects || [], member.allowed_classes || [], subjectsToShow)}
        `,
        didOpen: () => bindStaffCheckboxes(),
        preConfirm: () => {
            const selSubs = collectSelectedSubjects();
            const selClasses = collectSelectedClasses();
            const result = { allowed_subjects: selSubs, allowed_classes: selClasses };
            if (canEditRole) {
                const nameInput = document.getElementById('ed-name');
                if (nameInput && nameInput.value.trim()) result.name = nameInput.value.trim();
                const roleSel = document.getElementById('ed-role');
                if (roleSel) result.role = roleSel.value;
            }
            return result;
        }
    });

    if (form) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'edit_staff', target_username: username, staff: form })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تم التعديل ✅', timer: 1200, showConfirmButton: false});
            refreshDataSilently();
        } else {
            Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
        }
    }
}

async function addStaff() {
    let roleSelectHtml = '';
    if(currentAdminRole === 'super_admin') {
        roleSelectHtml = `<select id="st-role" class="login-input"><option value="doctor">دكتور</option><option value="ta" selected>معيد</option></select>`;
    } else {
        roleSelectHtml = `<p style="text-align:right; color:#10B981; font-size:12px; margin-bottom:10px;"><i class="fas fa-info-circle"></i> سيتم إضافته كـ (معيد) تحت إشرافك.</p>`;
    }

    let subjectsForAdd = allData.subjects;
    if (currentAdminRole === 'doctor') {
        const mySubs = allData.currentAdmin.allowed_subjects || [];
        subjectsForAdd = allData.subjects.filter(s => mySubs.includes(s.id));
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة عضو جديد', width: 640,
        html: `
            <input id="st-name" class="login-input" placeholder="الاسم ثلاثي">
            <input id="st-user" class="login-input ltr-input" placeholder="Username">
            <input id="st-pass" class="login-input ltr-input" placeholder="Password">
            ${roleSelectHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin: 8px 0 6px;">المواد والفصول المصرح بها:</p>
            ${getGroupedSubjectsHTML([], [], subjectsForAdd)}
        `,
        didOpen: () => bindStaffCheckboxes(),
        preConfirm: () => {
            const selSubs = collectSelectedSubjects();
            const selClasses = collectSelectedClasses();
            const name = document.getElementById('st-name').value.trim();
            const username = document.getElementById('st-user').value.trim();
            const password = document.getElementById('st-pass').value.trim();
            let role = 'ta';
            if(document.getElementById('st-role')) role = document.getElementById('st-role').value;
            if(!name || !username || !password) return Swal.showValidationMessage('املأ البيانات!');
            return { name, username, password, role, allowed_subjects: selSubs, allowed_classes: selClasses };
        }
    });

    if (form) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'manage_staff', sub: 'add', staff: form })
        });
        const data = await res.json();
        if(data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تمت الإضافة ✅', timer: 1200, showConfirmButton: false});
            refreshDataSilently();
        } else {
            Swal.fire({...swalDark, icon:'error', text: data.message});
        }
    }
}

async function toggleStaffStatus(username, newActiveStatus) {
    const member = allData.staff.find(s => s.username === username);
    if (!member) return;
    if (!canEditStaff(member)) return Swal.fire({...swalDark, icon:'error', text:'غير مصرح!'});

    const actionWord = newActiveStatus ? 'تنشيط' : 'إيقاف';
    const confirm = await Swal.fire({
        ...swalDark, icon: 'question', title: `${actionWord} الحساب؟`,
        html: newActiveStatus
            ? `سيتمكن <b style="color:#10B981">${member.name}</b> من الدخول`
            : `لن يتمكن <b style="color:#EF4444">${member.name}</b> من الدخول`,
        showCancelButton: true,
        confirmButtonText: actionWord,
        cancelButtonText: 'إلغاء',
        confirmButtonColor: newActiveStatus ? '#10B981' : '#EF4444'
    });
    if (!confirm.isConfirmed) return;

    const old = member.is_active;
    member.is_active = newActiveStatus;
    renderStaff(allData.staff);

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'toggle_staff_status', target_username: username, is_active: newActiveStatus })
    });
    const data = await res.json();

    if (data.status === 'success') {
        Swal.fire({...swalDark, icon:'success', title: `تم ${actionWord}`, timer: 1000, showConfirmButton: false});
    } else {
        member.is_active = old;
        renderStaff(allData.staff);
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

async function deleteStaff(u) {
    const member = allData.staff.find(s => s.username === u);
    if (member && !canEditStaff(member)) return Swal.fire({...swalDark, icon:'error', text:'غير مصرح!'});

    const memberName = member ? member.name : u;

    const confirm = await Swal.fire({
        ...swalDark, icon: 'warning', title: 'تأكيد الحذف',
        html: `<div style="text-align:center;">
                <p style="color:#fff; margin-bottom:10px;">سيتم حذف العضو نهائياً</p>
                <p style="color:#FFB300; font-weight:900; font-size:15px;">${memberName}</p>
               </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-trash"></i> حذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444',
        reverseButtons: true, focusCancel: true
    });

    if (!confirm.isConfirmed) return;

    const idx = allData.staff.findIndex(s => s.username === u);
    const removed = idx >= 0 ? allData.staff.splice(idx, 1)[0] : null;
    renderStaff(allData.staff);

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_staff', sub: 'delete', username: u })
    });
    const data = await res.json();

    if(data.status === 'success') {
        Swal.fire({...swalDark, icon: 'success', title: 'تم الحذف', timer: 1100, showConfirmButton: false});
        refreshDataSilently();
    } else {
        if (removed) allData.staff.splice(idx, 0, removed);
        renderStaff(allData.staff);
        Swal.fire({...swalDark, icon:'error', text: data.message});
    }
}

async function changeMyPassword() {
    const { value: pw } = await Swal.fire({
        ...swalDark, title: 'تغيير كلمة المرور',
        input: 'password', inputPlaceholder: 'كلمة المرور الجديدة'
    });
    if(pw) {
        await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change_my_password', new_password: pw })
        });
        Swal.fire({...swalDark, icon:'success', title: 'تم التغيير!', timer: 1200, showConfirmButton: false});
        const saved = getSavedAdminCredentials();
        if (saved) saveAdminCredentials(saved.username, pw);
    }
}

async function wipeDatabase() {
    const { value: pass } = await Swal.fire({
        ...swalDark, title: '⚠️ تصفير السجلات',
        text: 'أدخل كلمة مرور الآدمن:',
        input: 'password'
    });
    if (pass) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'wipe_all', admin_password: pass })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Swal.fire({ ...swalDark, icon: 'success', text: data.message });
            refreshDataSilently();
        } else {
            Swal.fire({ ...swalDark, icon: 'error', text: data.message });
        }
    }
}
