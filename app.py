import os
import time
import sqlite3
from functools import wraps
from flask import (
    Flask, jsonify, request, send_from_directory,
    render_template, session, redirect, url_for
)
from werkzeug.utils import secure_filename

# -----------------------
# Paths (Hardcoded Liara Disk Mount)
# -----------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOUNT_POINT = "/usr/src/app/data"

os.makedirs(MOUNT_POINT, exist_ok=True)
DB_PATH = os.path.join(MOUNT_POINT, "store.db")
UPLOAD_DIR = os.path.join(MOUNT_POINT, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

print(f"[*] Initialized DB_PATH at: {DB_PATH}", flush=True)
print(f"[*] Initialized UPLOAD_DIR at: {UPLOAD_DIR}", flush=True)

# -----------------------
# Flask app config
# -----------------------
app = Flask(__name__)
app.config["UPLOAD_DIR"] = UPLOAD_DIR
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

app.secret_key = os.environ.get("SECRET_KEY", "apachezh3")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "apach")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "apach3")
CATEGORIES = ["hats", "necklaces", "watches", "socks", "mugs", "bags"]

# -----------------------
# Database helpers
# -----------------------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS products (
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

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    # Safe migration: ensure products.image_url exists
    cur.execute("PRAGMA table_info(products)")
    columns = [col[1] for col in cur.fetchall()]
    if "image_url" not in columns:
        cur.execute("ALTER TABLE products ADD COLUMN image_url TEXT")

    conn.commit()
    conn.close()
    print("[*] Database schema initialized and verified.", flush=True)


# اجرای اولیه ساخت جداول
init_db()


# -----------------------
# Auth helpers
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


# -----------------------
# Static media route
# -----------------------
@app.route("/serve-img/<path:filename>")
def media(filename):
    # کدهای قبلی (همان نسخه دیباگ) را نگه دارید تا مطمئن شویم
    upload_dir = app.config["UPLOAD_DIR"]
    full_path = os.path.join(upload_dir, filename)
    print(f"[*] Accessing: {full_path}", flush=True) 
    return send_from_directory(upload_dir, filename)

# -----------------------
# Admin routes
# -----------------------
@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = (request.form.get("password") or "").strip()

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session["admin_logged_in"] = True
            next_url = request.args.get("next") or url_for("admin_page")
            return redirect(next_url)

        return render_template("admin_login.html", error="نام کاربری یا رمز عبور اشتباه است.")

    return render_template("admin_login.html", error=None)


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("admin_login"))


@app.route("/")
def home():
    return render_template("index.html", categories=CATEGORIES)


@app.route("/admin")
@admin_login_required
def admin_page():
    return render_template("admin.html", categories=CATEGORIES)


# -----------------------
# Products APIs
# -----------------------
@app.route("/api/products")
def api_products():
    conn = db()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/products_by_category")
def products_by_category():
    conn = db()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    conn.close()

    grouped = {c: [] for c in CATEGORIES}
    for r in rows:
        cat = r["category"]
        if cat in grouped:
            grouped[cat].append(dict(r))
    return jsonify(grouped)


