const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let allData = { subjects:[], sessions:[], staff:[] };
let activeLiveSession = null;
let qrGenerator = null;
let liveCodeInterval = null;
let activeSubjectsFilter = 'all';
let currentInspectedSessionId = null;
let currentSessionRecords = [];

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
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        icon.style.color = 'var(--gold)';
    } else {
        passInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        icon.style.color = 'var(--text-muted)';
    }
}

async function handleLogin() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value.trim();

    if (!u || !p) {
        return Swal.fire({ ...swalDark, icon: 'warning', text: 'يرجى إدخال اسم المستخدم وكلمة المرور!' });
    }

    Swal.fire({
        title: 'جاري التحقق...',
        background: '#161b26',
        color: '#fff',
        didOpen: () => Swal.showLoading()
    });

    try {
        const res = await fetch('/api/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        Swal.close();

        if (res.ok && data.status === 'success') {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            loadAdminData();
        } else {
            Swal.fire({ ...swalDark, icon: 'error', title: 'خطأ', text: data.message || 'بيانات الدخول غير صحيحة!' });
        }
    } catch (err) {
        Swal.close();
        Swal.fire({ ...swalDark, icon: 'error', text: 'تعذر الاتصال بالسيرفر!' });
    }
}

window.onload = () => {
    const passInput = document.getElementById('pass');
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    fetch('/api/admin-data')
        .then(r => r.json())
        .then(d => {
            if (d.status === 'success') {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'flex';
                allData = d;
                applyAdminData(d);
            }
        }).catch(() => {});
};

async function loadAdminData() {
    const res = await fetch('/api/admin-data');
    const data = await res.json();
    if (data.status === 'unauthorized') return location.reload();
    allData = data;
    applyAdminData(data);
}

