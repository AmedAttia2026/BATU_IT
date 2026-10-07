import os
import sys
import time
import hmac
import hashlib
import io
import csv
import urllib.parse
from datetime import datetime, timedelta
import pytz
from flask import Flask, render_template, request, jsonify, session, Response, redirect
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PARENT_DIR = os.path.abspath(os.path.join(BASE_DIR, '..'))

TEMPLATE_DIR = os.path.join(PARENT_DIR, 'templates') if os.path.exists(os.path.join(PARENT_DIR, 'templates')) else os.path.join(BASE_DIR, 'templates')
STATIC_DIR = os.path.join(PARENT_DIR, 'static') if os.path.exists(os.path.join(PARENT_DIR, 'static')) else os.path.join(BASE_DIR, 'static')

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR, static_url_path='/static')
app.secret_key = os.environ.get("SECRET_KEY", "Nexus_Attendance_Super_Key_2026_Fixed")
app.permanent_session_lifetime = timedelta(days=7)

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["3000 per day", "800 per hour"],
    storage_uri="memory://"
)

# ----------------- الاتصال بقاعدة بيانات MongoDB Atlas -----------------
username = urllib.parse.quote_plus('ahmedattia20041120_db_user')
password = urllib.parse.quote_plus('wjXYBO8Pbj5GijfS')
DEFAULT_MONGO_URI = f"mongodb+srv://{username}:{password}@cluster0.yimrrnh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

MONGO_URI = os.environ.get("MONGO_URI", DEFAULT_MONGO_URI)
client = MongoClient(MONGO_URI)
db = client['nexus_attendance_system']

users_col = db['users']
subjects_col = db['subjects']
sessions_col = db['sessions']
attendance_col = db['attendance']
students_col = db['students']

try:
    users_col.create_index("username", unique=True)
    students_col.create_index("student_id", unique=True)
    attendance_col.create_index([("student_id", 1), ("session_id", 1)], unique=True)
    sessions_col.create_index("session_id", unique=True)
except Exception:
    pass

# تثبيت حساب الآدمن الرئيسي
users_col.update_one(
    {"username": "Nexus_Admin_Core#2026"},
    {"$set": {
        "username": "Nexus_Admin_Core#2026",
        "role": "super_admin",
        "name": "الآدمن الرئيسي",
        "password": generate_password_hash("Nx!99@bATU#xK82_Secured")
    }},
    upsert=True
)

SECRET_SALT = b"NEXUS_ATTENDANCE_CORE_SECRET_2026_PROD"
BASE32_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# ✅ التعديل: الفاصل الزمني = 10 ثواني
STEP_INTERVAL = 10  # كود الحضور يتغير كل 10 ثواني
GRACE_PERIOD = 2.0  # مهلة إضافية 2 ثانية للكود القديم (الإجمالي 12 ثانية)


def get_step_code(step: int, session_id: str) -> str:
    key = SECRET_SALT + session_id.encode('utf-8')
    digest = hmac.new(key, str(step).encode('utf-8'), hashlib.sha256).digest()
    num = int.from_bytes(digest[:5], 'big')
    code = ""
    for _ in range(6):
        code += BASE32_CHARS[num % len(BASE32_CHARS)]
        num //= len(BASE32_CHARS)
    return code


# منطق تحقق صارم — الكود الحالي فقط + مهلة 2 ثانية للقديم
def verify_totp(user_code: str, session_id: str) -> bool:
    clean = user_code.strip().upper()
    if not clean or len(clean) != 6:
        return False

    now = time.time()
    current_step = int(now // STEP_INTERVAL)

    # الكود الحالي مقبول دائماً
    current_code = get_step_code(current_step, session_id)
    if clean == current_code:
        return True

    # الكود القديم (السابق) مقبول فقط خلال أول 2 ثانية من الـ step الحالي
    # ده بيخلي عمر الكود الأقصى = 10 + 2 = 12 ثانية
    elapsed_in_current_step = now - (current_step * STEP_INTERVAL)
    if elapsed_in_current_step < GRACE_PERIOD:
        previous_code = get_step_code(current_step - 1, session_id)
        if clean == previous_code:
            return True

    # ممنوع تماماً أي كود أقدم من كده
    return False


@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"status": "error", "message": "تم تجاوز عدد المحاولات! انتظر قليلاً."}), 429

# ----------------- مسارات الواجهات -----------------
@app.route('/')
def student_ui():
    return render_template('index.html')

