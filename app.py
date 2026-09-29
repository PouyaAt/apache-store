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
    conn.execute("PRAGMA foreign_keys = ON;")
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

    # جدول تنوع رنگ محصولات
    cur.execute("""
    CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        color_name TEXT NOT NULL,
        image_url TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_address TEXT NOT NULL,
        total_price INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
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
        selected_color TEXT DEFAULT '',
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )
    """)

    # بررسی و ارتقای ستون‌های احتمالی گذشته (Migration)
    cur.execute("PRAGMA table_info(products)")
    p_columns = [col[1] for col in cur.fetchall()]
    if "image_url" not in p_columns:
        cur.execute("ALTER TABLE products ADD COLUMN image_url TEXT")

    cur.execute("PRAGMA table_info(orders)")
    o_columns = [col[1] for col in cur.fetchall()]
    if "status" not in o_columns:
        cur.execute("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'")

    cur.execute("PRAGMA table_info(order_items)")
    item_columns = [col[1] for col in cur.fetchall()]
    if "selected_color" not in item_columns:
        cur.execute("ALTER TABLE order_items ADD COLUMN selected_color TEXT DEFAULT ''")

    conn.commit()
    conn.close()
    print("[*] Database schema initialized and verified.", flush=True)


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
@app.route("/get-data-file/<path:filename>")
def media(filename):
    upload_dir = app.config["UPLOAD_DIR"]
    full_path = os.path.join(upload_dir, filename)
    
    if not os.path.exists(full_path):
        return f"File not found: {full_path}", 404
        
    return send_from_directory(upload_dir, filename)


# -----------------------
# Admin view routes
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
# Products Public APIs
# -----------------------
def get_variants_mapping(conn):
    """نقشه‌ای از تمام رنگ‌ها برای هر محصول ایجاد می‌کند"""
    cur = conn.execute("SELECT * FROM product_variants ORDER BY id ASC")
    variants_by_pid = {}
    for row in cur.fetchall():
        pid = row["product_id"]
        if pid not in variants_by_pid:
            variants_by_pid[pid] = []
        variants_by_pid[pid].append({
            "id": row["id"],
            "color_name": row["color_name"],
            "image_url": row["image_url"]
        })
    return variants_by_pid


@app.route("/api/products")
def api_products():
    conn = db()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    variants_map = get_variants_mapping(conn)
    conn.close()

    result = []
    for r in rows:
        prod = dict(r)
        prod["variants"] = variants_map.get(prod["id"], [])
        result.append(prod)
    return jsonify(result)


@app.route("/api/products_by_category")
def products_by_category():
    conn = db()
    rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    variants_map = get_variants_mapping(conn)
    conn.close()

    grouped = {c: [] for c in CATEGORIES}
    for r in rows:
        cat = r["category"]
        prod = dict(r)
        prod["variants"] = variants_map.get(prod["id"], [])
        if cat in grouped:
            grouped[cat].append(prod)
    return jsonify(grouped)


# -----------------------
# Admin Stats & Operations APIs
# -----------------------
@app.route("/api/admin/stats", methods=["GET"])
@admin_login_required
def admin_stats():
    conn = db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_price), 0) AS total_revenue FROM orders WHERE status != 'cancelled'")
    order_stats = dict(cur.fetchone())

    cur.execute("SELECT COUNT(*) AS pending_orders FROM orders WHERE status = 'pending'")
    pending = cur.fetchone()["pending_orders"]

    cur.execute("SELECT COUNT(*) AS total_products FROM products")
    products_count = cur.fetchone()["total_products"]

    conn.close()

    return jsonify({
        "ok": True,
        "total_revenue": order_stats["total_revenue"],
        "total_orders": order_stats["total_orders"],
        "pending_orders": pending,
        "total_products": products_count
    })


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

    file = request.files.get("image_file")
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_filename = f"{int(time.time())}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_DIR"], unique_filename)
        file.save(save_path)
        image_url = f"/get-data-file/{unique_filename}"

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


@app.route("/api/admin/products/<int:product_id>", methods=["PUT"])
@admin_login_required
def edit_product(product_id):
    name = (request.form.get("name") or "").strip()
    category = (request.form.get("category") or "").strip()
    price_raw = (request.form.get("price") or "").strip()
    description = (request.form.get("description") or "").strip()

    if not name or not category or not price_raw:
        return jsonify({"ok": False, "error": "نام، دسته‌بندی و قیمت الزامی است."}), 400

    if category not in CATEGORIES:
        return jsonify({"ok": False, "error": "دسته‌بندی نامعتبر است."}), 400

    try:
        price = int(price_raw)
        if price < 0:
            raise ValueError()
    except ValueError:
        return jsonify({"ok": False, "error": "قیمت نامعتبر است."}), 400

    conn = db()
    prod = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not prod:
        conn.close()
        return jsonify({"ok": False, "error": "محصول یافت نشد."}), 404

    image_url = prod["image_url"]

    file = request.files.get("image_file")
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_filename = f"{int(time.time())}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_DIR"], unique_filename)
        file.save(save_path)
        image_url = f"/get-data-file/{unique_filename}"
    elif request.form.get("image_url"):
        image_url = request.form.get("image_url").strip()

    conn.execute("""
        UPDATE products
        SET name = ?, category = ?, price = ?, image_url = ?, description = ?
        WHERE id = ?
    """, (name, category, price, image_url, description, product_id))
    conn.commit()
    conn.close()

    return jsonify({"ok": True, "message": "محصول با موفقیت ویرایش شد"})