function applyAdminData(data) {
    let roleBadge = '';
    if(data.currentAdmin.role === 'super_admin') roleBadge = '<span style="color:var(--gold); font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">الآدمن الرئيسي</span>';
    else if(data.currentAdmin.role === 'doctor') roleBadge = '<span style="color:#10B981; font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">دكتور مادة</span>';
    else roleBadge = '<span style="color:#3B82F6; font-size:12px; background:#000; padding:2px 8px; border-radius:10px;">معيد</span>';

    document.getElementById('welcome-text').innerHTML = `مرحباً، ${data.currentAdmin.name} ${roleBadge}`;

    if (data.currentAdmin.role !== 'super_admin') {
        document.querySelectorAll('.super-only').forEach(el => el.style.display = 'none');
    }
    if (data.currentAdmin.role === 'ta') {
        document.querySelectorAll('.staff-manager-only').forEach(el => el.style.display = 'none');
    }

    renderSessions(data.sessions);
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

// ----------------- جدول الجلسات -----------------
function renderSessions(list) {
    document.getElementById('sessions-table-body').innerHTML = list.map(s => `
        <tr class="clickable-row" ondblclick="openSessionAttendanceModal('${s.session_id}')" title="اضغط مرتين لفتح كشف الطلاب المسجلين">
            <td style="font-weight:bold; color:var(--gold); font-size:15px;">${s.subject_name}</td>
            <td>${s.type === 'Lecture' ? 'محاضرة' : 'سكشن'}</td>
            <td><b>${s.title}</b></td>
            <td>${s.is_open ? '<span style="color:#10B981; font-weight:bold;">مفتوح 🟢</span>' : '<span style="color:#EF4444; font-weight:bold;">مغلق 🔴</span>'}</td>
            <td style="color:#fff; font-size:13px;">${s.created_by || 'الآدمن الرئيسي'}</td>
            <td>
                <div style="display:flex; justify-content:center; gap:8px; align-items:center;">
                    <button class="btn btn-gold" style="padding:6px 14px; font-size:13px;" onclick="event.stopPropagation(); startLiveBroadcast('${s.session_id}', '${s.title}', '${s.subject_name}')"><i class="fas fa-qrcode"></i> بث الـ QR</button>
                    <button class="btn ${s.is_open ? 'btn-red':'btn-green'}" style="padding:6px 14px; font-size:13px;" onclick="event.stopPropagation(); toggleSession('${s.session_id}', ${!s.is_open})">${s.is_open ? 'إغلاق':'فتح'}</button>
                    <button class="btn btn-red" style="padding:6px 10px;" onclick="event.stopPropagation(); deleteSession('${s.session_id}')" title="حذف الجلسة"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ----------------- نافذة عرض طلاب الجلسة -----------------
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
    if (!q) {
        renderGlassStudentCards(currentSessionRecords, currentInspectedSessionId);
        return;
    }
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
            <div style="text-align:center; padding:50px 20px; background:rgba(30,41,59,0.5); border-radius:18px; border:1px dashed rgba(255,255,255,0.15);">
                <i class="fas fa-user-clock fa-3x" style="color:var(--text-muted); margin-bottom:12px;"></i>
                <h3 style="color:#fff; font-size:16px;">لا توجد نتائج مطابقة</h3>
                <p style="color:var(--text-muted); font-size:13px; margin-top:5px;">تأكد من كتابة الاسم أو رقم الـ ID بشكل صحيح.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(r => {
        const isManual = r.is_manual || (r.ip && r.ip.includes("ADMIN"));
        const entryColor = isManual ? '#f59e0b' : '#10b981';
        const entryText = isManual ? '✍️ تسجيل يدوي (الآدمن)' : '🖥️ تسجيل تلقائي (QR)';

        return `
            <div class="glass-student-card ${isManual ? 'manual-entry' : 'auto-entry'}">
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:rgba(255,255,255,0.1); color:#cbd5e1; font-weight:700; font-size:13px; padding:3px 10px; border-radius:8px; font-family:monospace;">ID: ${r.student_id}</span>
                        <span style="font-size:12px; font-weight:bold; color:${entryColor};">${entryText}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-muted);"><i class="far fa-clock" style="color:#10b981;"></i> ${r.timestamp}</div>
                </div>

                <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap; justify-content:flex-end;">
                    <div style="text-align:left;">
                        <h3 style="font-size:18px; font-weight:900; color:#fff; margin:0;">${r.student_name}</h3>
                        <span style="font-size:12px; color:var(--text-muted);">${r.year || ''} ${r.department ? '- ' + r.department : ''}</span>
                    </div>

                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-gold" style="padding:6px 10px; font-size:12px;" onclick="editAttendanceRecordModal('${sessionId}', '${r.student_id}', '${r.student_name}')"><i class="fas fa-edit"></i> تعديل</button>
                        <button class="btn btn-red" style="padding:6px 10px; font-size:12px;" onclick="deleteSessionAttendanceRecord('${sessionId}', '${r.student_id}')"><i class="fas fa-trash"></i></button>
                    </div>
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
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
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
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'edit_attendance_record', session_id: sessionId, old_id: oldId, ...form })
        });
        openSessionAttendanceModal(sessionId);
    }
}

async function deleteSessionAttendanceRecord(sessionId, studentId) {
    if(!confirm(`هل تريد حذف تسجيل حضور الطالب (${studentId}) من هذه الجلسة؟`)) return;
    await fetch('/api/admin-action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'delete_attendance_record', session_id: sessionId, student_id: studentId })
    });
    openSessionAttendanceModal(sessionId);
}

