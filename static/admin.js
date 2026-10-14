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
   ✅ عرض تفاصيل المادة
   ========================================================= */
function renderSubjectDetails(subId) {
    const isTA = (currentAdminRole === 'ta');
    const lecturesTitle = document.getElementById('lectures-section-title');
    const newSessionBtn = document.getElementById('btn-new-session');
    const newSessionBtnText = document.getElementById('btn-new-session-text');

    if (lecturesTitle) {
        lecturesTitle.innerText = isTA ? 'السكاشن' : 'المحاضرات';
    }

    if (newSessionBtnText) {
        newSessionBtnText.innerText = isTA ? 'سكشن جديد' : 'محاضرة جديدة';
    }

    if (newSessionBtn) {
        if (isTA) {
            newSessionBtn.setAttribute('onclick', 'openNewSectionModal()');
        } else {
            newSessionBtn.setAttribute('onclick', 'createSessionModal()');
        }
        newSessionBtn.style.display = 'inline-flex';
    }

    renderFilteredSessionsTable(subId);
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
   ✅ جدول الجلسات
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
        const isAutoClosed = s.auto_closed
            ? `<span style="display:inline-block; margin-top:4px; font-size:10px; color:#f59e0b;"><i class="fas fa-clock"></i> أُغلقت تلقائياً</span>`
            : '';

        return `
        <tr class="clickable-row" ondblclick="openSessionAttendanceModal('${s.session_id}')" title="اضغط مرتين لفتح الكشف">
            <td>
                <span class="sess-type-badge ${typeInfo.cls}">
                    <i class="fas ${typeInfo.icon}"></i> ${typeInfo.label}
                </span>
                ${isAutoClosed}
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
                    <button class="btn" style="padding:6px 12px; font-size:12px; background:linear-gradient(135deg, #22d3ee, #06B6D4); color:#0a0e17; font-weight:900; box-shadow:0 4px 14px rgba(34,211,238,0.35);" onclick="event.stopPropagation(); openScreenCodeModal('${s.session_id}', '${s.title}', '${s.subject_name}')"><i class="fas fa-tv"></i> شاشة</button>
                    <button class="btn btn-outline" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); openSessionAttendanceModal('${s.session_id}')"><i class="fas fa-users"></i> الكشف</button>
                    <button class="btn btn-red" style="padding:6px 10px;" onclick="event.stopPropagation(); deleteSession('${s.session_id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

/* =========================================================
   🖥️ نافذة ربط الشاشة — QR Flow
   ========================================================= */
let _adminQrScanner = null;

async function openScreenCodeModal(sessionId, title, subName) {
    await Swal.fire({
        ...swalDark,
        title: '🖥️ ربط الشاشة',
        width: 620,
        html: `
            <div style="text-align:center; padding: 4px 0;">
                <p style="color:#8b93a7; font-size:13px; margin: 0 0 20px; line-height: 1.8;">
                    افتح على شاشة العرض الرابط
                    <b style="color:#22d3ee; font-family:monospace;">/dis</b>
                    <br>ثم امسح الـ QR اللي ظاهر عليها بالموبايل
                </p>

                <button type="button" id="scan-qr-btn"
                    onclick="startDisplayQrScan('${sessionId}')"
                    style="
                        width:100%;
                        padding: 22px;
                        font-size: 18px;
                        font-family: 'Cairo', sans-serif;
                        font-weight: 900;
                        background: linear-gradient(135deg, #FFB300, #FFD54F);
                        color: #0a0e17;
                        border: none;
                        border-radius: 18px;
                        cursor: pointer;
                        box-shadow: 0 14px 34px rgba(255,179,0,0.35);
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 12px;
                    ">
                    <i class="fas fa-camera"></i>
                    امسح QR الشاشة
                </button>

                <div id="admin-qr-reader" style="
                    display:none;
                    margin-top: 16px;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 2px solid rgba(255,179,0,0.4);
                "></div>

                <div id="scan-status" style="
                    margin-top: 14px;
                    font-size: 13px;
                    color: #8b93a7;
                    font-weight: 700;
                    min-height: 24px;
                "></div>

                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
                    <p style="color:#6b7385; font-size:12px; margin: 0 0 8px;">
                        أو استخدم الكود اليدوي (احتياطي)
                    </p>
                    <button type="button" onclick="showManualCodeFallback('${sessionId}')"
                        style="
                            background: transparent;
                            border: 1px solid rgba(255,179,0,0.35);
                            color: #FFB300;
                            padding: 8px 16px;
                            border-radius: 10px;
                            font-size: 12px;
                            font-weight: 800;
                            font-family: 'Cairo', sans-serif;
                            cursor: pointer;
                        ">
                        <i class="fas fa-keyboard"></i> إظهار الكود اليدوي
                    </button>
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: '<i class="fas fa-times"></i> إغلاق',
        cancelButtonColor: '#374151',
        willClose: () => {
            stopAdminQrScan();
        }
    });
}

/* =========================================================
   📷 QR Scanner للأدمن
   ========================================================= */