@app.route("/api/admin/products/<int:product_id>", methods=["DELETE"])
@admin_login_required
def delete_product(product_id):
    conn = db()
    row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"ok": False, "error": "محصول یافت نشد"}), 404

    # پاک کردن تصاویر فایل‌های وریانت این محصول از دیسک
    variants = conn.execute("SELECT image_url FROM product_variants WHERE product_id = ?", (product_id,)).fetchall()
    for v in variants:
        v_url = v["image_url"] or ""
        if v_url.startswith("/get-data-file/"):
            fname = v_url.replace("/get-data-file/", "", 1)
            fpath = os.path.join(app.config["UPLOAD_DIR"], fname)
            if os.path.exists(fpath):
                try: os.remove(fpath)
                except Exception: pass

    # پاک کردن تصویر اصلی از دیسک
    image_url = row["image_url"] or ""
    if image_url and image_url.startswith("/get-data-file/"):
        filename = image_url.replace("/get-data-file/", "", 1)
        file_path = os.path.join(app.config["UPLOAD_DIR"], filename)
        if os.path.exists(file_path):
            try: os.remove(file_path)
            except Exception as e:
                print("Failed to remove file:", e, flush=True)

    conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "محصول با موفقیت حذف شد"})


# -----------------------
# Product Variants (Color) APIs
# -----------------------
@app.route("/api/admin/products/<int:product_id>/variants", methods=["POST"])
@admin_login_required
def add_product_variant(product_id):
    color_name = (request.form.get("color_name") or "").strip()
    if not color_name:
        return jsonify({"ok": False, "error": "نام رنگ الزامی است."}), 400

    image_url = ""
    file = request.files.get("image_file")
    if file and file.filename:
        filename = secure_filename(file.filename)
        unique_filename = f"var_{int(time.time())}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_DIR"], unique_filename)
        file.save(save_path)
        image_url = f"/get-data-file/{unique_filename}"
    elif request.form.get("image_url"):
        image_url = request.form.get("image_url").strip()

    if not image_url:
        return jsonify({"ok": False, "error": "تصویر رنگ الزامی است."}), 400

    conn = db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO product_variants (product_id, color_name, image_url)
        VALUES (?, ?, ?)
    """, (product_id, color_name, image_url))
    conn.commit()
    variant_id = cur.lastrowid
    conn.close()

    return jsonify({"ok": True, "variant_id": variant_id, "image_url": image_url})


@app.route("/api/admin/variants/<int:variant_id>", methods=["DELETE"])
@admin_login_required
def delete_product_variant(variant_id):
    conn = db()
    variant = conn.execute("SELECT image_url FROM product_variants WHERE id = ?", (variant_id,)).fetchone()
    if variant and variant["image_url"] and variant["image_url"].startswith("/get-data-file/"):
        fname = variant["image_url"].replace("/get-data-file/", "", 1)
        fpath = os.path.join(app.config["UPLOAD_DIR"], fname)
        if os.path.exists(fpath):
            try: os.remove(fpath)
            except Exception: pass

    conn.execute("DELETE FROM product_variants WHERE id = ?", (variant_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "رنگ با موفقیت حذف شد"})


# -----------------------
# Checkout & Orders APIs
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
        return jsonify({"ok": False, "error": "نام، شماره تماس و آدرس الزامی هستند."}), 400

    if not isinstance(items, list) or len(items) == 0:
        return jsonify({"ok": False, "error": "سبد خرید خالی است."}), 400

    normalized_items = []
    total_price = 0

    for it in items:
        try:
            product_id = it.get("id", None)
            product_name = (it.get("name") or "").strip()
            price = int(it.get("price", 0))
            quantity = int(it.get("quantity", 0))
            selected_color = (it.get("selected_color") or "").strip()
        except Exception:
            return jsonify({"ok": False, "error": "فرمت آیتم‌های سبد خرید نامعتبر است."}), 400

        if not product_name or price < 0 or quantity <= 0:
            return jsonify({"ok": False, "error": "مقادیر سبد خرید نامعتبر است."}), 400

        total_price += price * quantity
        normalized_items.append({
            "product_id": product_id,
            "product_name": product_name,
            "price": price,
            "quantity": quantity,
            "selected_color": selected_color
        })

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO orders (customer_name, customer_phone, customer_address, total_price, status)
            VALUES (?, ?, ?, ?, 'pending')
            """,
            (name, phone, address, total_price)
        )
        order_id = cur.lastrowid

        for it in normalized_items:
            cur.execute(
                """
                INSERT INTO order_items (order_id, product_id, product_name, price, quantity, selected_color)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (order_id, it["product_id"], it["product_name"], it["price"], it["quantity"], it["selected_color"])
            )

        conn.commit()
        return jsonify({
            "ok": True,
            "message": "سفارش با موفقیت ثبت شد",
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
    orders = conn.execute("SELECT * FROM orders ORDER BY id DESC").fetchall()

    order_list = []
    for order in orders:
        items = conn.execute(
            "SELECT * FROM order_items WHERE order_id = ?",
            (order["id"],)
        ).fetchall()

        order_dict = dict(order)
        order_dict["items"] = [dict(item) for item in items]
        order_list.append(order_dict)

    conn.close()
    return jsonify(order_list)


@app.route("/api/admin/orders/<int:order_id>/status", methods=["PATCH"])
@admin_login_required
def update_order_status(order_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")
    allowed_statuses = {"pending", "processing", "completed", "cancelled"}

    if new_status not in allowed_statuses:
        return jsonify({"ok": False, "error": "وضعیت نامعتبر است."}), 400

    conn = db()
    cur = conn.cursor()
    cur.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
    updated = cur.rowcount
    conn.commit()
    conn.close()

    if updated == 0:
        return jsonify({"ok": False, "error": "سفارش یافت نشد."}), 404

    return jsonify({"ok": True, "message": "وضعیت با موفقیت به‌روزرسانی شد"})


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
