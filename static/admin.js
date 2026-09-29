// تب‌بندی صفحات پنل
function switchTab(tabId, btnElement) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
  if (btnElement) btnElement.classList.add("active");
}

// فرمت دهی قیمت به تومان و اعداد فارسی
function formatPrice(num) {
  const parts = Number(num || 0).toLocaleString("fa-IR");
  return `${parts} تومان`;
}

// تبدیل اعداد به فارسی
function toPersianDigits(n) {
  return String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

// -----------------------
// 1. دریافت و نمایش آمار (KPIs)
// -----------------------
async function loadStats() {
  try {
    const res = await fetch("/api/admin/stats");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      document.getElementById("statRevenue").textContent = formatPrice(data.total_revenue);
      document.getElementById("statPendingOrders").textContent = toPersianDigits(data.pending_orders);
      document.getElementById("statTotalOrders").textContent = toPersianDigits(data.total_orders);
      document.getElementById("statTotalProducts").textContent = toPersianDigits(data.total_products);
    }
  } catch (err) {
    console.error("Error loading stats:", err);
  }
}

// -----------------------
// 2. مدیریت سفارش‌ها
// -----------------------
async function loadOrders() {
  const container = document.getElementById("ordersContainer");
  if (!container) return;

  try {
    const res = await fetch("/api/orders");
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      container.innerHTML = `<p style="text-align:center; color:#64748b; padding:20px;">هیچ سفارشی ثبت نشده است.</p>`;
      return;
    }

    container.innerHTML = orders.map(order => {
      const currentStatus = order.status || "pending";
      return `
        <div class="order-card">
          <div class="order-header">
            <span class="order-id">سفارش #${toPersianDigits(order.id)}</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:0.85rem; margin:0;">وضعیت:</label>
              <select onchange="updateOrderStatus(${order.id}, this.value)" style="padding:4px 8px; font-size:0.85rem; border-radius:6px; border:1px solid #cbd5e1;">
                <option value="pending" ${currentStatus === "pending" ? "selected" : ""}>در انتظار بررسی</option>
                <option value="processing" ${currentStatus === "processing" ? "selected" : ""}>در حال آماده‌سازی</option>
                <option value="completed" ${currentStatus === "completed" ? "selected" : ""}>تکمیل / ارسال شده</option>
                <option value="cancelled" ${currentStatus === "cancelled" ? "selected" : ""}>لغو شده</option>
              </select>
            </div>
            <span class="order-price">${formatPrice(order.total_price)}</span>
          </div>

          <div class="order-meta">
            <div><strong>مشتری:</strong> ${order.customer_name} (${toPersianDigits(order.customer_phone)})</div>
            <div><strong>تاریخ:</strong> ${toPersianDigits(order.created_at || "")}</div>
            <div style="grid-column: 1 / -1;"><strong>آدرس گیرنده:</strong> ${order.customer_address}</div>
          </div>

          <div class="order-items-box">
            <strong>اقلام سفارش:</strong>
            <ul style="margin: 6px 18px 0 0;">
              ${(order.items || []).map(i => {
                const colorBadge = i.selected_color 
                  ? `<span style="background:#e2e8f0; color:#1e293b; padding:1px 6px; border-radius:4px; font-size:0.75rem; margin-right:4px;">(رنگ: ${i.selected_color})</span>` 
                  : "";
                return `<li>${i.product_name} ${colorBadge} - تعداد: ${toPersianDigits(i.quantity)} × ${formatPrice(i.price)}</li>`;
              }).join("")}
            </ul>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading orders:", err);
    container.innerHTML = `<p style="color:red; text-align:center;">خطا در دریافت سفارش‌ها.</p>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      loadStats();
    } else {
      alert(data.error || "خطا در تغییر وضعیت");
    }
  } catch (err) {
    console.error(err);
    alert("ارتباط با سرور برقرار نشد.");
  }
}

// -----------------------
// 3. دریافت و نمایش محصولات
// -----------------------
let allProductsCache = [];