async function startDisplayQrScan(sessionId) {
    const statusEl = document.getElementById('scan-status');
    const readerEl = document.getElementById('admin-qr-reader');
    const btn = document.getElementById('scan-qr-btn');

    if (!readerEl) return;

    if (btn) btn.style.display = 'none';
    readerEl.style.display = 'block';
    readerEl.innerHTML = `
        <div style="text-align:center; padding:20px; color:#FFB300;">
            <i class="fas fa-spinner fa-spin fa-2x"></i><br><br>
            جاري تشغيل الكاميرا...
        </div>
    `;
    if (statusEl) statusEl.textContent = '';

    await new Promise(r => setTimeout(r, 150));

    if (typeof Html5Qrcode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode';
        document.head.appendChild(script);
        await new Promise(r => script.onload = r);
    }

    try {
        readerEl.innerHTML = '';

        if (_adminQrScanner) {
            try { await _adminQrScanner.stop(); } catch(e) {}
            try { _adminQrScanner.clear(); } catch(e) {}
            _adminQrScanner = null;
        }

        _adminQrScanner = new Html5Qrcode("admin-qr-reader", { verbose: false });

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

            await stopAdminQrScan();

            if (statusEl) {
                statusEl.style.color = '#22d3ee';
                statusEl.textContent = '✅ تم قراءة QR — جاري الربط...';
            }

            try {
                const res = await fetch('/api/screen-pair-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        token: token,
                        session_id: sessionId
                    })
                });
                const data = await res.json();

                if (data.status === 'success') {
                    if (statusEl) {
                        statusEl.style.color = '#10B981';
                        statusEl.textContent = '🎉 تم ربط الشاشة بالجلسة بنجاح!';
                    }
                    setTimeout(() => {
                        Swal.close();
                    }, 1200);
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
        };

        const onError = () => {};

        let started = false;
        try {
            await _adminQrScanner.start({ facingMode: "environment" }, config, onSuccess, onError);
            started = true;
        } catch (e1) {
            try {
                await _adminQrScanner.start({ facingMode: "user" }, config, onSuccess, onError);
                started = true;
            } catch (e2) {
                try {
                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length > 0) {
                        await _adminQrScanner.start(devices[0].id, config, onSuccess, onError);
                        started = true;
                    }
                } catch (e3) {}
            }
        }

        if (!started) throw new Error('No camera');

    } catch (err) {
        readerEl.style.display = 'none';
        if (btn) btn.style.display = 'inline-flex';
        if (statusEl) {
            statusEl.style.color = '#f87171';
            statusEl.textContent = '❌ تعذر تشغيل الكاميرا — استخدم الكود اليدوي';
        }
        await stopAdminQrScan();
    }
}

async function stopAdminQrScan() {
    if (_adminQrScanner) {
        try {
            const state = _adminQrScanner.getState ? _adminQrScanner.getState() : null;
            if (state === 2 || state === 3) {
                try { await _adminQrScanner.stop(); } catch(e) {}
            }
            try { _adminQrScanner.clear(); } catch(e) {}
        } catch(e) {}
        _adminQrScanner = null;
    }
    const readerEl = document.getElementById('admin-qr-reader');
    if (readerEl) {
        readerEl.style.display = 'none';
        readerEl.innerHTML = '';
    }
}

/* =========================================================
   ⌨️ Fallback — الكود اليدوي
   ========================================================= */
async function showManualCodeFallback(sessionId) {
    await stopAdminQrScan();
    Swal.close();

    let pollInterval = null;

    const fetchCode = async () => {
        try {
            const res = await fetch(
                `/api/session-screen-code?session_id=${encodeURIComponent(sessionId)}`,
                { credentials: 'same-origin' }
            );
            const data = await res.json();

            const codeEl = document.getElementById('screen-code-display');
            const barEl  = document.getElementById('screen-code-timer-bar');
            const secEl  = document.getElementById('screen-code-seconds');

            if (!data || data.status !== 'success') {
                if (codeEl) codeEl.textContent = '------';
                return;
            }
            if (codeEl) codeEl.textContent = data.code;
            if (barEl)  barEl.style.width = ((data.remaining / data.interval) * 100) + '%';
            if (secEl)  secEl.textContent = Math.ceil(data.remaining);
        } catch (e) {}
    };

    await Swal.fire({
        ...swalDark,
        title: '🖥️ الكود اليدوي',
        width: 520,
        html: `
            <div style="text-align:center; padding: 4px 0;">
                <p style="color:#8b93a7; font-size:12.5px; margin: 0 0 4px;">
                    اكتب الكود ده على شاشة العرض
                </p>
                <p style="color:#8b93a7; font-size:11.5px; margin: 0 0 16px;">
                    <b style="color:#FFB300;">بسرعة قبل ما يتغير</b>
                </p>
                <div id="screen-code-display" style="
                    font-family: 'Plus Jakarta Sans', monospace;
                    font-size: 56px; font-weight: 900;
                    letter-spacing: 14px;
                    color: #FFB300;
                    text-shadow: 0 0 34px rgba(255,179,0,0.65);
                    padding: 20px;
                    direction: ltr;
                    background: linear-gradient(145deg, rgba(0,0,0,0.5), rgba(15,20,33,0.8));
                    border: 1.5px solid rgba(255,179,0,0.45);
                    border-radius: 18px;
                    margin-bottom: 14px;
                ">------</div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden;">
                    <div id="screen-code-timer-bar" style="
                        height:100%;
                        background: linear-gradient(90deg, #FFB300, #FFD54F);
                        width: 100%;
                        transition: width 0.2s linear;
                        border-radius: 4px;
                    "></div>
                </div>
                <div style="margin-top: 12px; font-size: 11.5px; color:#8b93a7;">
                    المتبقي: <b id="screen-code-seconds" style="color:#FFB300;">20</b> ث
                </div>
            </div>
        `,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'إغلاق',
        cancelButtonColor: '#374151',
        didOpen: () => {
            fetchCode();
            pollInterval = setInterval(fetchCode, 1000);
        },
        willClose: () => {
            if (pollInterval) clearInterval(pollInterval);
        }
    });
}

