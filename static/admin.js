const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let allData = { subjects:[], sessions:[], staff:[] };
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

function enterAdminDashboard() {
    showMainApp();
    loadAdminData();
}

async function handleLogin() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value.trim();

    if (!u || !p) {
        return Swal.fire({ ...swalDark, icon: 'warning', text: 'يرجى إدخال اسم المستخدم وكلمة المرور!' });
    }

    Swal.fire({
        title: 'جاري التحقق...', background: '#161b26', color: '#fff',
        didOpen: () => Swal.showLoading()
    });

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
            Swal.fire({ ...swalDark, icon: 'error', title: 'خطأ', text: data.message || 'بيانات الدخول غير صحيحة!' });
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
        if (data.status === 'unauthorized') {
            clearAdminCredentials();
            return location.reload();
        }
        allData = data;
        applyAdminData(data);
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
    if (iconEl) {
        iconEl.className = 'welcome-icon-wrap ' + role.cls;
    }

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
        renderFilteredSessionsTable(currentSessionsFilter);
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
                <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">تواصل مع الآدمن الرئيسي لإضافة مواد</p>
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
    renderFilteredSessionsTable(subId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function backToSubjects() {
    currentSessionsFilter = null;
    closeLiveScreen();
    renderAdminSubjectsGrid();
}

function renderFilteredSessionsTable(subId) {
    const filtered = allData.sessions.filter(s => s.subject_id === subId);
    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6" style="padding:40px 20px;">
                <div style="text-align:center;">
                    <i class="fas fa-calendar-times fa-2x" style="color:var(--nx-line-strong); margin-bottom:12px;"></i>
                    <h3 style="color:#fff; font-size:14px; margin:0;">لا توجد جلسات لهذه المادة</h3>
                    <p style="color:var(--text-muted); font-size:12px; margin-top:6px;">اضغط "جلسة جديدة" لإنشاء أول جلسة</p>
                </div>
            </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr class="clickable-row" ondblclick="openSessionAttendanceModal('${s.session_id}')" title="اضغط مرتين لفتح كشف الطلاب المسجلين">
            <td>${s.type === 'Lecture' ? 'محاضرة' : 'سكشن'}</td>
            <td><b>${s.title}</b></td>
            <td>${s.is_open ? '<span style="color:#10B981; font-weight:bold;">مفتوح 🟢</span>' : '<span style="color:#EF4444; font-weight:bold;">مغلق 🔴</span>'}</td>
            <td style="color:#fff; font-size:13px;">${s.created_by || 'الآدمن الرئيسي'}</td>
            <td style="color:var(--text-muted); font-size:11px;">${s.created_at || ''}</td>
            <td>
                <div style="display:flex; justify-content:center; gap:6px; align-items:center; flex-wrap:wrap;">
                    <button class="btn btn-gold" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); startLiveBroadcast('${s.session_id}', '${s.title}', '${s.subject_name}')"><i class="fas fa-qrcode"></i> بث</button>
                    <button class="btn ${s.is_open ? 'btn-red':'btn-green'}" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); toggleSession('${s.session_id}', ${!s.is_open})">${s.is_open ? 'إغلاق':'فتح'}</button>
                    <button class="btn btn-red" style="padding:6px 10px;" onclick="event.stopPropagation(); deleteSession('${s.session_id}')" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderSessions(list) {
    renderSessionsView();
}

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
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-2x"></i><br>جاري جلب كشف الطلاب...</div>`;
    document.getElementById('session-attendance-modal').style.display = 'flex';
    document.getElementById('session-student-search').value = '';

    const res = await fetch(`/api/session-attendance?session_id=${sessionId}`);
    const data = await res.json();

    if(data.status === 'success') {
        const sess = data.session || {};
        document.getElementById('sess-modal-title').innerText = `📜 ${sess.subject_name} - ${sess.title} (${sess.type === 'Lecture' ? 'محاضرة' : 'سكشن'})`;
        document.getElementById('sess-modal-count').innerText = data.records.length;

        currentSessionRecords = data.records || [];
        document.getElementById('sess-btn-add-manual').onclick = () => addManualStudentAttendanceModal(sessionId);
        document.getElementById('sess-btn-export-excel').onclick = () => location.href = `/api/export-attendance-csv?session_id=${sessionId}`;
        renderGlassStudentCards(currentSessionRecords, sessionId);
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
                <h3 style="color:#fff; font-size:14px; margin:0;">لا توجد نتائج مطابقة</h3>
            </div>`;
        return;
    }

    container.innerHTML = records.map(r => {
        const isManual = r.is_manual || (r.ip && r.ip.includes("ADMIN"));
        const entryClass = isManual ? 'manual-entry' : 'auto-entry';
        const entryIcon = isManual ? '✍️' : '🖥️';
        const entryLabel = isManual ? 'يدوي' : 'QR';

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
                    <button class="gsc-btn gsc-btn-edit" onclick="event.stopPropagation(); editAttendanceRecordModal('${sessionId}', '${r.student_id}', '${r.student_name}')" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="gsc-btn gsc-btn-del" onclick="event.stopPropagation(); deleteSessionAttendanceRecord('${sessionId}', '${r.student_id}')" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function closeSessionAttendanceModal() {
    document.getElementById('session-attendance-modal').style.display = 'none';
    currentInspectedSessionId = null;
    loadAdminData();
}

/* =========================================================
   عمليات الحضور اليدوية
   ========================================================= */
async function addManualStudentAttendanceModal(sessionId) {
    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة حضور طالب يدوياً للجلسة',
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

    if(form) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'add_manual_attendance', session_id: sessionId, ...form })
        });
        const data = await res.json();
        if(data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تم!', text: data.message});
            openSessionAttendanceModal(sessionId);
        } else {
            Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
        }
    }
}

async function editAttendanceRecordModal(sessionId, oldId, oldName) {
    const { value: form } = await Swal.fire({
        ...swalDark, title: 'تعديل بيانات حضور الطالب',
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

async function deleteSessionAttendanceRecord(sessionId, studentId) {
    if(!confirm(`هل تريد حذف تسجيل حضور الطالب (${studentId}) من هذه الجلسة؟`)) return;
    await fetch('/api/admin-action', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete_attendance_record', session_id: sessionId, student_id: studentId })
    });
    openSessionAttendanceModal(sessionId);
}

/* =========================================================
   ✅ فلترة المواد — نظام ذكي (سنة + قسم)
   ========================================================= */
function filterSubjectsTab(yearValue, btnEl) {
    activeSubjectYear = yearValue;
    activeSubjectDept = 'all';

    document.querySelectorAll('#subject-nav-filters .com-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const deptFilters = document.getElementById('dept-sub-filters');

    // نظهر فلتر الأقسام بس لو اخترنا فرقة 3 أو 4
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

        // لو فرقة 3 أو 4، نفلتر بالقسم كمان
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
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:30px;">لا توجد مواد مضافة في هذا القسم.</td></tr>`;
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
                        <button class="btn btn-gold" style="padding:4px 10px; font-size:12px;" onclick="editSubject('${s.id}')" title="تعديل المادة"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn btn-red" style="padding:4px 10px; font-size:12px;" onclick="deleteSubject('${s.id}')" title="حذف المادة"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                ` : '-'}
            </td>
        </tr>
    `}).join('');
}

/* =========================================================
   ✅ إضافة مادة جديدة — ذكية (تقرأ الفلتر الحالي)
   ========================================================= */
async function addSubject() {
    // ✅ نحدد الفرقة الافتراضية بناءً على الفلتر الحالي
    let defaultYear = 'الفرقة الأولى';
    if (activeSubjectYear !== 'all') {
        defaultYear = activeSubjectYear;
    }

    // ✅ هل الفرقة 3 أو 4؟ (عندهم أقسام)
    const isYear34 = (defaultYear === 'الفرقة الثالثة' || defaultYear === 'الفرقة الرابعة');

    // ✅ هل واقف على قسم معين في الفلتر؟
    const hasActiveDept = (activeSubjectDept !== 'all');
    const autoPickedDept = (isYear34 && hasActiveDept) ? activeSubjectDept : null;

    // ✅ القسم الافتراضي: لو واقف على قسم نستخدمه، غير كده Software
    let defaultDept = 'Software';
    if (autoPickedDept) defaultDept = autoPickedDept;

    // ✅ القفل: بيقفل بس في فرقة 1 و 2 (عام IT)
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

    // ✅ الرسالة الأولية
    let initialHint;
    let initialHintColor;
    if (isYear12) {
        initialHint = '<i class="fas fa-lock"></i> الفرقة الأولى والثانية قسمها ثابت (عام IT)';
        initialHintColor = 'var(--gold)';
    } else if (autoPickedDept) {
        initialHint = `<i class="fas fa-wand-magic-sparkles"></i> تم اختيار ${autoPickedDept} تلقائياً حسب الفلتر — يمكنك التغيير`;
        initialHintColor = '#22d3ee';
    } else {
        initialHint = '<i class="fas fa-info-circle"></i> اختر القسم (Software أو Network)';
        initialHintColor = '#9aa2b5';
    }

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'إضافة مادة جديدة مع الصورة',
        html: `
            <input id="as-name" class="login-input" placeholder="اسم المادة">
            <select id="as-year" class="login-input">
                ${yearOptionsHtml}
            </select>
            <select id="as-dept" class="login-input"
                ${isYear12 ? 'disabled' : ''}
                style="${isYear12 ? 'opacity:0.55; cursor:not-allowed;' : ''}">
                ${deptOptionsHtml}
            </select>
            <p id="as-dept-hint" style="text-align:right; font-size:11px; color:${initialHintColor}; margin-top:-8px; margin-bottom:8px;">
                ${initialHint}
            </p>
            <p style="text-align:right; font-size:12px; color:var(--text-muted);">صورة المادة:</p>
            <input type="file" id="as-file" class="login-input" accept="image/*">
        `,
        didOpen: () => {
            const yearSel = document.getElementById('as-year');
            const deptSel = document.getElementById('as-dept');
            const hint = document.getElementById('as-dept-hint');

            const updateDept = () => {
                const y = yearSel.value;
                if (y === 'الفرقة الأولى' || y === 'الفرقة الثانية') {
                    deptSel.value = 'عام (IT)';
                    deptSel.disabled = true;
                    deptSel.style.opacity = '0.55';
                    deptSel.style.cursor = 'not-allowed';
                    hint.innerHTML = '<i class="fas fa-lock"></i> الفرقة الأولى والثانية قسمها ثابت (عام IT)';
                    hint.style.color = 'var(--gold)';
                } else {
                    deptSel.disabled = false;
                    deptSel.style.opacity = '1';
                    deptSel.style.cursor = 'pointer';

                    // ✅ لو اتفتح لأول مرة، نستخدم القسم اللي واقف عليه في الفلتر
                    if (deptSel.value === 'عام (IT)') {
                        deptSel.value = hasActiveDept ? activeSubjectDept : 'Software';
                    }

                    // ✅ نغير الرسالة حسب الحالة
                    if (hasActiveDept) {
                        hint.innerHTML = `<i class="fas fa-wand-magic-sparkles"></i> تم اختيار ${deptSel.value} تلقائياً حسب الفلتر — يمكنك التغيير`;
                        hint.style.color = '#22d3ee';
                    } else {
                        hint.innerHTML = '<i class="fas fa-info-circle"></i> اختر القسم (Software أو Network)';
                        hint.style.color = '#9aa2b5';
                    }
                }
            };

            yearSel.addEventListener('change', updateDept);
            updateDept();
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
                    resolve({
                        name, year, department: dept,
                        image: 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'
                    });
                }
            });
        }
    });

    if (form) {
        await fetch('/api/admin-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'manage_subject', sub: 'add', subject: form })
        });
        loadAdminData();
    }
}

/* =========================================================
   ✅ تعديل مادة — مع قفل القسم تلقائياً لفرقة 1 و 2
   ========================================================= */
async function editSubject(id) {
    const sub = allData.subjects.find(s => s.id === id);
    if (!sub) {
        return Swal.fire({...swalDark, icon:'error', text:'المادة غير موجودة!'});
    }

    const currentName = (sub.name || '').replace(/"/g, '&quot;');
    const isYear12 = (sub.year === 'الفرقة الأولى' || sub.year === 'الفرقة الثانية');

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'تعديل بيانات المادة',
        html: `
            <input id="es-name" class="login-input" value="${currentName}" placeholder="اسم المادة">
            <select id="es-year" class="login-input">
                <option ${sub.year === 'الفرقة الأولى' ? 'selected' : ''}>الفرقة الأولى</option>
                <option ${sub.year === 'الفرقة الثانية' ? 'selected' : ''}>الفرقة الثانية</option>
                <option ${sub.year === 'الفرقة الثالثة' ? 'selected' : ''}>الفرقة الثالثة</option>
                <option ${sub.year === 'الفرقة الرابعة' ? 'selected' : ''}>الفرقة الرابعة</option>
            </select>
            <select id="es-dept" class="login-input" ${isYear12 ? 'disabled' : ''} style="${isYear12 ? 'opacity:0.55; cursor:not-allowed;' : ''}">
                <option ${sub.department === 'عام (IT)' ? 'selected' : ''}>عام (IT)</option>
                <option ${sub.department === 'Software' ? 'selected' : ''}>Software</option>
                <option ${sub.department === 'Network' ? 'selected' : ''}>Network</option>
            </select>
            <p id="es-dept-hint" style="text-align:right; font-size:11px; color:${isYear12 ? 'var(--gold)' : '#9aa2b5'}; margin-top:-8px; margin-bottom:8px;">
                ${isYear12 ? '<i class="fas fa-lock"></i> الفرقة الأولى والثانية قسمها ثابت (عام IT)' : '<i class="fas fa-info-circle"></i> اختر القسم (Software أو Network)'}
            </p>
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin-top:8px;">تغيير صورة المادة (اختياري):</p>
            <input type="file" id="es-file" class="login-input" accept="image/*">
        `,
        didOpen: () => {
            const yearSel = document.getElementById('es-year');
            const deptSel = document.getElementById('es-dept');
            const hint = document.getElementById('es-dept-hint');

            const updateDept = () => {
                const y = yearSel.value;
                if (y === 'الفرقة الأولى' || y === 'الفرقة الثانية') {
                    deptSel.value = 'عام (IT)';
                    deptSel.disabled = true;
                    deptSel.style.opacity = '0.55';
                    deptSel.style.cursor = 'not-allowed';
                    hint.innerHTML = '<i class="fas fa-lock"></i> الفرقة الأولى والثانية قسمها ثابت (عام IT)';
                    hint.style.color = 'var(--gold)';
                } else {
                    deptSel.disabled = false;
                    deptSel.style.opacity = '1';
                    deptSel.style.cursor = 'pointer';
                    if (deptSel.value === 'عام (IT)') deptSel.value = 'Software';
                    hint.innerHTML = '<i class="fas fa-info-circle"></i> اختر القسم (Software أو Network)';
                    hint.style.color = '#9aa2b5';
                }
            };

            yearSel.addEventListener('change', updateDept);
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

    if (form) {
        Swal.fire({ title: 'جاري الحفظ...', background:'#161b26', color:'#fff', didOpen: () => Swal.showLoading() });

        const res = await fetch('/api/admin-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'manage_subject',
                sub: 'edit',
                id: id,
                subject: form
            })
        });
        const data = await res.json();
        Swal.close();

        if (data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تم تعديل المادة بنجاح ✅', timer: 1500, showConfirmButton: false});
            loadAdminData();
        } else {
            Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message || 'حدث خطأ أثناء التعديل'});
        }
    }
}

async function deleteSubject(id) {
    if (!confirm("مسح هذه المادة وجميع جلساتها؟")) return;
    await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_subject', sub: 'delete', id: id })
    });
    loadAdminData();
}

/* =========================================================
   البث المباشر
   ========================================================= */
function startLiveBroadcast(sessId, title, subName) {
    activeLiveSession = sessId;
    document.getElementById('live-box').style.display = 'block';
    document.getElementById('live-session-title').innerText = title;
    document.getElementById('live-session-sub').innerText = subName;
    document.getElementById('qr-canvas').innerHTML = '';
    qrGenerator = new QRCode(document.getElementById("qr-canvas"), { width: 220, height: 220 });

    clearInterval(liveCodeInterval);
    fetchLiveCode();
    liveCodeInterval = setInterval(fetchLiveCode, 1000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeLiveScreen() {
    clearInterval(liveCodeInterval);
    const box = document.getElementById('live-box');
    if (box) box.style.display = 'none';
    activeLiveSession = null;
}

async function fetchLiveCode() {
    if (!activeLiveSession) return;
    const res = await fetch(`/api/live-code?session_id=${activeLiveSession}`);
    const data = await res.json();
    document.getElementById('live-code-display').innerText = data.code;
    qrGenerator.clear();
    qrGenerator.makeCode(data.code);
    document.getElementById('live-timer-bar').style.width = ((data.remaining / data.interval) * 100) + '%';
}

async function toggleSession(id, isOpen) {
    await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_session', session_id: id, is_open: isOpen })
    });
    loadAdminData();
}

async function deleteSession(id) {
    if(!confirm("حذف هذه الجلسة وجميع سجلات الحضور الخاصة بها؟")) return;
    await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_session', session_id: id })
    });
    loadAdminData();
}

/* =========================================================
   ✅ ترقيم الجلسات تلقائياً
   ========================================================= */
function generateSessionTitle(subjectId, type) {
    const prefix = type === 'Lecture' ? 'LEC' : 'Sec';
    const regex = new RegExp(`^${prefix}\\s+(\\d+)$`, 'i');
    let maxNum = 0;

    allData.sessions.forEach(s => {
        if (s.subject_id === subjectId && s.type === type) {
            const match = (s.title || '').trim().match(regex);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > maxNum) maxNum = n;
            }
        }
    });

    return `${prefix} ${maxNum + 1}`;
}

/* =========================================================
   ✅ فتح جلسة جديدة
   ========================================================= */
async function createSessionModal() {
    let subjectsToShow = allData.subjects;
    const isInsideSubject = currentSessionsFilter !== null;

    if (isInsideSubject) {
        subjectsToShow = allData.subjects.filter(s => s.id === currentSessionsFilter);
    }

    if (subjectsToShow.length === 0) {
        return Swal.fire({...swalDark, icon:'warning', text:'لا توجد مواد مصرح لك بفتح جلسة لها حالياً!'});
    }

    let defaultType = 'Lecture';
    if (currentAdminRole === 'ta') defaultType = 'Section';

    const firstSub = subjectsToShow[0];
    const initialTitle = generateSessionTitle(firstSub.id, defaultType);

    let subjectFieldHtml = '';
    if (isInsideSubject) {
        subjectFieldHtml = `
            <div class="locked-subject-field">
                <i class="fas fa-book"></i>
                <span>${firstSub.name}</span>
                <i class="fas fa-lock locked-icon"></i>
            </div>
            <input type="hidden" id="sw-sub" value="${firstSub.id}" data-name="${firstSub.name}">
        `;
    } else {
        const subOpts = subjectsToShow.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
        subjectFieldHtml = `<select id="sw-sub" class="login-input">${subOpts}</select>`;
    }

    const lectureSelected = defaultType === 'Lecture' ? 'selected' : '';
    const sectionSelected = defaultType === 'Section' ? 'selected' : '';

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'فتح جلسة حضور جديدة',
        html: `
            ${subjectFieldHtml}
            <select id="sw-type" class="login-input">
                <option value="Lecture" ${lectureSelected}>محاضرة (Lecture)</option>
                <option value="Section" ${sectionSelected}>سكشن عملي (Section)</option>
            </select>
            <input id="sw-title" class="login-input" placeholder="عنوان الجلسة" value="${initialTitle}">
        `,
        didOpen: () => {
            const typeSel = document.getElementById('sw-type');
            const subSel = document.getElementById('sw-sub');
            const titleInput = document.getElementById('sw-title');

            const updateTitle = () => {
                const subId = subSel.value;
                const type = typeSel.value;
                titleInput.value = generateSessionTitle(subId, type);
            };

            typeSel.addEventListener('change', updateTitle);
            if (subSel && !isInsideSubject) {
                subSel.addEventListener('change', updateTitle);
            }
        },
        preConfirm: () => {
            const sel = document.getElementById('sw-sub');
            const title = document.getElementById('sw-title').value.trim();
            return {
                subject_id: sel.value,
                subject_name: sel.getAttribute('data-name'),
                type: document.getElementById('sw-type').value,
                title: title || 'عام'
            };
        }
    });

    if (form) {
        await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_session', session: form })
        });
        loadAdminData();
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

function getGroupedSubjectsHTML(allowedSubjects = [], subjectsList = null) {
    const subs = subjectsList || allData.subjects;
    let html = '<div style="background:#000; padding:12px; border-radius:10px; max-height:180px; overflow-y:auto; text-align:right;">';
    if (subs.length === 0) {
        html += '<p style="color:var(--text-muted); font-size:12px; text-align:center; padding:8px;">لا توجد مواد متاحة</p>';
    } else {
        subs.forEach(s => {
            const isChecked = allowedSubjects.includes(s.id) ? 'checked' : '';
            html += `<label style="display:block; font-size:12px; margin-bottom:6px; cursor:pointer;">
                <input type="checkbox" class="st-sub-check" value="${s.id}" ${isChecked}> ${s.name} (${s.year || ''})
            </label>`;
        });
    }
    html += '</div>';
    return html;
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
                return fSub ? `<span style="background:rgba(255, 179, 0, 0.1); color:var(--gold); padding:2px 6px; border-radius:4px; font-size:11px; margin:2px; display:inline-block;">${fSub.name}</span>` : '';
            }).join('');
        }
        let roleStr = u.role === 'doctor'
            ? '<i class="fas fa-user-tie" style="color:#10B981"></i> دكتور مادة'
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
            <td>${allowedNames}</td>
            <td>${roleStr}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="staff-actions">
                    ${canEdit ? `<button class="gsc-btn gsc-btn-edit" onclick="editStaffModal('${u.username}')" title="تعديل الصلاحيات"><i class="fas fa-edit"></i></button>` : ''}
                    ${canEdit ? `<button class="gsc-btn ${isActive ? 'gsc-btn-del' : 'gsc-btn-activate'}" onclick="toggleStaffStatus('${u.username}', ${!isActive})" title="${isActive ? 'إيقاف الحساب' : 'تنشيط الحساب'}"><i class="fas ${isActive ? 'fa-pause' : 'fa-play'}"></i></button>` : ''}
                    ${canEdit ? `<button class="gsc-btn gsc-btn-del" onclick="deleteStaff('${u.username}')" title="حذف نهائي"><i class="fas fa-trash"></i></button>` : ''}
                    ${!canEdit ? '<span style="color:var(--text-muted); font-size:11px;">-</span>' : ''}
                </div>
            </td>
        </tr>
    `}).join('');
}

