# ============================================================
#  Nexus Attendance System · index.py (2026 Secure Edition)
# ============================================================
import os
import time
import hmac
import hashlib
import io
import csv
import random
import re
import urllib.parse
from datetime import datetime, timedelta
from collections import defaultdict
import pytz
from flask import Flask, render_template, request, jsonify, session, Response, redirect, make_response
from pymongo import MongoClient, UpdateOne
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# ============================================================
#  📁 Paths & App Config
# ============================================================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))

TEMPLATE_DIR = (
    os.path.join(PARENT_DIR, 'templates')
    if os.path.exists(os.path.join(PARENT_DIR, 'templates'))
    else os.path.join(BASE_DIR, 'templates')
)
STATIC_DIR = (
    os.path.join(PARENT_DIR, 'static')
    if os.path.exists(os.path.join(PARENT_DIR, 'static'))
    else os.path.join(BASE_DIR, 'static')
)

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR, static_url_path='/static')

# 🔥 منع الكاش نهائياً (server-side template cache + static files)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.jinja_env.auto_reload = True
app.jinja_env.cache = {}

# ---------- Secrets from ENV ----------
SECRET_KEY = os.environ.get("SECRET_KEY", "Nexus_Attendance_Super_Key_2026_Fixed_ChangeMe")
app.secret_key = SECRET_KEY
app.permanent_session_lifetime = timedelta(days=7)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    MAX_CONTENT_LENGTH=8 * 1024 * 1024,
)

# ---------- Rate Limiter ----------
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["3000 per day", "800 per hour"],
    storage_uri="memory://"
)


# ============================================================
#  🗄️ MongoDB Atlas
# ============================================================
_db_user = urllib.parse.quote_plus(os.environ.get('MONGO_USER', 'ahmedattia20041120_db_user'))
_db_pass = urllib.parse.quote_plus(os.environ.get('MONGO_PASS', 'wjXYBO8Pbj5GijfS'))
DEFAULT_MONGO_URI = (
    f"mongodb+srv://{_db_user}:{_db_pass}"
    "@cluster0.yimrrnh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
MONGO_URI = os.environ.get("MONGO_URI", DEFAULT_MONGO_URI)

try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000, tz_aware=False)
    db = client['nexus_attendance_system']
    client.admin.command('ping')
except Exception as _e:
    raise SystemExit(f"❌ فشل الاتصال بقاعدة البيانات: {_e}")

users_col = db['users']
subjects_col = db['subjects']
sessions_col = db['sessions']
attendance_col = db['attendance']
students_col = db['students']
classes_col = db['classes']


# ============================================================
#  🧱 Indexes
# ============================================================
def _safe_create_index(col, keys, **kwargs):
    try:
        col.create_index(keys, **kwargs)
    except Exception:
        pass

_safe_create_index(users_col, "username", unique=True)
_safe_create_index(students_col, "student_id", unique=True)
_safe_create_index(attendance_col, [("student_id", 1), ("session_id", 1)], unique=True)
_safe_create_index(sessions_col, "session_id", unique=True)
_safe_create_index(classes_col, [("subject_id", 1), ("class_number", 1)], unique=True)
_safe_create_index(classes_col, "class_id", unique=True)
_safe_create_index(sessions_col, "screen_secret", sparse=True)


# ============================================================
#  🔐 Admin Bootstrap
# ============================================================
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "Nexus_Admin_Core#2026")
ADMIN_PASSWORD_PLAIN = os.environ.get("ADMIN_PASSWORD", "Nx!99@bATU#xK82_Secured")

_existing_admin = users_col.find_one({"username": ADMIN_USERNAME})
if not _existing_admin:
    users_col.insert_one({
        "username": ADMIN_USERNAME,
        "role": "super_admin",
        "name": "الآدمن الرئيسي",
        "is_active": True,
        "password": generate_password_hash(ADMIN_PASSWORD_PLAIN),
        "created_at": datetime.utcnow()
    })


# ============================================================
#  🔑 Crypto Salts & Constants
# ============================================================
SECRET_SALT        = b"NEXUS_ATTENDANCE_CORE_SECRET_2026_PROD"
QR_SECRET_SALT     = b"NEXUS_QR_ATTENDANCE_SECRET_2026_PROD"
SCREEN_SALT        = b"NEXUS_SCREEN_PAIR_SALT_2026_PROD"

BASE32_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

MANUAL_STEP_INTERVAL = 10
QR_STEP_INTERVAL     = 3
MANUAL_GRACE_PERIOD  = 2.0

SCREEN_STEP_INTERVAL = 20
SCREEN_GRACE_PERIOD  = 2.0

_SAFE_ERROR_MSG = "حدث خطأ، حاول لاحقاً"

# 🆕 تخزين مؤقت للتوكنات (in-memory)
_screen_pending = {}


# ============================================================
#  🔢 Code generation / verification
# ============================================================
def _generate_code(secret_salt: bytes, step: int, session_id: str) -> str:
    key = secret_salt + session_id.encode('utf-8')
    digest = hmac.new(key, str(step).encode('utf-8'), hashlib.sha256).digest()
    num = int.from_bytes(digest[:5], 'big')
    code = ""
    for _ in range(6):
        code += BASE32_CHARS[num % len(BASE32_CHARS)]
        num //= len(BASE32_CHARS)
    return code


def get_step_code(step: int, session_id: str) -> str:
    return _generate_code(SECRET_SALT, step, session_id)


def get_qr_step_code(step: int, session_id: str) -> str:
    return _generate_code(QR_SECRET_SALT, step, session_id)


def _safe_eq(a: str, b: str) -> bool:
    try:
        return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))
    except Exception:
        return False


def verify_manual_code(user_code: str, session_id: str) -> bool:
    clean = (user_code or '').strip().upper()
    if not clean or len(clean) != 6:
        return False
    now = time.time()
    current_step = int(now // MANUAL_STEP_INTERVAL)
    if _safe_eq(clean, get_step_code(current_step, session_id)):
        return True
    elapsed = now - (current_step * MANUAL_STEP_INTERVAL)
    if elapsed < MANUAL_GRACE_PERIOD and _safe_eq(clean, get_step_code(current_step - 1, session_id)):
        return True
    return False


def verify_qr_code(user_code: str, session_id: str) -> bool:
    clean = (user_code or '').strip().upper()
    if not clean or len(clean) != 6:
        return False
    now = time.time()
    current_step = int(now // QR_STEP_INTERVAL)
    return _safe_eq(clean, get_qr_step_code(current_step, session_id))


# ============================================================
#  🖥️ Screen pairing code (8 digits, rotates every 20s)
# ============================================================
def generate_screen_secret() -> str:
    return ''.join(random.choices('0123456789abcdef', k=32))


def get_screen_code(secret: str, step: int) -> str:
    key = SCREEN_SALT + secret.encode('utf-8')
    digest = hmac.new(key, str(step).encode('utf-8'), hashlib.sha256).digest()
    num = int.from_bytes(digest[:8], 'big')
    code = ""
    for _ in range(8):
        code += str(num % 10)
        num //= 10
    return code


def verify_screen_code(user_code: str, secret: str) -> bool:
    clean = (user_code or '').strip()
    if not clean or len(clean) != 8 or not clean.isdigit():
        return False
    now = time.time()
    current_step = int(now // SCREEN_STEP_INTERVAL)
    if _safe_eq(clean, get_screen_code(secret, current_step)):
        return True
    elapsed = now - (current_step * SCREEN_STEP_INTERVAL)
    if elapsed < SCREEN_GRACE_PERIOD and _safe_eq(clean, get_screen_code(secret, current_step - 1)):
        return True
    return False


# ============================================================
#  🔁 Migration
# ============================================================
try:
    for sess in sessions_col.find({"screen_secret": {"$exists": False}}):
        sessions_col.update_one(
            {"_id": sess["_id"]},
            {"$set": {"screen_secret": generate_screen_secret()}}
        )
except Exception:
    pass


# ============================================================
#  🛡️ Security Headers + NO-CACHE
# ============================================================
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(self), microphone=(), geolocation=()'

    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, private, no-transform'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'

    return response


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"status": "error", "message": "تم تجاوز عدد المحاولات! انتظر قليلاً."}), 429


@app.errorhandler(413)
def too_large_handler(e):
    return jsonify({"status": "error", "message": "الملف كبير جداً"}), 413


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"status": "error", "message": _SAFE_ERROR_MSG}), 500