/* =========================================================
   ✅ تعديل عنوان الجلسة
   ========================================================= */
async function editSessionTitle(sessionId, currentTitle) {
    const { value: newTitle } = await Swal.fire({
        ...swalDark,
        title: 'تعديل عنوان الجلسة',
        input: 'text',
        inputValue: currentTitle,
        inputPlaceholder: 'مثال: W_LAB1 أو Section A أو أي اسم',
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
   ✅ فتح سكشن جديد — الواجهة الاحترافية الذكية
   ========================================================= */
async function openNewSectionModal() {
    const subjectId = currentSessionsFilter;
    if (!subjectId) {
        return Swal.fire({...swalDark, icon: 'error', text: 'لم يتم اختيار مادة!'});
    }

    const subject = allData.subjects.find(s => s.id === subjectId);
    if (!subject) {
        return Swal.fire({...swalDark, icon: 'error', text: 'المادة غير موجودة!'});
    }

    /* ═══ حساب أرقام افتراضية ذكية من السكاشن السابقة ═══ */
    const allSections = allData.sessions.filter(s =>
        s.subject_id === subjectId && s.type === 'Section'
    );

    let maxLab = 0;
    allSections.forEach(s => {
        const m = (s.title || '').match(/LAB(\d+)/i);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxLab) maxLab = n;
        }
    });

    const defaultGroup = 1;
    const defaultClass = 1;
    const defaultLab = maxLab + 1;
    const defaultType = 'W';

    /* ═══ بناء واجهة المودال ═══ */
    const modalHtml = `
        <style>
            /* ═══════════════════════════════════════════════
               SECTION BUILDER · LUXURY UI
               ═══════════════════════════════════════════════ */
            .sb-subject {
                display: flex; align-items: center; gap: 10px;
                padding: 12px 16px;
                margin-bottom: 16px;
                border-radius: 14px;
                background: linear-gradient(135deg, rgba(255,179,0,0.10), rgba(124,58,237,0.05));
                border: 1px solid rgba(255,179,0,0.35);
                color: #FFD54F;
                font-family: 'Cairo', sans-serif;
                font-weight: 800;
                font-size: 14px;
                text-align: right;
            }
            .sb-subject i { font-size: 15px; flex-shrink: 0; }
            .sb-subject span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            .sb-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 14px;
            }
            @media (max-width: 520px) {
                .sb-row { grid-template-columns: 1fr; }
            }

            .sb-field {
                background: linear-gradient(145deg, rgba(20,26,40,0.95), rgba(11,15,26,0.98));
                border: 1.5px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                padding: 12px 14px;
                transition: all 0.25s ease;
                text-align: right;
            }
            .sb-field:focus-within {
                border-color: rgba(255,179,0,0.6);
                box-shadow: 0 0 22px rgba(255,179,0,0.15), inset 0 0 12px rgba(255,179,0,0.05);
                transform: translateY(-1px);
            }
            .sb-label {
                display: flex; align-items: center; gap: 6px;
                font-family: 'Cairo', sans-serif;
                font-size: 11px;
                font-weight: 800;
                color: #8b93a7;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
                text-transform: uppercase;
            }
            .sb-label i {
                color: #FFB300;
                font-size: 11px;
            }
            .sb-label .sb-letter {
                margin-right: auto;
                background: rgba(255,179,0,0.15);
                color: #FFD54F;
                border: 1px solid rgba(255,179,0,0.4);
                padding: 2px 8px;
                border-radius: 6px;
                font-family: 'Plus Jakarta Sans', monospace;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 1px;
            }

            .sb-counter {
                display: flex;
                align-items: center;
                gap: 8px;
                direction: ltr;
            }
            .sb-counter button {
                width: 34px; height: 34px;
                border-radius: 10px;
                background: rgba(255,179,0,0.10);
                border: 1px solid rgba(255,179,0,0.35);
                color: #FFD54F;
                font-size: 15px;
                font-weight: 900;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex; align-items: center; justify-content: center;
                padding: 0;
                flex-shrink: 0;
                font-family: 'Plus Jakarta Sans', sans-serif;
            }
            .sb-counter button:hover {
                background: #FFB300;
                color: #0a0e17;
                transform: scale(1.05);
                box-shadow: 0 0 16px rgba(255,179,0,0.5);
            }
            .sb-counter button:active { transform: scale(0.95); }
            .sb-counter input {
                flex: 1;
                background: rgba(0,0,0,0.55);
                border: 1.5px solid rgba(255,179,0,0.35);
                border-radius: 10px;
                color: #FFD54F;
                font-family: 'Plus Jakarta Sans', monospace;
                font-size: 17px;
                font-weight: 900;
                text-align: center;
                padding: 6px 4px;
                outline: none;
                min-width: 0;
                transition: all 0.2s ease;
            }
            .sb-counter input:focus {
                border-color: #FFB300;
                box-shadow: 0 0 18px rgba(255,179,0,0.3);
                background: rgba(0,0,0,0.75);
            }
            .sb-counter input::-webkit-outer-spin-button,
            .sb-counter input::-webkit-inner-spin-button {
                -webkit-appearance: none; margin: 0;
            }
            .sb-counter input[type=number] { -moz-appearance: textfield; }

            .sb-type-wrap {
                display: flex;
                gap: 8px;
                margin-top: 4px;
            }
            .sb-type-btn {
                flex: 1;
                padding: 10px 8px;
                border-radius: 12px;
                background: rgba(0,0,0,0.5);
                border: 1.5px solid rgba(255,255,255,0.1);
                color: #8b93a7;
                font-family: 'Cairo', sans-serif;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 3px;
                letter-spacing: 0.3px;
            }
            .sb-type-btn .sb-type-letter {
                font-family: 'Plus Jakarta Sans', monospace;
                font-size: 17px;
                font-weight: 900;
                line-height: 1;
            }
            .sb-type-btn .sb-type-name {
                font-size: 10px;
                opacity: 0.85;
                letter-spacing: 0.5px;
            }
            .sb-type-btn:hover {
                border-color: rgba(255,179,0,0.4);
                color: #fff;
                transform: translateY(-1px);
            }
            .sb-type-btn.active {
                background: linear-gradient(135deg, rgba(255,179,0,0.22), rgba(255,179,0,0.06));
                border-color: #FFB300;
                color: #FFD54F;
                box-shadow: 0 0 20px rgba(255,179,0,0.3), inset 0 0 14px rgba(255,179,0,0.08);
                transform: translateY(-1px);
            }
            .sb-type-btn.active .sb-type-letter {
                text-shadow: 0 0 14px rgba(255,179,0,0.8);
            }
            .sb-type-btn[data-type="U"].active {
                background: linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.06));
                border-color: #60A5FA;
                color: #93C5FD;
                box-shadow: 0 0 20px rgba(59,130,246,0.3), inset 0 0 14px rgba(59,130,246,0.08);
            }

            .sb-preview {
                position: relative;
                margin: 18px 0 10px;
                padding: 18px 16px 14px;
                border-radius: 18px;
                background:
                    radial-gradient(400px circle at 50% 0%, rgba(255,179,0,0.12), transparent 60%),
                    linear-gradient(165deg, rgba(30,41,59,0.85), rgba(11,15,26,0.98));
                border: 1.5px solid rgba(255,179,0,0.4);
                box-shadow:
                    0 0 30px rgba(255,179,0,0.15),
                    inset 0 1px 0 rgba(255,255,255,0.06);
                overflow: hidden;
                text-align: center;
            }
            .sb-preview::before {
                content: "";
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 2px;
                background: linear-gradient(90deg, transparent, #FFB300, #FFD54F, #FFB300, transparent);
                background-size: 200% 100%;
                animation: sbShimmer 3s linear infinite;
            }
            @keyframes sbShimmer {
                0%   { background-position: -200% 0; }
                100% { background-position:  200% 0; }
            }

            .sb-preview-label {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-family: 'Cairo', sans-serif;
                font-size: 10.5px;
                font-weight: 800;
                color: #FFD54F;
                letter-spacing: 0.8px;
                padding: 3px 12px;
                border-radius: 20px;
                background: rgba(255,179,0,0.10);
                border: 1px solid rgba(255,179,0,0.3);
                margin-bottom: 12px;
                text-transform: uppercase;
            }
            .sb-preview-label i {
                font-size: 10px;
                animation: sbEye 2s ease-in-out infinite;
            }
            @keyframes sbEye {
                0%,100% { transform: scale(1); opacity: 1; }
                50%     { transform: scale(1.15); opacity: 0.7; }
            }

            .sb-preview-value {
                font-family: 'Plus Jakarta Sans', 'Cairo', monospace;
                font-size: 26px;
                font-weight: 900;
                color: #fff;
                letter-spacing: 1.5px;
                direction: ltr;
                line-height: 1.2;
                word-break: break-all;
                text-shadow:
                    0 0 20px rgba(255,179,0,0.5),
                    0 2px 8px rgba(0,0,0,0.6);
                padding: 0 8px;
                transition: all 0.3s ease;
                min-height: 34px;
            }
            .sb-preview-value .pv-g { color: #FFD54F; }
            .sb-preview-value .pv-c { color: #60A5FA; }
            .sb-preview-value .pv-w { color: #34D399; }
            .sb-preview-value .pv-u { color: #A78BFA; }
            .sb-preview-value .pv-lab { color: #F472B6; }
            .sb-preview-value .pv-dash {
                color: rgba(255,255,255,0.3);
                font-size: 22px;
                padding: 0 2px;
            }

            .sb-manual-toggle-wrap {
                display: flex;
                justify-content: center;
                margin-top: 10px;
            }
            .sb-manual-toggle {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 7px 16px;
                border-radius: 12px;
                background: transparent;
                border: 1px dashed rgba(255,179,0,0.4);
                color: #FFB300;
                font-family: 'Cairo', sans-serif;
                font-size: 11.5px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.25s ease;
            }
            .sb-manual-toggle:hover {
                background: rgba(255,179,0,0.10);
                border-color: #FFB300;
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(255,179,0,0.15);
            }
            .sb-manual-toggle i { font-size: 11px; }

            .sb-manual-field {
                display: none;
                margin-top: 12px;
                animation: sbFadeIn 0.3s ease;
            }
            .sb-manual-field.active { display: block; }
            @keyframes sbFadeIn {
                from { opacity: 0; transform: translateY(-8px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .sb-manual-input {
                width: 100%;
                padding: 14px 16px;
                border-radius: 12px;
                background: rgba(0,0,0,0.55);
                border: 1.5px solid rgba(255,179,0,0.4);
                color: #FFD54F;
                font-family: 'Plus Jakarta Sans', monospace;
                font-size: 15px;
                font-weight: 800;
                text-align: center;
                letter-spacing: 1px;
                outline: none;
                transition: all 0.25s ease;
            }
            .sb-manual-input:focus {
                border-color: #FFB300;
                background: rgba(0,0,0,0.75);
                box-shadow: 0 0 22px rgba(255,179,0,0.3);
                transform: translateY(-1px);
            }
            .sb-manual-input::placeholder {
                color: #6b7385;
                font-weight: 600;
                letter-spacing: 0.5px;
            }

            .sb-auto-section { display: block; }
            .sb-auto-section.hidden { display: none; }
        </style>

        <div class="sb-subject">
            <i class="fas fa-book"></i>
            <span>${subject.name}</span>
        </div>

        <div class="sb-auto-section" id="sb-auto-section">

            <div class="sb-row">
                <div class="sb-field">
                    <div class="sb-label">
                        <i class="fas fa-users"></i>
                        <span>Group</span>
                        <span class="sb-letter">G</span>
                    </div>
                    <div class="sb-counter">
                        <button type="button" onclick="sbAdjust('sb-group', -1)">−</button>
                        <input type="number" id="sb-group" value="${defaultGroup}" min="1" max="99">
                        <button type="button" onclick="sbAdjust('sb-group', 1)">+</button>
                    </div>
                </div>

                <div class="sb-field">
                    <div class="sb-label">
                        <i class="fas fa-layer-group"></i>
                        <span>Class</span>
                        <span class="sb-letter">C</span>
                    </div>
                    <div class="sb-counter">
                        <button type="button" onclick="sbAdjust('sb-class', -1)">−</button>
                        <input type="number" id="sb-class" value="${defaultClass}" min="1" max="99">
                        <button type="button" onclick="sbAdjust('sb-class', 1)">+</button>
                    </div>
                </div>
            </div>

            <div class="sb-row">
                <div class="sb-field">
                    <div class="sb-label">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>المكان</span>
                    </div>
                    <div class="sb-type-wrap">
                        <button type="button" class="sb-type-btn active" data-type="W" onclick="sbSetType('W')">
                            <span class="sb-type-letter">W</span>
                            <span class="sb-type-name">Waha</span>
                        </button>
                        <button type="button" class="sb-type-btn" data-type="U" onclick="sbSetType('U')">
                            <span class="sb-type-letter">U</span>
                            <span class="sb-type-name">University</span>
                        </button>
                    </div>
                </div>

                <div class="sb-field">
                    <div class="sb-label">
                        <i class="fas fa-flask"></i>
                        <span>LAB</span>
                        <span class="sb-letter">LAB</span>
                    </div>
                    <div class="sb-counter">
                        <button type="button" onclick="sbAdjust('sb-lab', -1)">−</button>
                        <input type="number" id="sb-lab" value="${defaultLab}" min="1" max="99">
                        <button type="button" onclick="sbAdjust('sb-lab', 1)">+</button>
                    </div>
                </div>
            </div>

            <div class="sb-preview">
                <div class="sb-preview-label">
                    <i class="fas fa-eye"></i>
                    <span>الاسم النهائي</span>
                </div>
                <div class="sb-preview-value" id="sb-preview-value">
                    G1-C1-W_LAB1
                </div>
            </div>

        </div>

        <div class="sb-manual-toggle-wrap">
            <button type="button" class="sb-manual-toggle" id="sb-manual-toggle" onclick="sbToggleManual()">
                <i class="fas fa-keyboard"></i>
                <span>أو اكتب الاسم يدوياً</span>
            </button>
        </div>

        <div class="sb-manual-field" id="sb-manual-field">
            <input type="text" id="sb-manual-input" class="sb-manual-input"
                   placeholder="مثلاً: W_LAB1 أو أي اسم"
                   oninput="sbUpdateManualPreview(this.value)">
        </div>
    `;

    window._sbState = {
        type: defaultType,
        manual: false
    };

    window.sbAdjust = function(id, delta) {
        const el = document.getElementById(id);
        if (!el) return;
        let v = parseInt(el.value, 10) || 1;
        v = Math.max(1, Math.min(99, v + delta));
        el.value = v;
        sbUpdatePreview();
    };

    window.sbSetType = function(type) {
        window._sbState.type = type;
        document.querySelectorAll('.sb-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        sbUpdatePreview();
    };

    window.sbToggleManual = function() {
        window._sbState.manual = !window._sbState.manual;

        const autoSection = document.getElementById('sb-auto-section');
        const manualField = document.getElementById('sb-manual-field');
        const toggleBtn = document.getElementById('sb-manual-toggle');

        if (window._sbState.manual) {
            autoSection.classList.add('hidden');
            manualField.classList.add('active');
            toggleBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>العودة للوضع التلقائي</span>';
            setTimeout(() => {
                const inp = document.getElementById('sb-manual-input');
                if (inp) inp.focus();
            }, 100);
        } else {
            autoSection.classList.remove('hidden');
            manualField.classList.remove('active');
            toggleBtn.innerHTML = '<i class="fas fa-keyboard"></i><span>أو اكتب الاسم يدوياً</span>';
            sbUpdatePreview();
        }
    };

    window.sbUpdateManualPreview = function(val) {
        const pv = document.getElementById('sb-preview-value');
        if (!pv) return;
        if (!val || !val.trim()) {
            pv.innerHTML = '<span style="opacity:0.4;">اكتب اسم السكشن...</span>';
        } else {
            pv.textContent = val.trim();
        }
    };

    window.sbUpdatePreview = function() {
        const g = document.getElementById('sb-group');
        const c = document.getElementById('sb-class');
        const l = document.getElementById('sb-lab');
        const pv = document.getElementById('sb-preview-value');
        if (!g || !c || !l || !pv) return;

        const gn = parseInt(g.value, 10) || 1;
        const cn = parseInt(c.value, 10) || 1;
        const ln = parseInt(l.value, 10) || 1;
        const t = window._sbState.type;

        pv.innerHTML = `
            <span class="pv-g">G${gn}</span><span class="pv-dash">-</span>
            <span class="pv-c">C${cn}</span><span class="pv-dash">-</span>
            <span class="${t === 'W' ? 'pv-w' : 'pv-u'}">${t}_</span><span class="pv-lab">LAB${ln}</span>
        `;
    };

    const { value: form } = await Swal.fire({
        ...swalDark,
        title: 'فتح سكشن جديد',
        width: 580,
        html: modalHtml,
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i> فتح السكشن',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#10B981',
        cancelButtonColor: '#374151',
        reverseButtons: true,
        focusConfirm: false,
        didOpen: () => {
            ['sb-group', 'sb-class', 'sb-lab'].forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener('input', sbUpdatePreview);
                    el.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); sbAdjust(id, 1); }
                        if (e.key === 'ArrowDown') { e.preventDefault(); sbAdjust(id, -1); }
                    });
                }
            });

            sbUpdatePreview();
        },
        preConfirm: () => {
            let finalTitle = '';

            if (window._sbState.manual) {
                const inp = document.getElementById('sb-manual-input');
                finalTitle = inp ? inp.value.trim() : '';
                if (!finalTitle) {
                    Swal.showValidationMessage('يرجى كتابة اسم السكشن!');
                    return false;
                }
            } else {
                const g = parseInt(document.getElementById('sb-group').value, 10) || 1;
                const c = parseInt(document.getElementById('sb-class').value, 10) || 1;
                const l = parseInt(document.getElementById('sb-lab').value, 10) || 1;
                const t = window._sbState.type;
                finalTitle = `G${g}-C${c}-${t}_LAB${l}`;
            }

            return {
                subject_id: subjectId,
                subject_name: subject.name,
                type: 'Section',
                title: finalTitle
            };
        }
    });

    if (form) await sendCreateSession(form);
}

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