@app.route('/secure-auth-gateway-2026-x9v2-pl7q-a84m')
def admin_ui():
    return render_template('admin.html')

@app.route('/logout-gateway-vip-x9v2-pL7q-2026')
def logout():
    session.clear()
    return redirect('/secure-auth-gateway-2026-x9v2-pl7q-a84m')

# ----------------- مسارات بوابة الطلاب -----------------
@app.route('/api/student-login', methods=['POST'])
@limiter.limit("30 per minute")
def student_login():
    data = request.get_json(force=True, silent=True) or {}
    s_name = str(data.get('student_name', '')).strip()
    s_id = str(data.get('student_id', '')).strip()
    year = str(data.get('year', '')).strip()
    dept = str(data.get('department', 'عام (IT)')).strip()

    if len(s_name) < 3:
        return jsonify({"status": "error", "message": "يرجى كتابة اسم الطالب بشكل صحيح!"}), 400

    if len(s_id) != 7 or not s_id.isdigit():
        return jsonify({"status": "error", "message": "كود الطالب يجب أن يتكون من 7 أرقام!"}), 400

    if not year:
        return jsonify({"status": "error", "message": "يرجى اختيار الفرقة الدراسية!"}), 400

    students_col.update_one(
        {"student_id": s_id},
        {"$set": {
            "student_id": s_id,
            "name": s_name,
            "email": f"{s_id}@batechu.com",
            "year": year,
            "department": dept,
            "last_active": datetime.now(pytz.timezone('Africa/Cairo')).strftime("%Y-%m-%d %I:%M %p")
        }},
        upsert=True
    )

    return jsonify({
        "status": "success",
        "student": {
            "student_id": s_id,
            "name": s_name,
            "email": f"{s_id}@batechu.com",
            "year": year,
            "department": dept
        }
    })

@app.route('/api/student-init')
def student_init():
    year = request.args.get('year', '')
    dept = request.args.get('dept', '')

    query = {}
    if year:
        query["year"] = year
        if dept:
            query["department"] = {"$in": [dept, "عام (IT)"]}

    subs = list(subjects_col.find(query, {"_id": 0}))
    active_sessions = list(sessions_col.find({"is_open": True}, {"_id": 0}))
    return jsonify({"status": "success", "subjects": subs, "sessions": active_sessions})

@app.route('/api/student-history', methods=['POST'])
def student_history():
    data = request.get_json(force=True, silent=True) or {}
    s_id = str(data.get('student_id', '')).strip()
    records = list(attendance_col.find({"student_id": s_id}, {"_id": 0}).sort("timestamp", -1))
    return jsonify({"status": "success", "history": records})

@app.route('/api/submit-attendance', methods=['POST'])
@limiter.limit("40 per minute")
def submit_attendance():
    data = request.get_json(force=True, silent=True) or {}
    s_id = str(data.get('student_id', '')).strip()
    s_name = str(data.get('student_name', '')).strip()
    session_id = str(data.get('session_id', '')).strip()
    code = str(data.get('code', '')).strip().upper()
    device_token = str(data.get('device_token', '')).strip()

    if len(s_id) != 7 or not s_id.isdigit():
        return jsonify({"status": "error", "message": "رقم الـ ID غير صحيح!"}), 400

    sess = sessions_col.find_one({"session_id": session_id, "is_open": True})
    if not sess:
        return jsonify({"status": "error", "message": "عفواً، هذه الجلسة مغلقة حالياً أو انتهت!"}), 400

    if not verify_totp(code, session_id):
        return jsonify({"status": "error", "message": "الرمز السري غير صحيح أو انتهت صلاحيته (انظر للشاشة وأعد المحاولة)!"}), 400

    if device_token:
        dup_dev = attendance_col.find_one({"session_id": session_id, "device_token": device_token})
        if dup_dev and dup_dev.get('student_id') != s_id:
            return jsonify({"status": "error", "message": "ممنوع الغش! تم تسجيل حضور طالب آخر مسبقاً من هذا الجهاز."}), 403

    if attendance_col.find_one({"student_id": s_id, "session_id": session_id}):
        return jsonify({"status": "error", "message": "لقد قمت بتسجيل الحضور في هذه الجلسة مسبقاً!"}), 409

    st_record = students_col.find_one({"student_id": s_id})
    year = st_record.get('year', '') if st_record else ''
    dept = st_record.get('department', '') if st_record else ''

    cairo_now = datetime.now(pytz.timezone('Africa/Cairo')).strftime("%Y-%m-%d %I:%M:%S %p")
    ip = request.headers.get('x-forwarded-for', request.remote_addr).split(',')[0].strip()

    attendance_col.insert_one({
        "student_id": s_id,
        "student_name": s_name,
        "year": year,
        "department": dept,
        "subject_id": sess['subject_id'],
        "subject_name": sess['subject_name'],
        "session_id": session_id,
        "session_title": sess['title'],
        "session_type": sess['type'],
        "timestamp": cairo_now,
        "device_token": device_token,
        "ip": ip,
        "is_manual": False
    })

    return jsonify({"status": "success", "message": f"تم تأكيد حضورك بنجاح في ({sess['subject_name']} - {sess['title']})"})

