const form = document.getElementById("productForm");
const statusDiv = document.getElementById("status");
const submitBtn = document.getElementById("submitBtn");
const adminProductsList = document.getElementById("adminProductsList");

// دریافت و نمایش لیست محصولات در پنل ادمین
async function fetchAdminProducts() {
  try {
    const res = await fetch("/api/products");
    const products = await res.json();

    if (!products || products.length === 0) {
      adminProductsList.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#64748b;">هیچ محصولی ثبت نشده است.</td></tr>`;
      return;
    }

    adminProductsList.innerHTML = products.map(p => {
      const img = p.image_url ? p.image_url : "https://via.placeholder.com/50";
      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px;">
            <img src="${img}" alt="${p.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;" />
          </td>
          <td style="padding: 10px; font-weight: 600;">${p.name}</td>
          <td style="padding: 10px; color: #64748b;">${p.category}</td>
          <td style="padding: 10px; color: #059669; font-weight: 700;">$${Number(p.price).toLocaleString()}</td>
          <td style="padding: 10px; text-align: center;">
            <button onclick="deleteProduct(${p.id}, '${p.name}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">حذف</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    adminProductsList.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:red;">خطا در دریافت لیست محصولات.</td></tr>`;
  }
}

// عملیات حذف محصول
async function deleteProduct(id, name) {
  if (!confirm(`آیا از حذف محصول «${name}» اطمینان دارید؟`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE"
    });
    const data = await res.json();

    if (res.ok && data.ok) {
      alert("محصول با موفقیت حذف شد.");
      fetchAdminProducts(); // بروزرسانی جدول
    } else {
      alert(data.error || "خطا در حذف محصول");
    }
  } catch (err) {
    console.error(err);
    alert("ارتباط با سرور برقرار نشد.");
  }
}

// ثبت فرم محصول جدید
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    statusDiv.textContent = "در حال ذخیره...";
    statusDiv.style.color = "#2563eb";
    submitBtn.disabled = true;

    const formData = new FormData(form);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        statusDiv.textContent = "محصول با موفقیت ذخیره شد!";
        statusDiv.style.color = "#059669";
        form.reset();
        fetchAdminProducts(); // اضافه شدن آیتم جدید به جدول بدون رفرش
      } else {
        statusDiv.textContent = data.error || "خطا در ثبت محصول";
        statusDiv.style.color = "#dc2626";
      }
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "خطای غیرمنتظره در ارتباط با سرور";
      statusDiv.style.color = "#dc2626";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// لود اولیه محصولات هنگام باز شدن صفحه ادمین
fetchAdminProducts();
// تابع دریافت و نمایش سفارش‌ها
async function loadOrders() {
    const container = document.getElementById('ordersContainer');
    
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        
        if (orders.length === 0) {
            container.innerHTML = "<p>هنوز سفارشی ثبت نشده است.</p>";
            return;
        }

        container.innerHTML = orders.map(order => `
            <div style="background: #fff; border: 1px solid #e2e8f0; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                <h3 style="margin-top:0;">سفارش #${order.id} - ${order.total_price.toLocaleString()} تومان</h3>
                <p><strong>مشتری:</strong> ${order.customer_name} - ${order.customer_phone}</p>
                <p><strong>آدرس:</strong> ${order.customer_address}</p>
                <p><strong>تاریخ:</strong> ${order.created_at}</p>
                <strong>اقلام:</strong>
                <ul style="margin: 5px 0;">
                    ${order.items.map(item => `<li>${item.product_name} - تعداد: ${item.quantity}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading orders:", err);
        container.innerHTML = "<p>خطا در دریافت سفارش‌ها</p>";
    }
}

// فراخوانی تابع هنگام لود صفحه
document.addEventListener('DOMContentLoaded', () => {
    // کدهای فعلی شما برای لود محصولات (احتمالا چیزی مثل loadProducts() )
    // loadProducts(); 
    
    // افزودن فراخوانی جدید:
    loadOrders();
});