async function fetchAdminProducts() {
  const list = document.getElementById("adminProductsList");
  if (!list) return;

  try {
    const res = await fetch("/api/products");
    allProductsCache = await res.json();

    if (!allProductsCache || allProductsCache.length === 0) {
      list.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b;">هیچ محصولی ثبت نشده است.</td></tr>`;
      return;
    }

    list.innerHTML = allProductsCache.map(p => {
      const img = p.image_url ? p.image_url : "https://via.placeholder.com/50";
      const variantCount = (p.variants && p.variants.length) || 0;
      return `
        <tr>
          <td>
            <img src="${img}" alt="${p.name}" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #e2e8f0;" onerror="this.src='https://via.placeholder.com/48'" />
          </td>
          <td style="font-weight: 600;">${p.name}</td>
          <td style="color: #64748b;">${p.category}</td>
          <td style="color: #059669; font-weight: 700;">${formatPrice(p.price)}</td>
          <td>
            <span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-size:0.8rem; font-weight:600;">
              ${toPersianDigits(variantCount)} رنگ
            </span>
          </td>
          <td style="text-align: center;">
            <button onclick="openVariantModal(${p.id})" class="action-btn btn-variant">🎨 رنگ‌ها</button>
            <button onclick="openEditModal(${p.id})" class="action-btn btn-edit">ویرایش</button>
            <button onclick="deleteProduct(${p.id}, '${p.name}')" class="action-btn btn-delete">حذف</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:red;">خطا در دریافت لیست محصولات.</td></tr>`;
  }
}

// عملیات حذف محصول
async function deleteProduct(id, name) {
  if (!confirm(`آیا از حذف محصول «${name}» اطمینان دارید؟`)) return;

  try {
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    const data = await res.json();

    if (res.ok && data.ok) {
      fetchAdminProducts();
      loadStats();
    } else {
      alert(data.error || "خطا در حذف محصول");
    }
  } catch (err) {
    console.error(err);
    alert("ارتباط با سرور برقرار نشد.");
  }
}

// -----------------------
// 4. فرم ثبت محصول جدید
// -----------------------
function setupAddProductForm() {
  const form = document.getElementById("productForm");
  const statusDiv = document.getElementById("status");
  const submitBtn = document.getElementById("submitBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    statusDiv.textContent = "در حال ذخیره و آپلود...";
    statusDiv.style.color = "#2563eb";
    if (submitBtn) submitBtn.disabled = true;

    const formData = new FormData(form);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        statusDiv.textContent = "محصول با موفقیت ذخیره شد!";
        statusDiv.style.color = "#059669";
        form.reset();
        fetchAdminProducts();
        loadStats();
        setTimeout(() => {
          const productTabBtn = document.querySelectorAll(".tab-btn")[1];
          switchTab("productsTab", productTabBtn);
          statusDiv.textContent = "";
        }, 1200);
      } else {
        statusDiv.textContent = data.error || "خطا در ثبت محصول";
        statusDiv.style.color = "#dc2626";
      }
    } catch (err) {
      console.error(err);
      statusDiv.textContent = "خطای غیرمنتظره در ارسال اطلاعات";
      statusDiv.style.color = "#dc2626";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// -----------------------
// 5. فرم و مودال ویرایش محصول
// -----------------------
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editProductForm");
const editStatus = document.getElementById("editStatus");

function openEditModal(productId) {
  const prod = allProductsCache.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById("edit_prod_id").value = prod.id;
  document.getElementById("edit_prod_name").value = prod.name;
  document.getElementById("edit_prod_category").value = prod.category;
  document.getElementById("edit_prod_price").value = prod.price;
  document.getElementById("edit_prod_image_url").value = prod.image_url || "";
  document.getElementById("edit_prod_description").value = prod.description || "";
  editStatus.textContent = "";

  editModal.classList.add("open");
}

function closeEditModal() {
  editModal.classList.remove("open");
}

function setupEditProductForm() {
  if (!editForm) return;

  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    editStatus.textContent = "در حال ذخیره تغییرات...";
    editStatus.style.color = "#2563eb";

    const prodId = document.getElementById("edit_prod_id").value;
    const formData = new FormData(editForm);

    try {
      const res = await fetch(`/api/admin/products/${prodId}`, {
        method: "PUT",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        editStatus.textContent = "محصول با موفقیت ویرایش شد!";
        editStatus.style.color = "#059669";
        fetchAdminProducts();
        setTimeout(closeEditModal, 900);
      } else {
        editStatus.textContent = data.error || "خطا در ویرایش محصول";
        editStatus.style.color = "#dc2626";
      }
    } catch (err) {
      console.error(err);
      editStatus.textContent = "خطا در برقراری ارتباط با سرور";
      editStatus.style.color = "#dc2626";
    }
  });
}

// -----------------------
// 6. مودال مدیریت تنوع رنگ (Variants)
// -----------------------
const variantModal = document.getElementById("variantModal");
const addVariantForm = document.getElementById("addVariantForm");
const variantStatus = document.getElementById("variantStatus");
const variantsListContainer = document.getElementById("variantsListContainer");

let currentManagingProductId = null;

function openVariantModal(productId) {
  currentManagingProductId = productId;
  const prod = allProductsCache.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById("variantProductId").value = prod.id;
  document.getElementById("variantProductTitle").textContent = `محصول: ${prod.name}`;
  document.getElementById("variantColorName").value = "";
  document.getElementById("variantImageFile").value = "";
  document.getElementById("variantImageUrl").value = "";
  variantStatus.textContent = "";

  renderProductVariantsList(prod);
  variantModal.classList.add("open");
}

function closeVariantModal() {
  variantModal.classList.remove("open");
}

function renderProductVariantsList(prod) {
  if (!prod.variants || prod.variants.length === 0) {
    variantsListContainer.innerHTML = `<p style="color:#64748b; font-size:0.88rem; text-align:center; padding:12px;">هیچ رنگی برای این محصول ثبت نشده است.</p>`;
    return;
  }

  variantsListContainer.innerHTML = prod.variants.map(v => {
    return `
      <div class="variant-item">
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${v.image_url}" class="variant-preview" onerror="this.src='https://via.placeholder.com/38'" />
          <span style="font-weight:600; font-size:0.9rem;">${v.color_name}</span>
        </div>
        <button onclick="deleteVariant(${v.id})" class="action-btn btn-delete" style="font-size:0.75rem;">حذف</button>
      </div>
    `;
  }).join("");
}

// ثبت رنگ جدید
function setupVariantForm() {
  if (!addVariantForm) return;

  addVariantForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const productId = currentManagingProductId;
    const colorName = document.getElementById("variantColorName").value.trim();
    const fileInput = document.getElementById("variantImageFile");
    const imageUrl = document.getElementById("variantImageUrl").value.trim();

    if (!colorName) {
      variantStatus.textContent = "نام رنگ الزامی است.";
      variantStatus.style.color = "#dc2626";
      return;
    }

    if (!fileInput.files[0] && !imageUrl) {
      variantStatus.textContent = "آپلود تصویر یا وارد کردن لینک عکس الزامی است.";
      variantStatus.style.color = "#dc2626";
      return;
    }

    variantStatus.textContent = "در حال ذخیره...";
    variantStatus.style.color = "#2563eb";

    const formData = new FormData();
    formData.append("color_name", colorName);
    if (fileInput.files[0]) {
      formData.append("image_file", fileInput.files[0]);
    }
    if (imageUrl) {
      formData.append("image_url", imageUrl);
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        variantStatus.textContent = "رنگ با موفقیت اضافه شد!";
        variantStatus.style.color = "#059669";
        
        // بازخوانی لیست محصولات برای آپدیت کش
        await fetchAdminProducts();
        const updatedProd = allProductsCache.find(p => p.id === productId);
        if (updatedProd) {
          renderProductVariantsList(updatedProd);
        }

        addVariantForm.reset();
        setTimeout(() => { variantStatus.textContent = ""; }, 1500);
      } else {
        variantStatus.textContent = data.error || "خطا در ثبت رنگ";
        variantStatus.style.color = "#dc2626";
      }
    } catch (err) {
      console.error(err);
      variantStatus.textContent = "خطا در ارتباط با سرور";
      variantStatus.style.color = "#dc2626";
    }
  });
}

// حذف رنگ
async function deleteVariant(variantId) {
  if (!confirm("آیا از حذف این رنگ اطمینان دارید؟")) return;

  try {
    const res = await fetch(`/api/admin/variants/${variantId}`, { method: "DELETE" });
    const data = await res.json();

    if (res.ok && data.ok) {
      await fetchAdminProducts();
      const updatedProd = allProductsCache.find(p => p.id === currentManagingProductId);
      if (updatedProd) {
        renderProductVariantsList(updatedProd);
      }
    } else {
      alert(data.error || "خطا در حذف رنگ");
    }
  } catch (err) {
    console.error(err);
    alert("خطا در برقراری ارتباط با سرور");
  }
}

// -----------------------
// راه‌اندازی اولیه صفحه
// -----------------------
document.addEventListener("DOMContentLoaded", () => {
  setupAddProductForm();
  setupEditProductForm();
  setupVariantForm();
  loadStats();
  loadOrders();
  fetchAdminProducts();
});