# ----------------- مسارات لوحة تحكم الإدارة -----------------
@app.route('/api/admin-login', methods=['POST'])
def admin_login():
    data = request.get_json(force=True, silent=True) or {}
    username = str(data.get('username', '')).strip()
    password = str(data.get('password', '')).strip()

    if username == 'Nexus_Admin_Core#2026' and password == 'Nx!99@bATU#xK82_Secured':
        session.permanent = True
        session['admin'] = {"username": "Nexus_Admin_Core#2026", "name": "الآدمن الرئيسي", "role": "super_admin"}
        return jsonify({"status": "success", "admin": session['admin']})

    user = users_col.find_one({"username": {"$regex": f"^{username}$", "$options": "i"}})
    if user:
        if check_password_hash(user.get('password', ''), password) or user.get('password') == password:
            session.permanent = True
            session['admin'] = {
                "username": user['username'],
                "name": user.get('name', user['username']),
                "role": user.get('role', 'doctor')
            }
            return jsonify({"status": "success", "admin": session['admin']})

    return jsonify({"status": "error", "message": "اسم المستخدم أو كلمة المرور غير صحيحة!"}), 401

@app.route('/api/admin-data')
def get_admin_data():
    if 'admin' not in session:
        return jsonify({"status": "unauthorized"}), 401

    role = session['admin']['role']
    curr_username = session['admin']['username']
    curr_admin = users_col.find_one({"username": curr_username})
    allowed_subs = curr_admin.get('allowed_subjects', []) if curr_admin else []

    if role == 'super_admin':
        subjects = list(subjects_col.find({}, {"_id": 0}))
        sessions_list = list(sessions_col.find({}, {"_id": 0}).sort("created_at", -1))
        staff_list = list(users_col.find({"role": {"$ne": "super_admin"}}, {"_id": 0, "password": 0}))
    else:
        subjects = list(subjects_col.find({"id": {"$in": allowed_subs}}, {"_id": 0}))
        sessions_list = list(sessions_col.find({"subject_id": {"$in": allowed_subs}}, {"_id": 0}).sort("created_at", -1))
        if role == 'doctor':
            staff_list = list(users_col.find({"role": "ta"}, {"_id": 0, "password": 0}))
            for s in staff_list:
                s['allowed_subjects'] = [sub for sub in s.get('allowed_subjects', []) if sub in allowed_subs]
        else:
            staff_list = []

    return jsonify({
        "status": "success",
        "currentAdmin": session['admin'],
        "subjects": subjects,
        "sessions": sessions_list,
        "staff": staff_list
    })

@app.route('/api/session-attendance')
def get_session_attendance():
    if 'admin' not in session:
        return jsonify({"status": "unauthorized"}), 401

    sess_id = request.args.get('session_id', '')
    records = list(attendance_col.find({"session_id": sess_id}, {"_id": 0}).sort("timestamp", -1))
    sess = sessions_col.find_one({"session_id": sess_id}, {"_id": 0})
    return jsonify({"status": "success", "session": sess, "records": records})