// ----------------- إدارة المواد -----------------
function filterSubjectsTab(filterValue, btnEl) {
    activeSubjectsFilter = filterValue;
    document.querySelectorAll('#subject-nav-filters .com-btn').forEach(btn => btn.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    renderSubjectsTable();
}

function renderSubjectsTable() {
    let filteredSubs = allData.subjects;

    if (activeSubjectsFilter !== 'all') {
        if(activeSubjectsFilter.includes('_')) {
            const parts = activeSubjectsFilter.split('_');
            const targetYear = parts[0];
            const targetDept = parts[1];
            filteredSubs = allData.subjects.filter(s => s.year === targetYear && (s.department === targetDept || s.department === 'عام (IT)'));
        } else {
            filteredSubs = allData.subjects.filter(s => s.year === activeSubjectsFilter);
        }
    }

    if(filteredSubs.length === 0) {
        document.getElementById('subjects-table-body').innerHTML = `<tr><td colspan="5" style="color:var(--text-muted); padding:30px;">لا توجد مواد مضافة في هذا القسم.</td></tr>`;
        return;
    }

    document.getElementById('subjects-table-body').innerHTML = filteredSubs.map(s => {
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
                    <button class="btn btn-red" style="padding:4px 8px; font-size:12px;" onclick="deleteSubject('${s.id}')"><i class="fas fa-trash"></i> حذف</button>
                ` : '-'}
            </td>
        </tr>
    `}).join('');
}

async function addSubject() {
    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة مادة جديدة مع الصورة',
        html: `
            <input id="as-name" class="login-input" placeholder="اسم المادة">
            <select id="as-year" class="login-input">
                <option>الفرقة الأولى</option><option>الفرقة الثانية</option><option>الفرقة الثالثة</option><option>الفرقة الرابعة</option>
            </select>
            <select id="as-dept" class="login-input">
                <option>عام (IT)</option><option>Software</option><option>Network</option>
            </select>
            <p style="text-align:right; font-size:12px; color:var(--text-muted);">أيقونة / صورة المادة (من الجهاز):</p>
            <input type="file" id="as-file" class="login-input" accept="image/*">
        `,
        preConfirm: () => {
            const name = document.getElementById('as-name').value.trim();
            const year = document.getElementById('as-year').value;
            const dept = document.getElementById('as-dept').value;
            const file = document.getElementById('as-file').files[0];
            if(!name) return Swal.showValidationMessage('يرجى كتابة اسم المادة!');
            
            return new Promise(resolve => {
                if(file) {
                    const reader = new FileReader();
                    reader.onload = e => resolve({ name, year, department: dept, image: e.target.result });
                    reader.readAsDataURL(file);
                } else {
                    resolve({ name, year, department: dept, image: 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png' });
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

async function deleteSubject(id) {
    if (!confirm("مسح هذه المادة وجميع جلساتها؟")) return;
    await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_subject', sub: 'delete', id: id })
    });
    loadAdminData();
}

// ----------------- البث المباشر والكود -----------------
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
    document.getElementById('live-box').style.display = 'none';
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_session', session_id: id, is_open: isOpen })
    });
    loadAdminData();
}

async function deleteSession(id) {
    if(!confirm("حذف هذه الجلسة وجميع سجلات الحضور الخاصة بها؟")) return;
    await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_session', session_id: id })
    });
    loadAdminData();
}

async function createSessionModal() {
    const subOpts = allData.subjects.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('');
    if(!subOpts) return Swal.fire({...swalDark, icon:'warning', text:'لا توجد مواد مصرح لك بفتح جلسة لها حالياً!'});

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'فتح جلسة حضور جديدة',
        html: `
            <select id="sw-sub" class="login-input">${subOpts}</select>
            <select id="sw-type" class="login-input"><option value="Lecture">محاضرة (Lecture)</option><option value="Section">سكشن عملي (Section)</option></select>
            <input id="sw-title" class="login-input" placeholder="عنوان المحاضرة أو السكشن (مثال: سكشن 3)">
        `,
        preConfirm: () => {
            const sel = document.getElementById('sw-sub');
            return {
                subject_id: sel.value,
                subject_name: sel.options[sel.selectedIndex].getAttribute('data-name'),
                type: document.getElementById('sw-type').value,
                title: document.getElementById('sw-title').value.trim() || 'عام'
            };
        }
    });
    if (form) {
        await fetch('/api/admin-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_session', session: form })
        });
        loadAdminData();
    }
}

