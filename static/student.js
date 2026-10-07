const swalDark = { background: '#1a1f2c', color: '#fff', confirmButtonColor: '#FFB300' };
let currentStudent = null;
let allSubjects = [];
let allActiveSessions = [];
let selectedSession = null;
let html5Qr = null;

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
    const id = document.getElementById('login-id').value.trim();
    const year = document.getElementById('login-year').value;
    let dept = 'عام (IT)';

    if (year === 'الفرقة الثالثة' || year === 'الفرقة الرابعة') {
        dept = document.getElementById('login-dept').value;
    }

    if(!name || name.length < 3) return Swal.fire({...swalDark, icon:'warning', text:'يرجى إدخال اسم الطالب بشكل صحيح!'});
    if(id.length !== 7 || isNaN(id)) return Swal.fire({...swalDark, icon:'warning', text:'رقم الـ ID يجب أن يتكون من 7 أرقام!'});
    if(!year) return Swal.fire({...swalDark, icon:'warning', text:'يرجى اختيار الفرقة الدراسية!'});

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
    document.getElementById('display-email').innerText = currentStudent.email;
    document.getElementById('display-id').innerText = currentStudent.student_id;
    document.getElementById('display-academic').innerText = `${currentStudent.year} - ${currentStudent.department}`;
    loadDashboard();
}

function logoutStudent() {
    localStorage.removeItem('nx_student_auth');
    location.reload();
}

async function loadDashboard() {
    document.getElementById('loading-screen').style.display = 'flex';
    // طلب المواد الخاصة بفرقة وقسم هذا الطالب تحديداً
    const res = await fetch(`/api/student-init?year=${encodeURIComponent(currentStudent.year)}&dept=${encodeURIComponent(currentStudent.department)}`);
    const data = await res.json();
    document.getElementById('loading-screen').style.display = 'none';

    allSubjects = data.subjects || [];
    allActiveSessions = data.sessions || [];

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

    // هنا التعديل المطلوب: تم حذف شارة (الفرقة - القسم) نهائياً من تحت اسم المادة
    container.innerHTML = allSubjects.map(sub => {
        const activeCount = allActiveSessions.filter(s => s.subject_id === sub.id).length;
        const statusBadge = activeCount > 0 
            ? `<span style="background:rgba(16,185,129,0.2); color:#10B981; border:1px solid #10B981; padding:4px 10px; border-radius:8px; font-size:12px; margin-top:12px; font-weight:bold;">مفتوح جلسة الآن 🟢</span>` 
            : `<span style="color:var(--text-muted); font-size:12px; margin-top:12px;">لا توجد جلسات حالياً</span>`;

        return `
            <div class="subject-card" onclick="selectSubjectForAttendance('${sub.id}', '${sub.name}')">
                <img src="${sub.image || 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png'}" alt="subject">
                <h2 class="sub-title">${sub.name}</h2>
                ${statusBadge}
            </div>
        `;
    }).join('');
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

function openVerifyModal(sessId, title, subName, type) {
    Swal.close();
    selectedSession = sessId;
    document.getElementById('modal-sess-title').innerText = `${title} (${type === 'Lecture' ? 'محاضرة' : 'سكشن'})`;
    document.getElementById('modal-sess-sub').innerText = subName;
    document.getElementById('totp-input').value = '';
    document.getElementById('verify-modal').style.display = 'flex';
}

function closeVerifyModal() {
    if(html5Qr) { html5Qr.stop(); html5Qr = null; }
    document.getElementById('reader').style.display = 'none';
    document.getElementById('verify-modal').style.display = 'none';
}

function toggleQrReader() {
    const r = document.getElementById('reader');
    if(r.style.display === 'block') {
        if(html5Qr) html5Qr.stop();
        r.style.display = 'none';
        return;
    }
    r.style.display = 'block';
    html5Qr = new Html5Qrcode("reader");
    html5Qr.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => {
        document.getElementById('totp-input').value = text.trim();
        html5Qr.stop();
        r.style.display = 'none';
    }).catch(() => Swal.fire({...swalDark, icon:'error', text:'تعذر تشغيل الكاميرا'}));
}

async function submitAttendanceFinal() {
    const code = document.getElementById('totp-input').value.trim();
    if(code.length !== 6) return Swal.fire({...swalDark, icon:'warning', text:'الرمز السري يتكون من 6 خانات!'});

    Swal.fire({title: 'جاري تسجيل حضورك...', background:'#1a1f2c', color:'#fff', didOpen: () => Swal.showLoading()});

    const res = await fetch('/api/submit-attendance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            student_id: currentStudent.student_id,
            student_name: currentStudent.name,
            session_id: selectedSession,
            code: code,
            device_token: getDeviceToken()
        })
    });
    const data = await res.json();
    if(res.ok) {
        closeVerifyModal();
        Swal.fire({...swalDark, icon:'success', title:'تم بنجاح!', text: data.message});
    } else {
        Swal.fire({...swalDark, icon:'error', title:'خطأ', text: data.message});
    }
}

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