@app.route('/api/live-code')
def get_live_code():
    session_id = request.args.get('session_id', '')
    now = time.time()
    step = int(now // STEP_INTERVAL)
    remaining = STEP_INTERVAL - (now - (step * STEP_INTERVAL))
    code = get_step_code(step, session_id)
    return jsonify({"code": code, "remaining": remaining, "interval": STEP_INTERVAL})

@app.route('/api/admin-action', methods=['POST'])
def admin_action():
    if 'admin' not in session:
        return jsonify({"status": "unauthorized"}), 401

    curr_user = users_col.find_one({"username": session['admin']['username']})
    role = session['admin']['role']
    curr = session['admin']
    data = request.get_json(force=True, silent=True) or {}
    action = str(data.get('action', ''))

    if action == 'change_my_password':
        new_pw = generate_password_hash(str(data.get('new_password', '')))
        users_col.update_one({"username": curr['username']}, {"$set": {"password": new_pw}})
        return jsonify({"status": "success"})

    elif action == 'create_session':
        s_data = data.get('session', {})
        sub_id = str(s_data.get('subject_id', ''))

        if role != 'super_admin' and sub_id not in curr_user.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح لك بفتح جلسة في هذه المادة!"}), 403

        sess_id = f"SESS_{int(time.time())}_{''.join([c for c in sub_id if c.isalnum()][:4])}"
        sessions_col.insert_one({
            "session_id": sess_id,
            "subject_id": sub_id,
            "subject_name": str(s_data.get('subject_name', '')),
            "type": str(s_data.get('type', 'Lecture')),
            "title": str(s_data.get('title', 'عام')),
            "is_open": True,
            "created_by": curr['name'],
            "created_at": datetime.now(pytz.timezone('Africa/Cairo')).strftime("%Y-%m-%d %I:%M %p")
        })

    elif action == 'toggle_session':
        sess_id = str(data.get('session_id', ''))
        sess = sessions_col.find_one({"session_id": sess_id})
        if sess and role != 'super_admin' and sess.get('subject_id') not in curr_user.get('allowed_subjects', []):
            return jsonify({"status": "error", "message": "غير مصرح لك بتعديل هذه الجلسة!"}), 403

        sessions_col.update_one({"session_id": sess_id}, {"$set": {"is_open": bool(data.get('is_open'))}})

    elif action == 'delete_session':
        sess_id = str(data.get('session_id', ''))
        sessions_col.delete_one({"session_id": sess_id})
        attendance_col.delete_many({"session_id": sess_id})

    elif action == 'add_manual_attendance':
        sess_id = str(data.get('session_id', '')).strip()
        s_id = str(data.get('student_id', '')).strip()
        s_name = str(data.get('student_name', '')).strip()

        sess = sessions_col.find_one({"session_id": sess_id})
        if not sess:
            return jsonify({"status": "error", "message": "الجلسة غير موجودة!"}), 404

        if attendance_col.find_one({"student_id": s_id, "session_id": sess_id}):
            return jsonify({"status": "error", "message": "الطالب مسجل حضوره بالفعل في هذه الجلسة!"}), 409

        st_record = students_col.find_one({"student_id": s_id})
        year = st_record.get('year', '') if st_record else ''
        dept = st_record.get('department', '') if st_record else ''

        cairo_now = datetime.now(pytz.timezone('Africa/Cairo')).strftime("%Y-%m-%d %I:%M:%S %p")
        attendance_col.insert_one({
            "student_id": s_id,
            "student_name": s_name,
            "year": year,
            "department": dept,
            "subject_id": sess['subject_id'],
            "subject_name": sess['subject_name'],
            "session_id": sess_id,
            "session_title": sess['title'],
            "session_type": sess['type'],
            "timestamp": cairo_now,
            "device_token": "MANUAL_BY_ADMIN",
            "ip": "ADMIN",
            "is_manual": True
        })
        return jsonify({"status": "success", "message": "تم تحضير الطالب يدوياً بنجاح!"})

    elif action == 'edit_attendance_record':
        sess_id = str(data.get('session_id', ''))
        old_id = str(data.get('old_id', ''))
        new_id = str(data.get('new_id', ''))
        new_name = str(data.get('new_name', ''))

        attendance_col.update_one(
            {"session_id": sess_id, "student_id": old_id},
            {"$set": {"student_id": new_id, "student_name": new_name}}
        )
        return jsonify({"status": "success"})

    elif action == 'delete_attendance_record':
        attendance_col.delete_one({
            "student_id": str(data.get('student_id', '')),
            "session_id": str(data.get('session_id', ''))
        })

    elif action == 'manage_subject' and role == 'super_admin':
        sub_act = str(data.get('sub', ''))
        if sub_act == 'add':
            s_obj = data.get('subject', {})
            sub_id = f"SUB_{int(time.time())}"
            subjects_col.insert_one({
                "id": sub_id,
                "name": str(s_obj.get('name', '')),
                "year": str(s_obj.get('year', '')),
                "department": str(s_obj.get('department', '')),
                "image": str(s_obj.get('image', '')),
                "added_by": curr['name']
            })
        elif sub_act == 'delete':
            sub_id = str(data.get('id', ''))
            subjects_col.delete_one({"id": sub_id})
            sessions_col.delete_many({"subject_id": sub_id})
            attendance_col.delete_many({"subject_id": sub_id})

    elif action == 'manage_staff':
        if role == 'ta':
            return jsonify({"status": "error", "message": "المعيد ليس له صلاحية إدارة الطاقم!"}), 403

        sub_act = str(data.get('sub', ''))
        staff_data = data.get('staff', {})

        if sub_act == 'add':
            new_role = str(staff_data.get('role', 'ta'))
            allowed_subs = staff_data.get('allowed_subjects', [])

            if role == 'doctor':
                new_role = 'ta'
                my_subs = curr_user.get('allowed_subjects', [])
                if not all(s in my_subs for s in allowed_subs):
                    return jsonify({"status": "error", "message": "لا يمكنك منح صلاحية لمعيد في مادة لا تدرسها!"}), 403

            target_user = str(staff_data.get('username', '')).strip()
            if users_col.find_one({"username": target_user}):
                return jsonify({"status": "error", "message": "اسم المستخدم موجود مسبقاً!"}), 400

            users_col.insert_one({
                "name": str(staff_data.get('name', '')).strip(),
                "username": target_user,
                "password": generate_password_hash(str(staff_data.get('password', ''))),
                "role": new_role,
                "allowed_subjects": allowed_subs,
                "created_by": curr['username']
            })

        elif sub_act == 'delete':
            target_username = str(data.get('username', ''))
            users_col.delete_one({"username": target_username})

    elif action == 'wipe_all' and role == 'super_admin':
        provided_pw = str(data.get('admin_password', ''))
        if provided_pw == 'Nx!99@bATU#xK82_Secured':
            attendance_col.delete_many({})
            sessions_col.delete_many({})
            return jsonify({"status": "success", "message": "تم تصفير كشوف الحضور والجلسات بنجاح"})
        return jsonify({"status": "error", "message": "كلمة المرور غير صحيحة!"}), 403

    return jsonify({"status": "success"})

# ----------------- تصدير إكسل -----------------
@app.route('/api/export-attendance-csv')
def export_attendance_csv():
    if 'admin' not in session:
        return "Unauthorized", 401

    curr_admin = users_col.find_one({"username": session['admin']['username']})
    allowed_subs = curr_admin.get('allowed_subjects', []) if curr_admin and session['admin']['role'] != 'super_admin' else None

    query = {}
    sess_id = request.args.get('session_id')
    raw_filename = "Attendance_Report"

    if sess_id:
        query["session_id"] = sess_id
        sess = sessions_col.find_one({"session_id": sess_id})
        if sess:
            raw_filename = f"{sess['subject_name']}_{sess['title']}"

    records = list(attendance_col.find(query, {"_id": 0}).sort("timestamp", -1))

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(['كود الطالب', 'اسم الطالب', 'الفرقة', 'القسم', 'المادة', 'نوع الجلسة', 'عنوان الجلسة', 'توقيت الحضور', 'طريقة التسجيل', 'عنوان IP'])

    for r in records:
        writer.writerow([
            r.get('student_id', ''),
            r.get('student_name', ''),
            r.get('year', ''),
            r.get('department', ''),
            r.get('subject_name', ''),
            r.get('session_type', ''),
            r.get('session_title', ''),
            r.get('timestamp', ''),
            'يدوي' if r.get('is_manual') or 'ADMIN' in str(r.get('ip', '')) else 'تلقائي (QR)',
            r.get('ip', '')
        ])

    csv_data = output.getvalue()

    safe_ascii_name = f"Attendance_{int(time.time())}.csv"
    encoded_utf8_name = urllib.parse.quote(f"{raw_filename}_{int(time.time())}.csv")
    disposition_header = f"attachment; filename=\"{safe_ascii_name}\"; filename*=UTF-8''{encoded_utf8_name}"

    return Response(
        csv_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": disposition_header}
    )

if __name__ == '__main__':
    print("=" * 65)
    print("🚀 سيرفر Nexus Attendance يعمل بنجاح على قاعدة البيانات الجديدة!")
    print("🔑 رابط لوحة الآدمن: http://127.0.0.1:8080/secure-auth-gateway-2026-x9v2-pl7q-a84m")
    print("👤 اسم المستخدم: Nexus_Admin_Core#2026")
    print("🔒 كلمة المرور: Nx!99@bATU#xK82_Secured")
    print("=" * 65)
    app.run(host='0.0.0.0', port=8080, debug=True)
