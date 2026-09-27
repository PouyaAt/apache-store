import os
import time
import sqlite3
from functools import wraps
from flask import Flask, jsonify, request, send_from_directory, render_template, session, redirect, url_for
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# مسیر پوشه دیسک پایدار
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# دیتابیس داخل دیسک پایدار
DB_PATH = os.path.join(DATA_DIR, "store.db")

# عکس‌های آپلود شده داخل دیسک پایدار
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["UPLOAD_DIR"] = UPLOAD_DIR
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # حداکثر حجم فایل ۱۶ مگابایت

# تنظیمات امنیت
app.secret_key = os.environ.get("SECRET_KEY", "apachezh3")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "apach")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "apach3")

CATEGORIES = ["hats", "necklaces", "watches", "socks", "mugs", "bags"]

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    conn = db()
    cur = conn.cursor()

    # پاک کردن جدول قدیمی برای اطمینان از اعمال ساختار جدید (ایمن چون داده کمی دارید)
    cur.execute("DROP TABLE IF EXISTS products")
    
    cur.execute("""
    CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        image_url TEXT,
        description TEXT
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        total_price INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    )
    """)

    conn.commit()
    conn.close()

# اجرای تابع ساخت دیتابیس در شروع برنامه
init_db()

# -----------------------
# روت‌ها
# -----------------------
def admin_login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_logged_in"):
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "Unauthorized"}), 401
            return redirect(url_for("admin_login", next=request.path))
        return fn(*args, **kwargs)
    return wrapper

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            next_url = request.args.get("next") or url_for("admin_page")
            return redirect(next_url)
        return render_template("admin_login.html", error="نام کاربری یا رمز عبور اشتباه است.")
    return render_template("admin_login.html", error=None)

@app.route("/")
def home():
    return render_template("index.html", categories=CATEGORIES)

@app.route("/api/products")
def api_products():
    conn = db()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/admin/products", methods=["POST"])
@admin_login_required
def add_product():
    name = request.form.get("name")
    category = request.form.get("category")
    price = request.form.get("price")
    description = request.form.get("description", "")

    if not name or not category or not price:
        return jsonify({"ok": False, "error": "اطلاعات ناقص است"}), 400

    image_url = ""
    if "image_file" in request.files:
        file = request.files["image_file"]
        if file and file.filename != "":
            filename = secure_filename(file.filename)
            unique_filename = f"{int(time.time())}_{filename}"
            save_path = os.path.join(app.config["UPLOAD_DIR"], unique_filename)
            file.save(save_path)
            image_url = f"/uploads/{unique_filename}"

    if not image_url and request.form.get("image_url"):
        image_url = request.form.get("image_url")

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO products (name, category, price, image_url, description)
        VALUES (?, ?, ?, ?, ?)
    """, (name, category, int(price), image_url, description))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({"ok": True, "message": "محصول اضافه شد", "id": new_id})

# سایر روت‌ها را در صورت نیاز اضافه کنید (حذف محصول، سفارشات و ...)

if __name__ == "__main__":
    app.run(debug=True)