async function editStaffModal(username) {
    const member = allData.staff.find(s => s.username === username);
    if (!member) return;

    if (!canEditStaff(member)) {
        return Swal.fire({...swalDark, icon:'error', text:'غير مصرح لك بتعديل هذا العضو!'});
    }

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
                <option value="doctor" ${member.role === 'doctor' ? 'selected' : ''}>دكتور مادة</option>
                <option value="ta" ${member.role === 'ta' ? 'selected' : ''}>معيد</option>
            </select>
        `;
    } else {
        nameAndRoleHtml = `
            <div class="locked-subject-field" style="margin-bottom:14px;">
                <i class="fas fa-user"></i>
                <span>${member.name}</span>
                <span style="color:var(--text-muted); font-size:11px; margin-right:auto;">(${member.role === 'doctor' ? 'دكتور' : 'معيد'})</span>
            </div>
        `;
    }

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: `تعديل صلاحيات (${member.name})`,
        html: `
            ${nameAndRoleHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin: 12px 0 6px;">المواد المصرح بها:</p>
            ${getGroupedSubjectsHTML(member.allowed_subjects || [], subjectsToShow)}
        `,
        preConfirm: () => {
            const selSubs = Array.from(document.querySelectorAll('.st-sub-check:checked')).map(c => c.value);
            const result = { allowed_subjects: selSubs };
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
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'edit_staff',
                target_username: username,
                staff: form
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تم التعديل بنجاح ✅'});
            loadAdminData();
        } else {
            Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
        }
    }
}

async function toggleStaffStatus(username, newActiveStatus) {
    const member = allData.staff.find(s => s.username === username);
    if (!member) return;

    if (!canEditStaff(member)) {
        return Swal.fire({...swalDark, icon:'error', text:'غير مصرح لك بالتحكم في هذا العضو!'});
    }

    const actionWord = newActiveStatus ? 'تنشيط' : 'إيقاف';
    const confirm = await Swal.fire({
        ...swalDark,
        icon: 'question',
        title: `${actionWord} الحساب؟`,
        html: newActiveStatus
            ? `سيتمكن <b style="color:#10B981">${member.name}</b> من الدخول للنظام مرة أخرى`
            : `لن يتمكن <b style="color:#EF4444">${member.name}</b> من الدخول، لكن بياناته ومواده ستبقى محفوظة`,
        showCancelButton: true,
        confirmButtonText: actionWord,
        cancelButtonText: 'إلغاء',
        confirmButtonColor: newActiveStatus ? '#10B981' : '#EF4444'
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            action: 'toggle_staff_status',
            target_username: username,
            is_active: newActiveStatus
        })
    });
    const data = await res.json();
    if (data.status === 'success') {
        Swal.fire({...swalDark, icon:'success', title: `تم ${actionWord} الحساب`});
        loadAdminData();
    } else {
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

async function addStaff() {
    let roleSelectHtml = '';
    if(currentAdminRole === 'super_admin') {
        roleSelectHtml = `<select id="st-role" class="login-input"><option value="doctor">دكتور مادة</option><option value="ta" selected>معيد</option></select>`;
    } else {
        roleSelectHtml = `<p style="text-align:right; color:#10B981; font-size:12px; margin-bottom:10px;"><i class="fas fa-info-circle"></i> سيتم إضافة المستخدم كـ (معيد) تحت إشرافك.</p>`;
    }

    let subjectsForAdd = allData.subjects;
    if (currentAdminRole === 'doctor') {
        const mySubs = allData.currentAdmin.allowed_subjects || [];
        subjectsForAdd = allData.subjects.filter(s => mySubs.includes(s.id));
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة عضو جديد للطاقم',
        html: `
            <input id="st-name" class="login-input" placeholder="الاسم ثلاثي">
            <input id="st-user" class="login-input ltr-input" placeholder="اسم الدخول (Username)">
            <input id="st-pass" class="login-input ltr-input" placeholder="كلمة المرور">
            ${roleSelectHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin-bottom:5px;">المواد المصرح بها:</p>
            ${getGroupedSubjectsHTML([], subjectsForAdd)}
        `,
        preConfirm: () => {
            const selSubs = Array.from(document.querySelectorAll('.st-sub-check:checked')).map(c => c.value);
            const name = document.getElementById('st-name').value.trim();
            const username = document.getElementById('st-user').value.trim();
            const password = document.getElementById('st-pass').value.trim();
            let role = 'ta';
            if(document.getElementById('st-role')) role = document.getElementById('st-role').value;
            if(!name || !username || !password) return Swal.showValidationMessage('يرجى ملء جميع البيانات!');
            return { name, username, password, role, allowed_subjects: selSubs };
        }
    });
    if (form) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'manage_staff', sub: 'add', staff: form })
        });
        const data = await res.json();
        if(data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title:'تم إضافة العضو ✅'});
            loadAdminData();
        } else {
            Swal.fire({...swalDark, icon:'error', text: data.message});
        }
    }
}

async function assignExistingTA() {
    const tas = allData.staff.filter(s => s.role === 'ta');
    if(tas.length === 0) return Swal.fire({...swalDark, icon:'info', text:'لا يوجد معيدين مسجلين بالنظام حالياً.'});

    const opts = tas.map(t => `<option value="${t.username}">${t.name} (${t.username})</option>`).join('');
    const { value: selectedUser } = await Swal.fire({
        ...swalDark, title: 'تعيين معيد مسجل لموادك',
        html: `<select id="as-ta-sel" class="login-input">${opts}</select>`,
        preConfirm: () => document.getElementById('as-ta-sel').value
    });

    if(selectedUser) {
        const member = tas.find(t => t.username === selectedUser);

        let subjectsForAssign = allData.subjects;
        if (currentAdminRole === 'doctor') {
            const mySubs = allData.currentAdmin.allowed_subjects || [];
            subjectsForAssign = allData.subjects.filter(s => mySubs.includes(s.id));
        }

        const { value: form } = await Swal.fire({
            ...swalDark, title: `تعديل صلاحيات (${member.name})`,
            html: `
                <p style="text-align:right; font-size:12px; color:var(--text-muted); margin-bottom:5px;">حدد المواد المسموحة له:</p>
                ${getGroupedSubjectsHTML(member.allowed_subjects || [], subjectsForAssign)}
            `,
            preConfirm: () => {
                const selSubs = Array.from(document.querySelectorAll('.st-sub-check:checked')).map(c => c.value);
                return { name: member.name, role: member.role, allowed_subjects: selSubs };
            }
        });
        if(form) {
            await fetch('/api/admin-action', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'manage_staff', sub: 'edit', old_username: selectedUser, staff: form })
            });
            loadAdminData();
        }
    }
}

async function changeMyPassword() {
    const { value: pw } = await Swal.fire({
        ...swalDark, title: 'تغيير كلمة المرور الخاصة بي',
        input: 'password', inputPlaceholder: 'كلمة المرور الجديدة'
    });
    if(pw) {
        await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change_my_password', new_password: pw })
        });
        Swal.fire({...swalDark, icon:'success', title: 'تم تغيير كلمة المرور بنجاح!'});
        const saved = getSavedAdminCredentials();
        if (saved) saveAdminCredentials(saved.username, pw);
    }
}

async function deleteStaff(u) {
    const member = allData.staff.find(s => s.username === u);
    if (member && !canEditStaff(member)) {
        return Swal.fire({...swalDark, icon:'error', text:'غير مصرح لك بحذف هذا العضو!'});
    }

    const confirm = await Swal.fire({
        ...swalDark,
        icon: 'warning',
        title: 'تأكيد الحذف',
        html: `سيتم حذف العضو نهائياً.<br><span style="color:#FFB300; font-size:12px;">💡 نصيحة: استخدم "إيقاف الحساب" بدلاً من الحذف لو ممكن يرجع لاحقاً</span>`,
        showCancelButton: true,
        confirmButtonText: 'حذف نهائي',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#EF4444'
    });
    if (!confirm.isConfirmed) return;

    const res = await fetch('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_staff', sub: 'delete', username: u })
    });
    const data = await res.json();
    if(data.status === 'success') loadAdminData();
    else Swal.fire({...swalDark, icon:'error', text: data.message});
}

async function wipeDatabase() {
    const { value: pass } = await Swal.fire({
        ...swalDark, title: '⚠️ تصفير سجلات الحضور بالكامل',
        text: 'أدخل كلمة مرور الآدمن للتأكيد:',
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
            loadAdminData();
        } else {
            Swal.fire({ ...swalDark, icon: 'error', text: data.message });
        }
    }
}