@app.route("/api/admin/products", methods=["POST"])
@admin_login_required
def add_product():
    name = (request.form.get("name") or "").strip()
    category = (request.form.get("category") or "").strip()
    price_raw = (request.form.get("price") or "").strip()
    description = (request.form.get("description") or "").strip()

    if not name or not category or not price_raw:
        return jsonify({"ok": False, "error": "اطلاعات ناقص است"}), 400

    if category not in CATEGORIES:
        return jsonify({"ok": False, "error": "دسته‌بندی نامعتبر است"}), 400

    try:
        price = int(price_raw)
        if price < 0:
            raise ValueError()
    except ValueError:
        return jsonify({"ok": False, "error": "قیمت نامعتبر است"}), 400

    image_url = ""

    # 1) Upload file
    file = request.files.get("image_file")
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_filename = f"{int(time.time())}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_DIR"], unique_filename)
        file.save(save_path)
        # تغییر از /storage/ به /serve-img/
        image_url = f"/serve-img/{unique_filename}"


    # 2) Or accept direct URL if no file uploaded
    if not image_url:
        image_url = (request.form.get("image_url") or "").strip()

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO products (name, category, price, image_url, description)
        VALUES (?, ?, ?, ?, ?)
    """, (name, category, price, image_url, description))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()

    return jsonify({"ok": True, "message": "محصول با موفقیت اضافه شد", "id": new_id})


@app.route("/api/admin/products/<int:product_id>", methods=["DELETE"])
@admin_login_required
def delete_product(product_id):
    conn = db()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"ok": False, "error": "محصول یافت نشد"}), 404

    image_url = row["image_url"] or ""
    # پشتیبانی از هر دو پیشوند برای محصولات قدیمی و جدید
    if image_url.startswith("/storage/") or image_url.startswith("/media/"):
        filename = image_url.replace("/storage", "", 1)
        file_path = os.path.join(app.config["UPLOAD_DIR"], filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                print("Failed to remove file:", e, flush=True)

    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "محصول با موفقیت حذف شد"})


# -----------------------
# Checkout / Orders APIs
# -----------------------
@app.route("/api/checkout", methods=["POST"])
def checkout():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"ok": False, "error": "Invalid JSON body"}), 400

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    address = (data.get("address") or "").strip()
    items = data.get("items") or []

    if not name or not phone or not address:
        return jsonify({"ok": False, "error": "name, phone, address are required"}), 400

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"ok": False, "error": "Cart is empty"}), 400

    normalized_items = []
    total_price = 0

    for it in items:
        try:
            product_id = it.get("id", None)
            product_name = (it.get("name") or "").strip()
            price = int(it.get("price", 0))
            quantity = int(it.get("quantity", 0))
        except Exception:
            return jsonify({"ok": False, "error": "Invalid cart item format"}), 400

        if not product_name or price < 0 or quantity <= 0:
            return jsonify({"ok": False, "error": "Invalid cart item values"}), 400

        total_price += price * quantity
        normalized_items.append({
            "product_id": product_id,
            "product_name": product_name,
            "price": price,
            "quantity": quantity
        })

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO orders (customer_name, customer_phone, customer_address, total_price)
            VALUES (?, ?, ?, ?)
            """,
            (name, phone, address, total_price)
        )
        order_id = cur.lastrowid

        for it in normalized_items:
            cur.execute(
                """
                INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
                VALUES (?, ?, ?, ?, ?)
                """,
                (order_id, it["product_id"], it["product_name"], it["price"], it["quantity"])
            )

        conn.commit()
        return jsonify({
            "ok": True,
            "message": "Order placed successfully",
            "order_id": order_id,
            "total_price": total_price
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders", methods=["GET"])
@admin_login_required
def get_orders():
    conn = db()
    orders = conn.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()

    order_list = []
    for order in orders:
        items = conn.execute(
            "SELECT * FROM order_items WHERE order_id = ?",
            (order["id"],)
        ).fetchall()

        order_list.append({
            "id": order["id"],
            "customer_name": order["customer_name"],
            "customer_phone": order["customer_phone"],
            "customer_address": order["customer_address"],
            "total_price": order["total_price"],
            "created_at": order["created_at"],
            "items": [dict(item) for item in items]
        })

    conn.close()
    return jsonify(order_list)


# -----------------------
# Debug Route
# -----------------------
@app.route("/api/debug-paths")
def debug_paths():
    base = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        "/data",
        "/data/uploads",
        "/usr/src/app/data",
        os.path.join(base, "data"),
        app.config.get("UPLOAD_DIR")
    ]
    result = {}
    for p in set(candidates):
        if p and os.path.exists(p):
            try:
                result[p] = os.listdir(p)
            except Exception as e:
                result[p] = str(e)
        else:
            result[p] = "NOT_FOUND"
    return jsonify({
        "DB_PATH": DB_PATH,
        "current_UPLOAD_DIR": app.config.get("UPLOAD_DIR"),
        "scanned_paths": result
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=True)