/* =========================================================
   🔥 كارت الطالب
   ========================================================= */
function renderGlassStudentCards(records, sessionId) {
    const container = document.getElementById('sess-glass-cards-container');
    if(!records || records.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; background:rgba(30,41,59,0.5); border-radius:16px; border:1px dashed rgba(255,255,255,0.15);">
                <i class="fas fa-user-clock fa-2x" style="color:var(--text-muted); margin-bottom:10px;"></i>
                <h3 style="color:#fff; font-size:16px; margin:0;">لا توجد نتائج</h3>
            </div>`;
        return;
    }

    container.innerHTML = records.map(r => {
        const isManual = r.is_manual || (r.ip && r.ip.includes("ADMIN"));
        const scanType = r.scan_type || '';
        const entryClass = isManual ? 'manual-entry' : 'auto-entry';

        let entryIcon = '📷';
        let entryLabel = 'QR';
        let entryColor = '#10B981';
        if (isManual) { entryIcon = '✍️'; entryLabel = 'يدوي'; entryColor = '#F59E0B'; }
        else if (scanType === 'manual') { entryIcon = '⌨️'; entryLabel = 'كود'; entryColor = '#3B82F6'; }
        else if (scanType === 'qr') { entryIcon = '📷'; entryLabel = 'QR'; entryColor = '#10B981'; }

        let timeShort = r.timestamp || '';
        const m = timeShort.match(/(\d{1,2}:\d{2}):\d{2}\s*(AM|PM)/i);
        if (m) timeShort = m[1] + ' ' + m[2];

        const initial = (r.student_name || '?').trim().charAt(0).toUpperCase();

        return `
            <div class="glass-student-card ${entryClass}">
                <div class="gsc-avatar">${initial}</div>
                <div class="gsc-body">
                    <div class="gsc-name-row">
                        <span class="gsc-name" title="${r.student_name}">${r.student_name}</span>
                    </div>
                    <div class="gsc-meta-row">
                        <span class="gsc-chip gsc-chip-id">
                            <i class="fas fa-id-badge"></i> ${r.student_id}
                        </span>
                        <span class="gsc-chip" style="border-color: ${entryColor}55; color: ${entryColor}; background: ${entryColor}15;">
                            ${entryIcon} ${entryLabel}
                        </span>
                        <span class="gsc-chip gsc-chip-time">
                            <i class="far fa-clock"></i> ${timeShort}
                        </span>
                    </div>
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
   ✅ حذف سجل الحضور
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
                    <i class="fas fa-exclamation-triangle"></i> سيتم حذف الجلسات والسجلات
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
   ✅ توليد عناوين المحاضرات
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

/* =========================================================
   ✅ فتح محاضرة جديدة
   ========================================================= */
async function createSessionModal() {
    let subjectsToShow = allData.subjects;
    const isInsideSubject = currentSessionsFilter !== null;
    if (isInsideSubject) subjectsToShow = allData.subjects.filter(s => s.id === currentSessionsFilter);

    if (subjectsToShow.length === 0) return Swal.fire({...swalDark, icon:'warning', text:'لا توجد مواد!'});

    if (currentAdminRole === 'super_admin') return createSessionModalSuperAdmin(subjectsToShow, isInsideSubject);
    if (currentAdminRole === 'doctor') return createSessionModalDoctor(subjectsToShow, isInsideSubject);
    if (currentAdminRole === 'ta') return openNewSectionModal();
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
            <input id="sw-title" class="login-input" placeholder="عنوان الجلسة" value="${initialTitle}">
        `,
        didOpen: () => {
            const typeSel = document.getElementById('sw-type');
            const subSel = document.getElementById('sw-sub');
            const titleInput = document.getElementById('sw-title');

            const update = () => {
                const subId = subSel.value;
                const type = typeSel.value;
                if (type === 'Lecture') {
                    titleInput.value = generateLectureTitle(subId);
                } else {
                    titleInput.value = 'W_LAB1';
                }
            };
            typeSel.addEventListener('change', update);
            if (subSel && !isInsideSubject) subSel.addEventListener('change', update);
            update();
        },
        preConfirm: () => {
            const sel = document.getElementById('sw-sub');
            const type = document.getElementById('sw-type').value;
            const title = document.getElementById('sw-title').value.trim();
            if (!title) return Swal.showValidationMessage('يرجى إدخال عنوان الجلسة!');
            return {
                subject_id: sel.value,
                subject_name: sel.getAttribute('data-name'),
                type: type,
                title: title
            };
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
   ✅ إرسال إنشاء الجلسة
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
   ✅ TOGGLE SESSION
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
   ✅ DELETE SESSION
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

/* =========================================================
   ✅ عرض المواد
   ========================================================= */
function getSubjectsListHTML(allowedSubjects = [], subjectsList = null) {
    const subs = subjectsList || allData.subjects;

    if (subs.length === 0) {
        return `<div style="background:rgba(0,0,0,0.3); padding:24px; border-radius:14px; text-align:center; color:#9CA3AF; font-size:13px;">
            <i class="fas fa-inbox fa-2x" style="display:block; margin-bottom:10px; opacity:0.35;"></i>
            لا توجد مواد متاحة
        </div>`;
    }

    let html = `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding:0 4px; gap:10px;">
            <span style="color:#8b93a7; font-size:12px; font-weight:700; white-space:nowrap;">
                <i class="fas fa-book" style="color:#FFB300;"></i>
                المواد المتاحة: <b style="color:#fff;">${subs.length}</b>
            </span>
            <button type="button" onclick="toggleAllSubjectsInModal()" 
                style="background:transparent; border:1px solid rgba(255,179,0,0.35); color:#FFB300; padding:5px 12px; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; font-family:'Cairo',sans-serif; white-space:nowrap;">
                <i class="fas fa-check-double"></i> تحديد / إلغاء الكل
            </button>
        </div>
        <div class="subjects-list-container" style="display:flex; flex-direction:column; gap:8px; max-height:400px; overflow-y:auto; padding:4px;">
    `;

    subs.forEach(s => {
        const subId = s.id;
        const isSubjectChecked = allowedSubjects.includes(subId);

        html += `
            <div class="sub-block" data-sub-id="${subId}"
                 style="background:linear-gradient(145deg, rgba(20,26,40,0.92), rgba(11,15,26,0.96));
                        border:1px solid rgba(255,255,255,0.08);
                        border-radius:12px;
                        padding:12px 14px;
                        transition:all 0.25s ease;
                        position:relative;">
                <div class="sub-block-indicator" style="position:absolute; right:0; top:0; bottom:0; width:3px;
                    background:${isSubjectChecked ? 'linear-gradient(180deg, #FFB300, #FFD54F)' : 'transparent'};
                    border-radius:0 12px 12px 0;"></div>
                <label style="display:flex; align-items:center; gap:12px; cursor:pointer; margin:0;">
                    <input type="checkbox" class="sub-checkbox" value="${subId}" data-name="${s.name}" ${isSubjectChecked}
                           style="width:18px; height:18px; accent-color:#FFB300; cursor:pointer; flex-shrink:0; margin:0;">
                    <span class="sub-name-text">${s.name}</span>
                </label>
            </div>
        `;
    });

    html += `</div>`;

    html += `
        <div style="margin-top:12px; padding:10px 12px;
             background:rgba(6,182,212,0.06); border:1px solid rgba(6,182,212,0.2);
             border-radius:10px; display:flex; gap:8px;">
            <i class="fas fa-info-circle" style="color:#22d3ee; font-size:13px; margin-top:2px; flex-shrink:0;"></i>
            <p style="color:#8b93a7; font-size:11.5px; margin:0; line-height:1.6; text-align:right;">
                من هنا تختار <b style="color:#fff;">المواد فقط</b>.<br>
                المعيد سيقدر يفتح سكاشن بالاسم اللي هو عايزه في المواد دي.
            </p>
        </div>
    `;

    return html;
}

function toggleAllSubjectsInModal() {
    const checkboxes = document.querySelectorAll('.sub-checkbox');
    if (!checkboxes.length) return;

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allChecked;

        const block = cb.closest('.sub-block');
        if (!block) return;

        const indicator = block.querySelector('.sub-block-indicator');

        if (!allChecked) {
            if (indicator) {
                indicator.style.background = 'linear-gradient(180deg, #FFB300, #FFD54F)';
                indicator.style.boxShadow = '0 0 12px rgba(255,179,0,0.5)';
            }
        } else {
            if (indicator) {
                indicator.style.background = 'transparent';
                indicator.style.boxShadow = 'none';
            }
        }
    });
}

function bindStaffCheckboxes() {
    document.querySelectorAll('.sub-checkbox').forEach(subCb => {
        if (subCb.dataset.bound) return;
        subCb.dataset.bound = '1';
        subCb.addEventListener('change', () => {
            const block = subCb.closest('.sub-block');
            const indicator = block ? block.querySelector('.sub-block-indicator') : null;

            if (subCb.checked) {
                if (indicator) {
                    indicator.style.background = 'linear-gradient(180deg, #FFB300, #FFD54F)';
                    indicator.style.boxShadow = '0 0 12px rgba(255,179,0,0.5)';
                }
            } else {
                if (indicator) {
                    indicator.style.background = 'transparent';
                    indicator.style.boxShadow = 'none';
                }
            }
        });
    });
}

function collectSelectedSubjects() {
    const result = [];
    document.querySelectorAll('.sub-checkbox:checked').forEach(cb => result.push(cb.value));
    return result;
}

/* =========================================================
   ✅ renderStaff
   ========================================================= */
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
            <td>${allowedNames}</td>
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

/* =========================================================
   ✅ editStaffModal
   ========================================================= */
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
        ...swalDark, title: `تعديل صلاحيات (${member.name})`, width: 620,
        html: `
            ${nameAndRoleHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin: 12px 0 6px;">
                <i class="fas fa-book" style="color:#FFB300;"></i>
                المواد المصرح بها:
            </p>
            ${getSubjectsListHTML(member.allowed_subjects || [], subjectsToShow)}
        `,
        didOpen: () => bindStaffCheckboxes(),
        preConfirm: () => {
            const selSubs = collectSelectedSubjects();
            const result = {
                allowed_subjects: selSubs
            };
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
            body: JSON.stringify({
                action: 'edit_staff',
                target_username: username,
                staff: form
            })
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

/* =========================================================
   ✅ addStaff
   ========================================================= */
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
        ...swalDark, title: 'إضافة عضو جديد', width: 620,
        html: `
            <input id="st-name" class="login-input" placeholder="الاسم ثلاثي">
            <input id="st-user" class="login-input ltr-input" placeholder="Username">
            <input id="st-pass" class="login-input ltr-input" placeholder="Password">
            ${roleSelectHtml}
            <p style="text-align:right; font-size:12px; color:var(--text-muted); margin: 8px 0 6px;">
                <i class="fas fa-book" style="color:#FFB300;"></i>
                المواد المصرح بها:
            </p>
            ${getSubjectsListHTML([], subjectsForAdd)}
        `,
        didOpen: () => bindStaffCheckboxes(),
        preConfirm: () => {
            const selSubs = collectSelectedSubjects();
            const name = document.getElementById('st-name').value.trim();
            const username = document.getElementById('st-user').value.trim();
            const password = document.getElementById('st-pass').value.trim();
            let role = 'ta';
            if(document.getElementById('st-role')) role = document.getElementById('st-role').value;
            if(!name || !username || !password) return Swal.showValidationMessage('املأ البيانات!');
            return {
                name, username, password, role,
                allowed_subjects: selSubs
            };
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

/* =========================================================
   ✅ toggleStaffStatus
   ========================================================= */
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

/* =========================================================
   ✅ deleteStaff
   ========================================================= */
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

/* =========================================================
   ✅ changeMyPassword
   ========================================================= */
async function changeMyPassword() {
    const { value: pw } = await Swal.fire({
        ...swalDark, title: 'تغيير كلمة المرور',
        input: 'password', inputPlaceholder: 'كلمة المرور الجديدة (8 أحرف على الأقل)'
    });
    if(pw) {
        const res = await fetch('/api/admin-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change_my_password', new_password: pw })
        });
        const data = await res.json();
        if (data.status === 'success') {
            Swal.fire({...swalDark, icon:'success', title: 'تم التغيير!', timer: 1200, showConfirmButton: false});
            const saved = getSavedAdminCredentials();
            if (saved) saveAdminCredentials(saved.username, pw);
        } else {
            Swal.fire({...swalDark, icon: 'error', text: data.message || 'فشل التغيير'});
        }
    }
}

/* =========================================================
   ✅ wipeDatabase
   ========================================================= */
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