# ============================================================
#  🔒 Helpers
# ============================================================
def _clean_str(v, maxlen=200) -> str:
    s = str(v or '').strip()
    return s[:maxlen]


def _is_admin() -> bool:
    return 'admin' in session


def _cairo_now() -> str:
    return datetime.now(pytz.timezone('Africa/Cairo')).strftime("%Y-%m-%d %I:%M:%S %p")


def _client_ip() -> str:
    fwd = request.headers.get('x-forwarded-for', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.remote_addr or 'unknown'


# ============================================================
#  🎯 Routes — UI
# ============================================================
@app.route('/')
def student_ui():
    return render_template('index.html')


@app.route('/secure-auth-gateway-2026-x9v2-pl7q-a84m')
def admin_ui():
    return render_template('admin.html')


@app.route('/dis')
def display_screen():
    """
    شاشة العرض — بدون أي كاش نهائياً (server + browser)
    """
    try:
        app.jinja_env.cache = {}
    except Exception:
        pass

    display_path = os.path.join(TEMPLATE_DIR, 'display.html')
    try:
        with open(display_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except Exception:
        html_content = render_template('display.html')

    resp = make_response(html_content)

    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, private, no-transform, proxy-revalidate'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    resp.headers['Surrogate-Control'] = 'no-store'
    resp.headers['Vary'] = '*'
    resp.headers['Clear-Site-Data'] = '"cache"'
    resp.headers['Content-Type'] = 'text/html; charset=utf-8'

    return resp


@app.route('/logout-gateway-vip-x9v2-pL7q-2026')
def logout():
    session.clear()
    return redirect('/secure-auth-gateway-2026-x9v2-pl7q-a84m')


# ============================================================
#  🎓 Student Routes
# ============================================================
@app.route('/api/student-login', methods=['POST'])
@limiter.limit("30 per minute")
def student_login():
    data = request.get_json(force=True, silent=True) or {}
    s_name = _clean_str(data.get('student_name'), 100)
    s_id = _clean_str(data.get('student_id'), 20)
    year = _clean_str(data.get('year'), 40)
    dept = _clean_str(data.get('department', 'عام (IT)'), 60)
    class_number = _clean_str(data.get('class_number'), 6)

    if len(s_name) < 3:
        return jsonify({"status": "error", "message": "يرجى كتابة اسم الطالب بشكل صحيح!"}), 400
    if len(s_id) != 7 or not s_id.isdigit():
        return jsonify({"status": "error", "message": "كود الطالب يجب أن يتكون من 7 أرقام!"}), 400
    if not year:
        return jsonify({"status": "error", "message": "يرجى اختيار الفرقة الدراسية!"}), 400
    if not class_number or not class_number.isdigit():
        return jsonify({"status": "error", "message": "يرجى اختيار الفصل (Class)!"}), 400

    sub_query = {"year": year}
    if dept:
        sub_query["department"] = {"$in": [dept, "عام (IT)"]}
    subject_ids = [s['id'] for s in subjects_col.find(sub_query, {"id": 1, "_id": 0})]

    if subject_ids:
        exists = classes_col.find_one({
            "subject_id": {"$in": subject_ids},
            "class_number": int(class_number)
        })
        if not exists:
            return jsonify({"status": "error", "message": "هذا الفصل غير متاح لفرقتك/قسمك!"}), 400

    students_col.update_one(
        {"student_id": s_id},
        {"$set": {
            "student_id": s_id,
            "name": s_name,
            "email": f"{s_id}@batechu.com",
            "year": year,
            "department": dept,
            "class_number": class_number,
            "last_active": _cairo_now()
        }},
        upsert=True
    )

    return jsonify({
        "status": "success",
        "student": {
            "student_id": s_id, "name": s_name,
            "email": f"{s_id}@batechu.com",
            "year": year, "department": dept,
            "class_number": class_number
        }
    })


@app.route('/api/available-classes')
def available_classes():
    year = _clean_str(request.args.get('year'), 40)
    dept = _clean_str(request.args.get('dept'), 60)

    if not year:
        return jsonify({"status": "success", "classes": []})

    sub_query = {"year": year}
    if dept:
        sub_query["department"] = {"$in": [dept, "عام (IT)"]}

    subject_ids = [s['id'] for s in subjects_col.find(sub_query, {"id": 1, "_id": 0})]

    if not subject_ids:
        return jsonify({"status": "success", "classes": []})

    raw = classes_col.distinct("class_number", {"subject_id": {"$in": subject_ids}})
    nums = sorted({int(c) for c in raw if str(c).isdigit()})

    return jsonify({"status": "success", "classes": nums})


@app.route('/api/student-init')
def student_init():
    year = _clean_str(request.args.get('year'), 40)
    dept = _clean_str(request.args.get('dept'), 60)
    s_id = _clean_str(request.args.get('student_id'), 20)

    query = {}
    if year:
        query["year"] = year
        if dept:
            query["department"] = {"$in": [dept, "عام (IT)"]}

    subs = list(subjects_col.find(query, {"_id": 0}))

    student = students_col.find_one({"student_id": s_id}) if s_id else None
    student_class = str(student.get('class_number', '')) if student else ''

    subject_ids = [s['id'] for s in subs]

    all_sessions = list(sessions_col.find({"is_open": True}, {"_id": 0, "screen_secret": 0}))
    filtered = []
    for s in all_sessions:
        if s.get('subject_id') not in subject_ids:
            continue
        if s.get('type') == 'Lecture':
            filtered.append(s)
            continue
        if s.get('type') == 'Section':
            if student_class and str(s.get('class_number', '')) == student_class:
                filtered.append(s)

    return jsonify({
        "status": "success",
        "subjects": subs,
        "sessions": filtered,
        "student_class": student_class
    })


@app.route('/api/student-history', methods=['POST'])
@limiter.limit("60 per minute")
def student_history():
    data = request.get_json(force=True, silent=True) or {}
    s_id = _clean_str(data.get('student_id'), 20)
    if len(s_id) != 7 or not s_id.isdigit():
        return jsonify({"status": "error", "message": "ID غير صحيح"}), 400
    records = list(attendance_col.find({"student_id": s_id}, {"_id": 0}).sort("timestamp", -1).limit(200))
    return jsonify({"status": "success", "history": records})


@app.route('/api/submit-attendance', methods=['POST'])
@limiter.limit("40 per minute")
def submit_attendance():
    data = request.get_json(force=True, silent=True) or {}
    s_id = _clean_str(data.get('student_id'), 20)
    s_name = _clean_str(data.get('student_name'), 100)
    session_id = _clean_str(data.get('session_id'), 64)
    code = _clean_str(data.get('code'), 12).upper()
    device_token = _clean_str(data.get('device_token'), 100)
    scan_type = _clean_str(data.get('scan_type', 'manual'), 20).lower()

    if len(s_id) != 7 or not s_id.isdigit():
        return jsonify({"status": "error", "message": "رقم الـ ID غير صحيح!"}), 400

    sess = sessions_col.find_one({"session_id": session_id, "is_open": True})
    if not sess:
        return jsonify({"status": "error", "message": "عفواً، هذه الجلسة مغلقة حالياً أو انتهت!"}), 400

    if sess.get('type') == 'Section':
        st = students_col.find_one({"student_id": s_id})
        st_class = str(st.get('class_number', '')) if st else ''
        if st_class and str(sess.get('class_number', '')) != st_class:
            return jsonify({"status": "error", "message": "هذه الجلسة ليست لفصلك!"}), 403

    if scan_type == 'qr':
        is_valid = verify_qr_code(code, session_id)
    else:
        is_valid = verify_manual_code(code, session_id)

    if not is_valid:
        if scan_type == 'qr':
            return jsonify({"status": "error", "message": "كود QR انتهت صلاحيته!"}), 400
        return jsonify({"status": "error", "message": "الرمز السري غير صحيح أو انتهت صلاحيته!"}), 400

    if device_token:
        dup_dev = attendance_col.find_one({"session_id": session_id, "device_token": device_token})
        if dup_dev and dup_dev.get('student_id') != s_id:
            return jsonify({"status": "error", "message": "ممنوع الغش! تم تسجيل حضور طالب آخر من هذا الجهاز."}), 403

    if attendance_col.find_one({"student_id": s_id, "session_id": session_id}):
        return jsonify({"status": "error", "message": "لقد قمت بتسجيل الحضور مسبقاً!"}), 409

    st_record = students_col.find_one({"student_id": s_id})
    year = st_record.get('year', '') if st_record else ''
    dept = st_record.get('department', '') if st_record else ''

    attendance_col.insert_one({
        "student_id": s_id,
        "student_name": s_name,
        "year": year,
        "department": dept,
        "subject_id": sess['subject_id'],
        "subject_name": sess['subject_name'],
        "session_id": session_id,
        "session_title": sess['title'],
        "session_type": sess.get('type', 'Lecture'),
        "class_number": sess.get('class_number', ''),
        "timestamp": _cairo_now(),
        "device_token": device_token,
        "ip": _client_ip(),
        "is_manual": False,
        "scan_type": scan_type
    })

    return jsonify({"status": "success", "message": f"تم تأكيد حضورك في ({sess['subject_name']} - {sess['title']})"})


# ============================================================
#  🔑 Admin Auth
# ============================================================
@app.route('/api/admin-login', methods=['POST'])
@limiter.limit("15 per minute")
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    username = _clean_str(data.get('username'), 100)
    password = str(data.get('password', ''))[:300]

    if not username or not password:
        return jsonify({"status": "error", "message": "بيانات ناقصة"}), 400

    user = users_col.find_one({"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}})
    if user:
        if user.get('is_active', True) is False:
            return jsonify({"status": "error", "message": "هذا الحساب موقوف حالياً."}), 403

        stored_hash = user.get('password', '')
        ok = False
        try:
            ok = check_password_hash(stored_hash, password)
        except Exception:
            ok = False

        if ok:
            session.permanent = True
            session['admin'] = {
                "username": user['username'],
                "name": user.get('name', user['username']),
                "role": user.get('role', 'doctor'),
                "allowed_subjects": user.get('allowed_subjects', []),
                "allowed_classes": user.get('allowed_classes', [])
            }
            return jsonify({"status": "success", "admin": session['admin']})

    return jsonify({"status": "error", "message": "اسم المستخدم أو كلمة المرور غير صحيحة!"}), 401


@app.route('/api/admin-data')
def get_admin_data():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    role = session['admin']['role']
    curr_username = session['admin']['username']
    curr_admin = users_col.find_one({"username": curr_username})
    allowed_subs = curr_admin.get('allowed_subjects', []) if curr_admin else []
    allowed_classes = curr_admin.get('allowed_classes', []) if curr_admin else []

    classes_list = []
    subjects = []
    sessions_list = []
    staff_list = []

    if role == 'super_admin':
        subjects = list(subjects_col.find({}, {"_id": 0}))
        sessions_list = list(sessions_col.find(
            {}, {"_id": 0, "screen_secret": 0}
        ).sort("created_at", -1))
        staff_list = list(users_col.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password": 0}))
        classes_list = list(classes_col.find({}, {"_id": 0}).sort([("subject_id", 1), ("class_number", 1)]))

    elif role == 'doctor':
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        sessions_list = list(sessions_col.find(
            {"subject_id": {"$in": allowed_subs}},
            {"_id": 0, "screen_secret": 0}
        ).sort("created_at", -1))
        classes_list = list(classes_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0})
                            .sort([("subject_id", 1), ("class_number", 1)]))

        all_tas = list(users_col.find({"role": "ta"}, {"_id": 0, "password": 0}))
        filtered = []
        for ta in all_tas:
            ta_subs = ta.get('allowed_subjects', [])
            has_common = any(s in allowed_subs for s in ta_subs)
            created_by_him = (ta.get('created_by') == curr_username)
            if has_common or created_by_him:
                ta['allowed_subjects'] = [s for s in ta_subs if s in allowed_subs]
                ta['allowed_classes'] = [c for c in ta.get('allowed_classes', [])
                                         if c.split('|')[0] in allowed_subs]
                filtered.append(ta)
        staff_list = filtered

    elif role == 'ta':
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        sessions_list = list(sessions_col.find({
            "subject_id": {"$in": allowed_subs},
            "type": "Section",
            "created_by_username": curr_username
        }, {"_id": 0, "screen_secret": 0}).sort("created_at", -1))

        allowed_pairs = []
        for item in allowed_classes:
            parts = item.split('|')
            if len(parts) == 2:
                sub_id = parts[0]
                try:
                    cls_num_int = int((parts[1] or '').replace('Class', ''))
                    allowed_pairs.append({"subject_id": sub_id, "class_number": cls_num_int})
                except Exception:
                    pass

        if allowed_pairs:
            classes_list = list(classes_col.find({"$or": allowed_pairs}, {"_id": 0}))

        staff_list = []

    return jsonify({
        "status": "success",
        "currentAdmin": {
            "username": session['admin']['username'],
            "name": session['admin']['name'],
            "role": session['admin']['role'],
            "allowed_subjects": allowed_subs,
            "allowed_classes": allowed_classes
        },
        "subjects": subjects,
        "sessions": sessions_list,
        "staff": staff_list,
        "classes": classes_list
    })


@app.route('/api/session-attendance')
def get_session_attendance():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    sess_id = _clean_str(request.args.get('session_id'), 64)
    sess = sessions_col.find_one({"session_id": sess_id}, {"_id": 0, "screen_secret": 0})
    if not sess:
        return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

    role = session['admin']['role']
    if role == 'ta':
        curr_admin = users_col.find_one({"username": session['admin']['username']})
        allowed_classes = curr_admin.get('allowed_classes', [])
        key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
        if key not in allowed_classes or sess.get('type') != 'Section':
            return jsonify({"status": "error", "message": "غير مصرح"}), 403

    records = list(attendance_col.find({"session_id": sess_id}, {"_id": 0})
                   .sort("timestamp", -1).limit(1000))
    return jsonify({"status": "success", "session": sess, "records": records})


@app.route('/api/class-tas')
def get_class_tas():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    class_id = _clean_str(request.args.get('class_id'), 64)
    cls = classes_col.find_one({"class_id": class_id}, {"_id": 0})
    if not cls:
        return jsonify({"status": "error", "message": "الفصل غير موجود!"}), 404

    role = session['admin']['role']
    if role == 'doctor':
        curr_admin = users_col.find_one({"username": session['admin']['username']})
        if cls.get('subject_id') not in curr_admin.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح"}), 403

    class_key = f"{cls['subject_id']}|Class{cls['class_number']}"

    all_sessions = list(sessions_col.find({
        "subject_id": cls['subject_id'],
        "class_number": str(cls['class_number']),
        "type": "Section"
    }, {"_id": 0, "screen_secret": 0}).sort("created_at", -1))

    session_ids = [s['session_id'] for s in all_sessions]
    counts_map = {}
    if session_ids:
        pipeline = [
            {"$match": {"session_id": {"$in": session_ids}}},
            {"$group": {"_id": "$session_id", "count": {"$sum": 1}}}
        ]
        counts_map = {d['_id']: d['count'] for d in attendance_col.aggregate(pipeline)}

    sessions_by_ta = defaultdict(list)
    for s in all_sessions:
        s['attendance_count'] = counts_map.get(s['session_id'], 0)
        sessions_by_ta[s.get('created_by_username')].append(s)

    all_tas = list(users_col.find({"role": "ta"}, {"_id": 0, "password": 0}))
    assigned_tas = []
    for ta in all_tas:
        if class_key in (ta.get('allowed_classes') or []):
            ta['class_sessions'] = sessions_by_ta.get(ta['username'], [])
            assigned_tas.append(ta)

    return jsonify({"status": "success", "class": cls, "tas": assigned_tas})


# ============================================================
#  🎬 Live Codes (broadcast / QR)
# ============================================================
@app.route('/api/live-code')
def get_live_code():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    session_id = _clean_str(request.args.get('session_id'), 64)
    if not session_id:
        return jsonify({"status": "error", "message": "missing"}), 400

    if not _can_access_session(session['admin'], session_id):
        return jsonify({"status": "unauthorized"}), 403

    now = time.time()

    m_step = int(now // MANUAL_STEP_INTERVAL)
    m_remaining = MANUAL_STEP_INTERVAL - (now - (m_step * MANUAL_STEP_INTERVAL))
    manual_code = get_step_code(m_step, session_id)

    q_step = int(now // QR_STEP_INTERVAL)
    q_remaining = QR_STEP_INTERVAL - (now - (q_step * QR_STEP_INTERVAL))
    qr_code = get_qr_step_code(q_step, session_id)

    return jsonify({
        "manual_code": manual_code,
        "manual_remaining": m_remaining,
        "manual_interval": MANUAL_STEP_INTERVAL,
        "qr_code": qr_code,
        "qr_remaining": q_remaining,
        "qr_interval": QR_STEP_INTERVAL,
        "code": manual_code,
        "remaining": m_remaining,
        "interval": MANUAL_STEP_INTERVAL
    })


def _can_access_session(admin: dict, session_id: str) -> bool:
    sess = sessions_col.find_one({"session_id": session_id}, {"subject_id": 1, "type": 1, "class_number": 1, "created_by_username": 1})
    if not sess:
        return False
    role = admin.get('role')
    if role == 'super_admin':
        return True
    curr = users_col.find_one({"username": admin.get('username')})
    if not curr:
        return False
    subs = curr.get('allowed_subjects', [])
    if sess.get('subject_id') not in subs:
        return False
    if role == 'doctor':
        return sess.get('type') == 'Lecture'
    if role == 'ta':
        key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
        return (sess.get('type') == 'Section'
                and key in (curr.get('allowed_classes') or [])
                and sess.get('created_by_username') == curr.get('username'))
    return False


# ============================================================
#  🖥️ Screen Code — للآدمن (بيتعرض في البوب أب)
# ============================================================
@app.route('/api/session-screen-code')
@limiter.limit("120 per minute")
def session_screen_code():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    session_id = _clean_str(request.args.get('session_id'), 64)
    if not session_id:
        return jsonify({"status": "error", "message": "missing session_id"}), 400

    if not _can_access_session(session['admin'], session_id):
        return jsonify({"status": "unauthorized"}), 403

    sess = sessions_col.find_one({"session_id": session_id})
    if not sess:
        return jsonify({"status": "error", "message": "not found"}), 404

    secret = sess.get('screen_secret')
    if not secret:
        secret = generate_screen_secret()
        sessions_col.update_one({"session_id": session_id}, {"$set": {"screen_secret": secret}})

    now = time.time()
    step = int(now // SCREEN_STEP_INTERVAL)
    remaining = SCREEN_STEP_INTERVAL - (now - (step * SCREEN_STEP_INTERVAL))
    code = get_screen_code(secret, step)

    return jsonify({
        "status": "success",
        "code": code,
        "remaining": remaining,
        "interval": SCREEN_STEP_INTERVAL
    })


# ============================================================
#  🆕 Screen Pairing via QR Token — NEW FLOW
# ============================================================
@app.route('/api/screen-new-token', methods=['POST'])
@limiter.limit("60 per minute")
def screen_new_token():
    """
    الشاشة بتطلب توكن جديد كل دقيقة → تعرضه كـ QR
    """
    token = 'SCR_' + ''.join(random.choices('0123456789abcdef', k=16))

    _screen_pending[token] = {
        'created': time.time(),
        'session_id': None,
        'secret': None,
        'session_info': None
    }

    # تنظيف التوكنات القديمة (أكثر من 10 دقائق)
    cutoff = time.time() - 600
    for k in list(_screen_pending.keys()):
        if _screen_pending[k].get('created', 0) < cutoff:
            del _screen_pending[k]

    return jsonify({"status": "success", "token": token})


@app.route('/api/screen-check-pair')
@limiter.limit("600 per minute")
def screen_check_pair():
    """
    الشاشة بتسأل: هل اتربطت بجلسة؟
    """
    token = _clean_str(request.args.get('token'), 80)
    if not token or token not in _screen_pending:
        return jsonify({"status": "expired"})

    data = _screen_pending[token]

    if data.get('session_id'):
        return jsonify({
            "status": "paired",
            "session_id": data['session_id'],
            "screen_secret": data['secret'],
            "session_info": data['session_info']
        })

    return jsonify({"status": "waiting"})


@app.route('/api/screen-pair-token', methods=['POST'])
@limiter.limit("30 per minute")
def screen_pair_token():
    """
    التعيد بيبعت التوكن + الجلسة → السيرفر يربطهم
    """
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    data = request.get_json(force=True, silent=True) or {}
    token = _clean_str(data.get('token'), 80)
    session_id = _clean_str(data.get('session_id'), 64)

    if token not in _screen_pending:
        return jsonify({
            "status": "error",
            "message": "QR الشاشة انتهت صلاحيته — اعمل refresh للشاشة"
        }), 400

    if not _can_access_session(session['admin'], session_id):
        return jsonify({"status": "error", "message": "غير مصرح"}), 403

    sess = sessions_col.find_one({"session_id": session_id, "is_open": True})
    if not sess:
        return jsonify({
            "status": "error",
            "message": "الجلسة غير موجودة أو مغلقة"
        }), 404

    secret = sess.get('screen_secret')
    if not secret:
        secret = generate_screen_secret()
        sessions_col.update_one(
            {"session_id": session_id},
            {"$set": {"screen_secret": secret}}
        )

    _screen_pending[token]['session_id'] = session_id
    _screen_pending[token]['secret'] = secret
    _screen_pending[token]['session_info'] = {
        "subject_name": sess.get('subject_name', ''),
        "title": sess.get('title', ''),
        "type": sess.get('type', 'Lecture'),
        "class_number": sess.get('class_number', '')
    }

    return jsonify({"status": "success", "message": "تم ربط الشاشة بالجلسة!"})


# ============================================================
#  🖥️ Screen Pairing — الكود اليدوي (Legacy Fallback)
# ============================================================
@app.route('/api/screen-pair', methods=['POST'])
@limiter.limit("20 per minute")
def screen_pair():
    data = request.get_json(force=True, silent=True) or {}
    code = _clean_str(data.get('screen_code'), 12)

    if len(code) != 8 or not code.isdigit():
        return jsonify({"status": "error", "message": "كود الشاشة يجب أن يكون 8 أرقام"}), 400

    open_sessions = list(sessions_col.find({"is_open": True}, {"_id": 0}))
    for sess in open_sessions:
        secret = sess.get('screen_secret')
        if not secret:
            continue
        if verify_screen_code(code, secret):
            return jsonify({
                "status": "success",
                "screen_secret": secret,
                "session": {
                    "session_id": sess['session_id'],
                    "subject_name": sess.get('subject_name', ''),
                    "title": sess.get('title', ''),
                    "type": sess.get('type', 'Lecture'),
                    "class_number": sess.get('class_number', ''),
                    "created_by": sess.get('created_by', '')
                }
            })

    return jsonify({"status": "error", "message": "الكود انتهت صلاحيته أو غير صحيح — اطلب الكود الجديد"}), 404


# ============================================================
#  🖥️ Screen Live Code
# ============================================================
@app.route('/api/screen-live-code')
@limiter.limit("300 per minute")
def screen_live_code():
    secret = _clean_str(request.args.get('secret'), 80)
    legacy_code = _clean_str(request.args.get('screen_code'), 12)

    sess = None

    if secret and len(secret) >= 16:
        sess = sessions_col.find_one({"screen_secret": secret}, {"_id": 0})
    elif legacy_code and len(legacy_code) == 8 and legacy_code.isdigit():
        open_sessions = list(sessions_col.find({"is_open": True}, {"_id": 0}))
        for s in open_sessions:
            sc = s.get('screen_secret')
            if sc and verify_screen_code(legacy_code, sc):
                sess = s
                break

        if not sess:
            return jsonify({"status": "closed", "message": "انتهت صلاحية الكود — اطلب كود جديد"})
    else:
        return jsonify({"status": "error", "message": "invalid"}), 400

    if not sess:
        return jsonify({"status": "closed", "message": "الجلسة انتهت"})

    if not sess.get('is_open'):
        return jsonify({
            "status": "closed",
            "message": "الجلسة مغلقة الآن",
            "session_info": {
                "subject_name": sess.get('subject_name', ''),
                "title": sess.get('title', ''),
                "type": sess.get('type', 'Lecture'),
                "class_number": sess.get('class_number', '')
            }
        })

    session_id = sess['session_id']
    now = time.time()

    m_step = int(now // MANUAL_STEP_INTERVAL)
    m_remaining = MANUAL_STEP_INTERVAL - (now - (m_step * MANUAL_STEP_INTERVAL))
    manual_code = get_step_code(m_step, session_id)

    q_step = int(now // QR_STEP_INTERVAL)
    q_remaining = QR_STEP_INTERVAL - (now - (q_step * QR_STEP_INTERVAL))
    qr_code = get_qr_step_code(q_step, session_id)

    return jsonify({
        "status": "success",
        "session_info": {
            "subject_name": sess.get('subject_name', ''),
            "title": sess.get('title', ''),
            "type": sess.get('type', 'Lecture'),
            "class_number": sess.get('class_number', '')
        },
        "manual_code": manual_code,
        "manual_remaining": m_remaining,
        "manual_interval": MANUAL_STEP_INTERVAL,
        "qr_code": qr_code,
        "qr_remaining": q_remaining,
        "qr_interval": QR_STEP_INTERVAL
    })


# ============================================================
#  🛠️ Admin Actions
# ============================================================
@app.route('/api/admin-action', methods=['POST'])
@limiter.limit("300 per hour")
def admin_action():
    if not _is_admin():
        return jsonify({"status": "unauthorized"}), 401

    curr_user = users_col.find_one({"username": session['admin']['username']})
    role = session['admin']['role']
    curr = session['admin']
    data = request.get_json(force=True, silent=True) or {}
    action = _clean_str(data.get('action'), 60)

    # ---------- CHANGE MY PASSWORD ----------
    if action == 'change_my_password':
        new_pw = str(data.get('new_password', ''))
        if len(new_pw) < 8:
            return jsonify({"status": "error", "message": "كلمة المرور يجب أن تكون 8 أحرف على الأقل"}), 400
        users_col.update_one(
            {"username": curr['username']},
            {"$set": {"password": generate_password_hash(new_pw)}}
        )
        return jsonify({"status": "success"})

    # ---------- CREATE CLASS ----------
    elif action == 'create_class':
        sub_id = _clean_str(data.get('subject_id'), 60)
        try:
            class_num = int(data.get('class_number', 0))
        except Exception:
            class_num = 0

        if not sub_id or class_num < 1 or class_num > 100:
            return jsonify({"status": "error", "message": "بيانات ناقصة!"}), 400

        if role == 'super_admin':
            pass
        elif role == 'doctor':
            if sub_id not in curr_user.get('allowed_subjects', []):
                return jsonify({"status": "error", "message": "غير مصرح لك بهذه المادة!"}), 403
        else:
            return jsonify({"status": "error", "message": "المعيد لا يمكنه إنشاء فصول!"}), 403

        subject = subjects_col.find_one({"id": sub_id})
        if not subject:
            return jsonify({"status": "error", "message": "المادة غير موجودة!"}), 404

        existing = classes_col.find_one({"subject_id": sub_id, "class_number": class_num})
        if existing:
            return jsonify({"status": "error", "message": f"Class {class_num} موجود بالفعل!"}), 409

        class_id = f"CLS_{int(time.time() * 1000)}_{class_num}"
        classes_col.insert_one({
            "class_id": class_id,
            "subject_id": sub_id,
            "subject_name": subject.get('name', ''),
            "class_number": class_num,
            "created_by": curr['name'],
            "created_by_username": curr['username'],
            "created_at": _cairo_now()
        })
        return jsonify({
            "status": "success",
            "message": f"تم إنشاء Class {class_num}",
            "class_id": class_id,
            "class_number": class_num,
            "subject_id": sub_id,
            "subject_name": subject.get('name', '')
        })

    # ---------- DELETE CLASS ----------
    elif action == 'delete_class':
        class_id = _clean_str(data.get('class_id'), 64)
        if not class_id:
            return jsonify({"status": "error", "message": "بيانات ناقصة!"}), 400

        cls = classes_col.find_one({"class_id": class_id})
        if not cls:
            return jsonify({"status": "error", "message": "الفصل غير موجود!"}), 404

        if role == 'super_admin':
            pass
        elif role == 'doctor':
            if cls.get('subject_id') not in curr_user.get('allowed_subjects', []):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        else:
            return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        classes_col.delete_one({"class_id": class_id})

        key = f"{cls['subject_id']}|Class{cls['class_number']}"
        users_col.update_many(
            {"role": "ta", "allowed_classes": key},
            {"$pull": {"allowed_classes": key}}
        )

        return jsonify({"status": "success", "message": "تم حذف الفصل"})

    # ---------- ASSIGN CLASS TAs ----------
    elif action == 'assign_class_tas':
        class_id = _clean_str(data.get('class_id'), 64)
        ta_usernames = data.get('ta_usernames', [])

        if not class_id:
            return jsonify({"status": "error", "message": "بيانات ناقصة!"}), 400

        if not isinstance(ta_usernames, list):
            ta_usernames = []
        ta_usernames = [_clean_str(u, 100) for u in ta_usernames][:200]

        cls = classes_col.find_one({"class_id": class_id})
        if not cls:
            return jsonify({"status": "error", "message": "الفصل غير موجود!"}), 404

        if role == 'super_admin':
            pass
        elif role == 'doctor':
            if cls.get('subject_id') not in curr_user.get('allowed_subjects', []):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        else:
            return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        subject_id = cls['subject_id']
        class_number = cls['class_number']
        class_key = f"{subject_id}|Class{class_number}"
        target_set = set(ta_usernames)

        all_tas = list(users_col.find({"role": "ta"}))
        operations = []

        for ta in all_tas:
            ta_username = ta.get('username')
            current_classes = ta.get('allowed_classes', []) or []
            has_subject = subject_id in (ta.get('allowed_subjects') or [])
            should_have = has_subject and ta_username in target_set
            has_now = class_key in current_classes

            if should_have and not has_now:
                operations.append(UpdateOne(
                    {"username": ta_username},
                    {"$addToSet": {"allowed_classes": class_key}}
                ))
            elif not should_have and has_now:
                operations.append(UpdateOne(
                    {"username": ta_username},
                    {"$pull": {"allowed_classes": class_key}}
                ))

        if operations:
            users_col.bulk_write(operations, ordered=False)

        return jsonify({
            "status": "success",
            "message": f"تم التعيين ({len(target_set)} معيد)",
            "updated": len(operations)
        })

    # ---------- CREATE SESSION ----------
    elif action == 'create_session':
        s_data = data.get('session', {}) or {}
        sub_id = _clean_str(s_data.get('subject_id'), 60)
        session_type = _clean_str(s_data.get('type', 'Lecture'), 20)
        class_number = _clean_str(s_data.get('class_number'), 6)
        custom_title = _clean_str(s_data.get('title', ''), 100)
        subject_name = _clean_str(s_data.get('subject_name', ''), 200)

        if session_type not in ('Lecture', 'Section'):
            return jsonify({"status": "error", "message": "نوع الجلسة غير صحيح"}), 400

        if role == 'super_admin':
            pass
        elif role == 'doctor':
            if sub_id not in curr_user.get('allowed_subjects', []):
                return jsonify({"status": "error", "message": "غير مصرح لك بفتح جلسة في هذه المادة!"}), 403
            if session_type != 'Lecture':
                return jsonify({"status": "error", "message": "الدكتور يمكنه فتح محاضرات فقط!"}), 403
        elif role == 'ta':
            if session_type != 'Section':
                return jsonify({"status": "error", "message": "المعيد يمكنه فتح سكاشن فقط!"}), 403
            if not class_number:
                return jsonify({"status": "error", "message": "يجب تحديد الفصل!"}), 400
            key = f"{sub_id}|Class{class_number}"
            if key not in curr_user.get('allowed_classes', []):
                return jsonify({"status": "error", "message": f"غير مصرح لك بفتح جلسة في Class {class_number}!"}), 403
        else:
            return jsonify({"status": "error", "message": "غير مصرح"}), 403

        sess_id = f"SESS_{int(time.time() * 1000)}"
        new_session = {
            "session_id": sess_id,
            "subject_id": sub_id,
            "subject_name": subject_name,
            "type": session_type,
            "title": custom_title or 'عام',
            "is_open": True,
            "created_by": curr['name'],
            "created_by_username": curr['username'],
            "created_at": _cairo_now(),
            "screen_secret": generate_screen_secret(),
        }
        if session_type == 'Section':
            new_session['class_number'] = class_number

        sessions_col.insert_one(new_session)

        safe_session = {k: v for k, v in new_session.items() if k != 'screen_secret' and k != '_id'}
        return jsonify({"status": "success", "session": safe_session})

    # ---------- UPDATE SESSION TITLE ----------
    elif action == 'update_session_title':
        sess_id = _clean_str(data.get('session_id'), 64)
        new_title = _clean_str(data.get('new_title'), 100)

        if not sess_id or not new_title:
            return jsonify({"status": "error", "message": "بيانات ناقصة!"}), 400

        sess = sessions_col.find_one({"session_id": sess_id})
        if not sess:
            return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

        if role == 'doctor':
            if sess.get('subject_id') not in curr_user.get('allowed_subjects', []):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        elif role == 'ta':
            key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
            if key not in curr_user.get('allowed_classes', []):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        sessions_col.update_one({"session_id": sess_id}, {"$set": {"title": new_title}})
        return jsonify({"status": "success", "message": "تم تحديث العنوان"})

    # ---------- TOGGLE SESSION ----------
    elif action == 'toggle_session':
        sess_id = _clean_str(data.get('session_id'), 64)
        sess = sessions_col.find_one({"session_id": sess_id})
        if not sess:
            return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

        if role == 'doctor' and sess.get('subject_id') not in curr_user.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        if role == 'ta':
            key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
            if key not in curr_user.get('allowed_classes', []) or sess.get('type') != 'Section':
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        sessions_col.update_one({"session_id": sess_id}, {"$set": {"is_open": bool(data.get('is_open'))}})
        return jsonify({"status": "success"})

    # ---------- DELETE SESSION ----------
    elif action == 'delete_session':
        sess_id = _clean_str(data.get('session_id'), 64)
        sess = sessions_col.find_one({"session_id": sess_id})
        if not sess:
            return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

        if role == 'doctor' and sess.get('subject_id') not in curr_user.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        if role == 'ta':
            key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
            if key not in curr_user.get('allowed_classes', []) or sess.get('type') != 'Section':
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        sessions_col.delete_one({"session_id": sess_id})
        attendance_col.delete_many({"session_id": sess_id})
        return jsonify({"status": "success"})

    # ---------- ADD MANUAL ATTENDANCE ----------
    elif action == 'add_manual_attendance':
        sess_id = _clean_str(data.get('session_id'), 64)
        s_id = _clean_str(data.get('student_id'), 20)
        s_name = _clean_str(data.get('student_name'), 100)

        if len(s_id) != 7 or not s_id.isdigit():
            return jsonify({"status": "error", "message": "كود الطالب غير صحيح!"}), 400

        sess = sessions_col.find_one({"session_id": sess_id})
        if not sess:
            return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

        if role == 'ta':
            key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
            if key not in curr_user.get('allowed_classes', []) or sess.get('type') != 'Section':
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403

        if attendance_col.find_one({"student_id": s_id, "session_id": sess_id}):
            return jsonify({"status": "error", "message": "الطالب مسجل حضوره بالفعل!"}), 409

        st_record = students_col.find_one({"student_id": s_id})
        year = st_record.get('year', '') if st_record else ''
        dept = st_record.get('department', '') if st_record else ''

        record = {
            "student_id": s_id,
            "student_name": s_name,
            "year": year,
            "department": dept,
            "subject_id": sess['subject_id'],
            "subject_name": sess['subject_name'],
            "session_id": sess_id,
            "session_title": sess['title'],
            "session_type": sess.get('type', 'Lecture'),
            "class_number": sess.get('class_number', ''),
            "timestamp": _cairo_now(),
            "device_token": "MANUAL_BY_ADMIN",
            "ip": "ADMIN",
            "is_manual": True,
            "scan_type": "admin"
        }
        attendance_col.insert_one(record)
        record.pop('_id', None)
        return jsonify({"status": "success", "message": "تم تحضير الطالب يدوياً بنجاح!", "record": record})

    # ---------- EDIT ATTENDANCE ----------
    elif action == 'edit_attendance_record':
        sess_id = _clean_str(data.get('session_id'), 64)
        old_id = _clean_str(data.get('old_id'), 20)
        new_id = _clean_str(data.get('new_id'), 20)
        new_name = _clean_str(data.get('new_name'), 100)

        if len(new_id) != 7 or not new_id.isdigit():
            return jsonify({"status": "error", "message": "الكود الجديد غير صحيح"}), 400

        attendance_col.update_one(
            {"session_id": sess_id, "student_id": old_id},
            {"$set": {"student_id": new_id, "student_name": new_name}}
        )
        return jsonify({"status": "success"})

    # ---------- DELETE ATTENDANCE ----------
    elif action == 'delete_attendance_record':
        attendance_col.delete_one({
            "student_id": _clean_str(data.get('student_id'), 20),
            "session_id": _clean_str(data.get('session_id'), 64)
        })
        return jsonify({"status": "success"})

    # ---------- MANAGE SUBJECTS ----------
    elif action == 'manage_subject' and role == 'super_admin':
        sub_act = _clean_str(data.get('sub'), 20)
        if sub_act == 'add':
            s_obj = data.get('subject', {}) or {}
            sub_id = f"SUB_{int(time.time())}"
            subjects_col.insert_one({
                "id": sub_id,
                "name": _clean_str(s_obj.get('name', ''), 200),
                "year": _clean_str(s_obj.get('year', ''), 40),
                "department": _clean_str(s_obj.get('department', ''), 60),
                "image": str(s_obj.get('image', ''))[:500000],
                "added_by": curr['name']
            })
        elif sub_act == 'edit':
            sub_id = _clean_str(data.get('id', ''), 60)
            s_obj = data.get('subject', {}) or {}
            target = subjects_col.find_one({"id": sub_id})
            if not target:
                return jsonify({"status": "error", "message": "المادة غير موجودة!"}), 404

            new_name = _clean_str(s_obj.get('name', target.get('name', '')), 200)
            updates = {
                "name": new_name,
                "year": _clean_str(s_obj.get('year', target.get('year', '')), 40),
                "department": _clean_str(s_obj.get('department', target.get('department', '')), 60)
            }
            if s_obj.get('image'):
                updates['image'] = str(s_obj.get('image'))[:500000]

            subjects_col.update_one({"id": sub_id}, {"$set": updates})

            if new_name and new_name != target.get('name'):
                sessions_col.update_many({"subject_id": sub_id}, {"$set": {"subject_name": new_name}})
                attendance_col.update_many({"subject_id": sub_id}, {"$set": {"subject_name": new_name}})
                classes_col.update_many({"subject_id": sub_id}, {"$set": {"subject_name": new_name}})

        elif sub_act == 'delete':
            sub_id = _clean_str(data.get('id', ''), 60)
            subjects_col.delete_one({"id": sub_id})
            sessions_col.delete_many({"subject_id": sub_id})
            attendance_col.delete_many({"subject_id": sub_id})
            classes_col.delete_many({"subject_id": sub_id})

        return jsonify({"status": "success"})

    # ---------- MANAGE STAFF ----------
    elif action == 'manage_staff':
        if role == 'ta':
            return jsonify({"status": "error", "message": "المعيد ليس له صلاحية!"}), 403

        sub_act = _clean_str(data.get('sub', ''), 20)
        staff_data = data.get('staff', {}) or {}

        if sub_act == 'add':
            new_role = _clean_str(staff_data.get('role', 'ta'), 20)
            if new_role not in ('ta', 'doctor'):
                new_role = 'ta'

            allowed_subjects = staff_data.get('allowed_subjects', [])
            allowed_classes = staff_data.get('allowed_classes', [])
            if not isinstance(allowed_subjects, list):
                allowed_subjects = []
            if not isinstance(allowed_classes, list):
                allowed_classes = []
            allowed_subjects = [_clean_str(s, 60) for s in allowed_subjects][:200]
            allowed_classes = [_clean_str(c, 100) for c in allowed_classes][:500]

            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_user.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subjects):
                    return jsonify({"status": "error", "message": "لا يمكنك منح صلاحية في مادة لا تدرسها!"}), 403
                for cls_item in allowed_classes:
                    cls_sub = cls_item.split('|')[0]
                    if cls_sub not in my_subs:
                        return jsonify({"status": "error", "message": "فصل لا يتبع لموادك!"}), 403

            target_user = _clean_str(staff_data.get('username', ''), 100)
            password = str(staff_data.get('password', ''))
            name = _clean_str(staff_data.get('name', ''), 100)

            if not target_user or not password or not name:
                return jsonify({"status": "error", "message": "بيانات ناقصة"}), 400
            if len(password) < 6:
                return jsonify({"status": "error", "message": "كلمة المرور يجب أن تكون 6 أحرف على الأقل"}), 400

            if users_col.find_one({"username": target_user}):
                return jsonify({"status": "error", "message": "اسم المستخدم موجود مسبقاً!"}), 400

            users_col.insert_one({
                "name": name,
                "username": target_user,
                "password": generate_password_hash(password),
                "role": new_role,
                "allowed_subjects": allowed_subjects,
                "allowed_classes": allowed_classes,
                "is_active": True,
                "created_by": curr['username'],
                "created_at": datetime.utcnow()
            })

        elif sub_act == 'delete':
            target_username = _clean_str(data.get('username', ''), 100)
            if target_username == curr['username']:
                return jsonify({"status": "error", "message": "لا يمكنك حذف حسابك!"}), 403

            target = users_col.find_one({"username": target_username})
            if not target:
                return jsonify({"status": "error", "message": "العضو غير موجود!"}), 404

            if role == 'doctor':
                if target.get('role') != 'ta':
                    return jsonify({"status": "error", "message": "يمكنك حذف المعيدين فقط!"}), 403
                my_subs = curr_user.get('allowed_subjects', [])
                target_subs = target.get('allowed_subjects', [])
                has_common = any(s in my_subs for s in target_subs)
                created_by_him = (target.get('created_by') == curr['username'])
                if not (has_common or created_by_him):
                    return jsonify({"status": "error", "message": "غير مصرح!"}), 403

            users_col.delete_one({"username": target_username})

        elif sub_act == 'edit':
            target_username = _clean_str(data.get('old_username', ''), 100)
            target = users_col.find_one({"username": target_username})
            if not target:
                return jsonify({"status": "error", "message": "العضو غير موجود!"}), 404

            new_subjects = staff_data.get('allowed_subjects', [])
            new_classes = staff_data.get('allowed_classes', [])
            if not isinstance(new_subjects, list):
                new_subjects = []
            if not isinstance(new_classes, list):
                new_classes = []
            new_subjects = [_clean_str(s, 60) for s in new_subjects][:200]
            new_classes = [_clean_str(c, 100) for c in new_classes][:500]

            if role == 'super_admin':
                users_col.update_one(
                    {"username": target_username},
                    {"$set": {"allowed_subjects": new_subjects, "allowed_classes": new_classes}}
                )
            elif role == 'doctor':
                if target.get('role') != 'ta':
                    return jsonify({"status": "error", "message": "يمكنك تعديل المعيدين فقط!"}), 403
                my_subs = curr_user.get('allowed_subjects', [])
                if not all(s in my_subs for s in new_subjects):
                    return jsonify({"status": "error", "message": "يمكنك تعديل المواد التي تدرسها فقط!"}), 403

                target_subs = target.get('allowed_subjects', [])
                target_classes = target.get('allowed_classes', [])
                other_subs = [s for s in target_subs if s not in my_subs]
                other_classes = [c for c in target_classes if c.split('|')[0] not in my_subs]

                final_subs = list(set(other_subs + new_subjects))
                final_classes = list(set(other_classes + new_classes))

                users_col.update_one(
                    {"username": target_username},
                    {"$set": {"allowed_subjects": final_subs, "allowed_classes": final_classes}}
                )
            else:
                return jsonify({"status": "error", "message": "غير مصرح"}), 403

        return jsonify({"status": "success"})

    # ---------- EDIT STAFF (preserve_classes) ----------
    elif action == 'edit_staff':
        target_username = _clean_str(data.get('target_username', ''), 100)
        if not target_username:
            return jsonify({"status": "error", "message": "بيانات ناقصة"}), 400

        target = users_col.find_one({"username": target_username})
        if not target:
            return jsonify({"status": "error", "message": "العضو غير موجود!"}), 404

        if target_username == curr['username']:
            return jsonify({"status": "error", "message": "لا يمكنك تعديل حسابك!"}), 403

        staff_data = data.get('staff', {}) or {}
        preserve_classes = bool(data.get('preserve_classes', False))
        updates = {}

        if role == 'super_admin':
            new_name = _clean_str(staff_data.get('name', target.get('name', '')), 100)
            new_role = _clean_str(staff_data.get('role', target.get('role', 'ta')), 20)
            new_subs = staff_data.get('allowed_subjects', target.get('allowed_subjects', []))
            if not isinstance(new_subs, list):
                new_subs = []
            new_subs = [_clean_str(s, 60) for s in new_subs][:200]

            if new_name:
                updates['name'] = new_name
            if new_role in ('doctor', 'ta'):
                updates['role'] = new_role
            updates['allowed_subjects'] = new_subs

            if not preserve_classes:
                nc = staff_data.get('allowed_classes', target.get('allowed_classes', []))
                if not isinstance(nc, list):
                    nc = []
                updates['allowed_classes'] = [_clean_str(c, 100) for c in nc][:500]

        elif role == 'doctor':
            if target.get('role') != 'ta':
                return jsonify({"status": "error", "message": "يمكنك تعديل المعيدين فقط!"}), 403

            my_subs = curr_user.get('allowed_subjects', [])
            target_subs = target.get('allowed_subjects', [])
            has_common = any(s in my_subs for s in target_subs)
            created_by_him = (target.get('created_by') == curr['username'])
            if not (has_common or created_by_him):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403

            new_subs = staff_data.get('allowed_subjects', [])
            if not isinstance(new_subs, list):
                new_subs = []
            new_subs = [_clean_str(s, 60) for s in new_subs][:200]

            if not all(s in my_subs for s in new_subs):
                return jsonify({"status": "error", "message": "يمكنك تعديل المواد التي تدرسها فقط!"}), 403

            target_classes = target.get('allowed_classes', [])
            other_subs = [s for s in target_subs if s not in my_subs]
            other_classes = [c for c in target_classes if c.split('|')[0] not in my_subs]

            updates['allowed_subjects'] = list(set(other_subs + new_subs))

            if not preserve_classes:
                nc = staff_data.get('allowed_classes', [])
                if not isinstance(nc, list):
                    nc = []
                nc = [_clean_str(c, 100) for c in nc][:500]
                updates['allowed_classes'] = list(set(other_classes + nc))

        else:
            return jsonify({"status": "error", "message": "غير مصرح"}), 403

        if updates:
            users_col.update_one({"username": target_username}, {"$set": updates})

        return jsonify({"status": "success", "message": "تم التحديث"})

    # ---------- TOGGLE STAFF STATUS ----------
    elif action == 'toggle_staff_status':
        target_username = _clean_str(data.get('target_username', ''), 100)
        if not target_username:
            return jsonify({"status": "error", "message": "بيانات ناقصة"}), 400

        target = users_col.find_one({"username": target_username})
        if not target:
            return jsonify({"status": "error", "message": "العضو غير موجود!"}), 404

        if target_username == curr['username']:
            return jsonify({"status": "error", "message": "لا يمكنك إيقاف حسابك!"}), 403

        if role == 'doctor':
            if target.get('role') != 'ta':
                return jsonify({"status": "error", "message": "يمكنك التحكم في المعيدين فقط!"}), 403
            my_subs = curr_user.get('allowed_subjects', [])
            target_subs = target.get('allowed_subjects', [])
            has_common = any(s in my_subs for s in target_subs)
            created_by_him = (target.get('created_by') == curr['username'])
            if not (has_common or created_by_him):
                return jsonify({"status": "error", "message": "غير مصرح!"}), 403
        elif role != 'super_admin':
            return jsonify({"status": "error", "message": "غير مصرح"}), 403

        new_status = bool(data.get('is_active', True))
        users_col.update_one({"username": target_username}, {"$set": {"is_active": new_status}})
        return jsonify({"status": "success", "message": "تم تنشيط الحساب" if new_status else "تم إيقاف الحساب"})

    # ---------- WIPE ----------
    elif action == 'wipe_all' and role == 'super_admin':
        provided_pw = str(data.get('admin_password', ''))
        admin_doc = users_col.find_one({"username": ADMIN_USERNAME})
        ok = False
        if admin_doc:
            try:
                ok = check_password_hash(admin_doc.get('password', ''), provided_pw)
            except Exception:
                ok = False
        if ok:
            attendance_col.delete_many({})
            sessions_col.delete_many({})
            return jsonify({"status": "success", "message": "تم التصفير بنجاح"})
        return jsonify({"status": "error", "message": "كلمة المرور غير صحيحة!"}), 403

    return jsonify({"status": "success"})


# ============================================================
#  📤 Export CSV
# ============================================================
@app.route('/api/export-attendance-csv')
def export_attendance_csv():
    if not _is_admin():
        return "Unauthorized", 401

    role = session['admin']['role']
    query = {}
    sess_id = _clean_str(request.args.get('session_id'), 64)
    raw_filename = "Attendance_Report"

    if sess_id:
        query["session_id"] = sess_id
        sess = sessions_col.find_one({"session_id": sess_id})
        if sess:
            if role == 'ta':
                curr = users_col.find_one({"username": session['admin']['username']})
                key = f"{sess.get('subject_id')}|Class{sess.get('class_number', '')}"
                if key not in (curr.get('allowed_classes') or []):
                    return "Unauthorized", 403
            elif role == 'doctor':
                curr = users_col.find_one({"username": session['admin']['username']})
                if sess.get('subject_id') not in (curr.get('allowed_subjects') or []):
                    return "Unauthorized", 403
            raw_filename = f"{sess.get('subject_name','')}_{sess.get('title','')}"

    records = list(attendance_col.find(query, {"_id": 0}).sort("timestamp", -1).limit(20000))

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['كود الطالب', 'اسم الطالب', 'الفرقة', 'القسم', 'المادة',
                     'نوع الجلسة', 'Class', 'عنوان الجلسة', 'توقيت الحضور', 'طريقة التسجيل', 'IP'])

    for r in records:
        scan_type = r.get('scan_type', '')
        if r.get('is_manual') or 'ADMIN' in str(r.get('ip', '')):
            method = 'يدوي (آدمن)'
        elif scan_type == 'qr':
            method = 'QR تلقائي'
        else:
            method = 'كود يدوي'
        writer.writerow([
            r.get('student_id', ''),
            r.get('student_name', ''),
            r.get('year', ''),
            r.get('department', ''),
            r.get('subject_name', ''),
            r.get('session_type', ''),
            r.get('class_number', ''),
            r.get('session_title', ''),
            r.get('timestamp', ''),
            method,
            r.get('ip', '')
        ])

    csv_data = output.getvalue()
    safe_ascii_name = f"Attendance_{int(time.time())}.csv"
    clean_name = "".join(ch for ch in raw_filename if ch.isalnum() or ch in " _-")[:80] or "Report"
    encoded_utf8_name = urllib.parse.quote(f"{clean_name}_{int(time.time())}.csv")
    disposition_header = f"attachment; filename=\"{safe_ascii_name}\"; filename*=UTF-8''{encoded_utf8_name}"

    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": disposition_header}
    )


# ============================================================
#  🚀 Entry
# ============================================================
if __name__ == '__main__':
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    print("=" * 65)
    print("🚀 Nexus Attendance Server Running")
    print("🔑 Admin: http://127.0.0.1:8080/secure-auth-gateway-2026-x9v2-pl7q-a84m")
    print("🖥️  Display: http://127.0.0.1:8080/dis")
    print(f"🔧 Debug mode: {'ON' if debug_mode else 'OFF'}")
    print("=" * 65)
    app.run(host='0.0.0.0', port=8080, debug=debug_mode, use_reloader=False)