// ----------------- إدارة الطاقم -----------------
function renderStaff(list) {
    document.getElementById('staff-table-body').innerHTML = list.map(u => {
        let allowedNames = '-';
        if (u.allowed_subjects && u.allowed_subjects.length > 0) {
            allowedNames = u.allowed_subjects.map(subId => {
                let fSub = allData.subjects.find(gs => gs.id === subId);
                return fSub ? `<span style="background:rgba(255, 179, 0, 0.1); color:var(--gold); padding:2px 6px; border-radius:4px; font-size:11px; margin:2px; display:inline-block;">${fSub.name}</span>` : '';
            }).join('');
        }

        let roleStr = u.role === 'doctor' ? '<i class="fas fa-user-tie" style="color:#10B981"></i> دكتور مادة' : '<i class="fas fa-user-graduate" style="color:#3B82F6"></i> معيد';

        return `
        <tr>
            <td><b>${u.name}</b></td>
            <td style="font-family:monospace;">${u.username}</td>
            <td>${allowedNames}</td>
            <td>${roleStr}</td>
            <td>
                <button class="btn btn-red" style="padding:4px 8px; font-size:12px;" onclick="deleteStaff('${u.username}')"><i class="fas fa-trash"></i> حذف</button>
            </td>
        </tr>
    `}).join('');
}

function getGroupedSubjectsHTML(allowedSubjects = []) {
    let html = '<div style="background:#000; padding:12px; border-radius:10px; max-height:180px; overflow-y:auto; text-align:right;">';
    allData.subjects.forEach(s => {
        const isChecked = allowedSubjects.includes(s.id) ? 'checked' : '';
        html += `
            <label style="display:block; font-size:12px; margin-bottom:6px; cursor:pointer;">
                <input type="checkbox" class="st-sub-check" value="${s.id}" ${isChecked}> ${s.name} (${s.year || ''})
            </label>
        `;
    });
    html += '</div>';
    return html;
}

async function addStaff() {
    let roleSelectHtml = '';
    if(allData.currentAdmin.role === 'super_admin') {
        roleSelectHtml = `
            <select id="st-role" class="login-input">
                <option value="doctor">دكتور مادة</option>
                <option value="ta" selected>معيد</option>
            </select>
        `;
    } else {
        roleSelectHtml = `<p style="text-align:right; color:#10B981; font-size:12px; margin-bottom:10px;"><i class="fas fa-info-circle"></i> سيتم إضافة المستخدم كـ (معيد) تحت إشرافك.</p>`;
    }

    const { value: form } = await Swal.fire({
        ...swalDark, title: 'إضافة عضو جديد للطاقم',
        html: `
            <input id="st-name" class="login-input" placeholder="الاسم ثلاثي">
            <input id="st-user" class="login-input ltr-input" placeholder="اسم الدخول (Username)">
            <input id="st-pass" class="login-input ltr-input" placeholder="كلمة المرور">
            ${roleSelectHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin-bottom:5px;">المواد المصرح بها:</p>
            ${getGroupedSubjectsHTML([])}
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'manage_staff', sub: 'add', staff: form })
        });
        const data = await res.json();
        if(data.status === 'success') loadAdminData();
        else Swal.fire({...swalDark, icon:'error', text: data.message});
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
        const { value: form } = await Swal.fire({
            ...swalDark, title: `تعديل صلاحيات (${member.name})`,
            html: `
                <p style="text-align:right; font-size:12px; color:var(--text-muted); margin-bottom:5px;">حدد المواد المسموحة له:</p>
                ${getGroupedSubjectsHTML(member.allowed_subjects || [])}
            `,
            preConfirm: () => {
                const selSubs = Array.from(document.querySelectorAll('.st-sub-check:checked')).map(c => c.value);
                return { name: member.name, role: member.role, allowed_subjects: selSubs };
            }
        });
        if(form) {
            await fetch('/api/admin-action', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change_my_password', new_password: pw })
        });
        Swal.fire({...swalDark, icon:'success', title: 'تم تغيير كلمة المرور بنجاح!'});
    }
}

async function deleteStaff(u) {
    if (!confirm("تأكيد حذف هذا العضو؟")) return;
    const res = await fetch('/api/admin-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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