let allGroupedProducts = {};
let currentCategory = "all";

// سبد خرید ذخیره‌شده در localStorage
let cart = JSON.parse(localStorage.getItem("store_cart")) || [];

// نگهداری وضعیت رنگ انتخاب شده هر محصول در حافظه موقت (product_id -> { colorName, imageUrl })
const selectedVariants = {};

// نام فارسی دسته‌ها جهت نمایش عنوان
const categoryNamesMap = {
  all: "همه محصولات",
  hats: "کلاه",
  necklaces: "گردنبند و اکسسوری",
  watches: "ساعت مچی",
  socks: "جوراب فانتزی",
  mugs: "ماگ و لیوان",
  bags: "کیف و کوله"
};

// المان‌های صفحه
const tabsContainer = document.getElementById("categoryTabs");
const grid = document.getElementById("productsGrid");
const emptyState = document.getElementById("emptyState");
const activeCategoryTitle = document.getElementById("activeCategoryTitle");

// المان‌های سبد خرید
const cartBtn = document.getElementById("cartBtn");
const cartCount = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartItemsList = document.getElementById("cartItemsList");
const cartTotalPrice = document.getElementById("cartTotalPrice");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutStatus = document.getElementById("checkoutStatus");
const submitOrderBtn = document.getElementById("submitOrderBtn");

// المان کانتینر اعلان‌ها (Toast)
const toastContainer = document.getElementById("toastContainer");

// --------------------
// کمکی: ضداسکریپت و ایمن‌سازی متون
// --------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --------------------
// نمایش قیمت به تومان با اعداد فارسی
// --------------------
function formatToman(amount) {
  const n = Number(amount || 0);
  return `${n.toLocaleString("fa-IR")} تومان`;
}

// --------------------
// نمایش اعلان شیک (Toast)
// --------------------
function showToast(message, type = "success") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="t-icon">${type === "error" ? "✕" : "✓"}</div>
    <div class="t-text">${escapeHtml(message)}</div>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastOut 0.2s ease-out forwards";
    setTimeout(() => toast.remove(), 250);
  }, 2300);
}

// --------------------
// مدیریت داده‌های سبد خرید
// --------------------
function saveCart() {
  localStorage.setItem("store_cart", JSON.stringify(cart));
  updateCartBadge();
  renderCartItems();
}

function updateCartBadge() {
  const totalCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  if (cartCount) cartCount.textContent = totalCount.toLocaleString("fa-IR");
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
}

// --------------------
// دریافت محصولات از بک‌اند
// --------------------
async function loadProducts() {
  try {
    const res = await fetch("/api/products_by_category");
    if (!res.ok) throw new Error("خطا در بارگذاری محصولات");
    allGroupedProducts = await res.json();
    renderCategory(currentCategory);
    updateCartBadge();
  } catch (err) {
    console.error(err);
    if (grid) grid.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">خطا در دریافت لیست محصولات.</p>`;
  }
}

// --------------------
// نمایش محصولات بر اساس دسته‌بندی
// --------------------
function renderCategory(category) {
  currentCategory = category;

  if (activeCategoryTitle) {
    activeCategoryTitle.textContent = categoryNamesMap[category] || category.toUpperCase();
  }

  if (tabsContainer) {
    tabsContainer.querySelectorAll(".tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.category === category);
    });
  }

  let products = [];
  if (category === "all") {
    products = Object.values(allGroupedProducts).flat();
  } else {
    products = allGroupedProducts[category] || [];
  }

  if (products.length === 0) {
    if (grid) grid.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (grid) grid.innerHTML = products.map(createProductCard).join("");
}

// --------------------
// تغییر رنگ محصول در کارت
// --------------------
window.selectProductColor = function(productId, colorName, imageUrl, element) {
  selectedVariants[productId] = {
    colorName: colorName,
    imageUrl: imageUrl
  };

  const cardImg = document.getElementById(`product-img-${productId}`);
  if (cardImg && imageUrl) {
    cardImg.src = imageUrl;
  }

  const container = element.parentElement;
  if (container) {
    container.querySelectorAll(".color-chip").forEach(chip => chip.classList.remove("active-color"));
    element.classList.add("active-color");
  }
};

// --------------------
// کارت هر محصول
// --------------------
function createProductCard(p) {
  const imgSrc = p.image_url ? p.image_url : "https://via.placeholder.com/300x200?text=No+Image";
  const desc = p.description ? p.description : "";
  const priceLabel = formatToman(p.price);

  const hasVariants = p.variants && p.variants.length > 0;
  if (hasVariants && !selectedVariants[p.id]) {
    selectedVariants[p.id] = {
      colorName: p.variants[0].color_name,
      imageUrl: p.variants[0].image_url
    };
  }

  const currentSelection = selectedVariants[p.id] || { colorName: "", imageUrl: imgSrc };
  const displayImage = currentSelection.imageUrl || imgSrc;

  let variantsHtml = "";
  if (hasVariants) {
    const chips = p.variants.map((v) => {
      const isSelected = (currentSelection.colorName === v.color_name);
      return `
        <button type="button" 
          class="color-chip ${isSelected ? 'active-color' : ''}" 
          onclick='selectProductColor(${p.id}, ${JSON.stringify(v.color_name || "")}, ${JSON.stringify(v.image_url || "")}, this)'
          title="${escapeHtml(v.color_name)}">
          ${escapeHtml(v.color_name)}
        </button>
      `;
    }).join("");

    variantsHtml = `
      <div class="product-variants-wrap" style="display:flex; gap:6px; flex-wrap:wrap; margin: 8px 0;">
        ${chips}
      </div>
    `;
  }

  return `
    <article class="card">
      <div class="card-img-wrap">
        <img id="product-img-${p.id}" src="${displayImage}" alt="${escapeHtml(p.name)}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(p.name)}</h3>
        <p class="card-desc">${escapeHtml(desc)}</p>
        ${variantsHtml}
        <div class="card-footer">
          <span class="card-price">${priceLabel}</span>
          <button class="btn-buy"
            onclick='addToCart(${Number(p.id)}, ${JSON.stringify(String(p.name || ""))}, ${Number(p.price || 0)})'>
            افزودن به سبد
          </button>
        </div>
      </div>
    </article>
  `;
}

// --------------------
// توابع عملیات سبد خرید
// --------------------
window.addToCart = function (id, name, price) {
  const currentSelection = selectedVariants[id] || { colorName: "", imageUrl: "" };
  const selectedColor = currentSelection.colorName || "";
  const imageUrl = currentSelection.imageUrl || "";

  const existing = cart.find((item) => item.id === id && item.selected_color === selectedColor);
  
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: Number(id),
      name: String(name),
      price: Number(price || 0),
      imageUrl: String(imageUrl || ""),
      quantity: 1,
      selected_color: selectedColor
    });
  }

  saveCart();
  const msg = selectedColor ? `محصول (${selectedColor}) به سبد اضافه شد` : "محصول به سبد اضافه شد";
  showToast(msg);
};

window.changeQuantity = function (id, selectedColor, delta) {
  const item = cart.find((i) => i.id === id && (i.selected_color || "") === (selectedColor || ""));
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((i) => !(i.id === id && (i.selected_color || "") === (selectedColor || "")));
    showToast("محصول از سبد حذف شد");
  } else {
    showToast("سبد خرید به‌روزرسانی شد");
  }
  saveCart();
};

window.removeFromCart = function (id, selectedColor) {
  cart = cart.filter((i) => !(i.id === id && (i.selected_color || "") === (selectedColor || "")));
  saveCart();
  showToast("محصول از سبد حذف شد");
};

// --------------------
// رندر اقلام در مودال سبد خرید
// --------------------
function renderCartItems() {
  if (!cartItemsList) return;

  const total = cartTotal();

  if (cart.length === 0) {
    cartItemsList.innerHTML = `
      <div style="text-align:center; color:#64748b; padding: 36px 0;">
        سبد خرید شما خالی است.
      </div>
    `;
    if (cartTotalPrice) cartTotalPrice.textContent = formatToman(0);
    if (checkoutBtn) checkoutBtn.style.display = "none";
    if (checkoutForm) checkoutForm.hidden = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.style.display = "block";

  cartItemsList.innerHTML = cart
    .map((item) => {
      const img = item.imageUrl || "https://via.placeholder.com/60";
      const unit = formatToman(item.price);
      const line = formatToman(Number(item.price) * Number(item.quantity));
      const colorTag = item.selected_color 
        ? `<span class="cart-color-tag" style="background:#f1f5f9; color:#475569; font-size:0.75rem; padding:2px 8px; border-radius:12px; margin-right:6px;">رنگ: ${escapeHtml(item.selected_color)}</span>` 
        : "";

      return `
        <div class="cart-item">
          <img src="${img}" alt="${escapeHtml(item.name)}" class="cart-item-img" />
          <div class="cart-item-info">
            <div class="cart-item-title">
              ${escapeHtml(item.name)}
              ${colorTag}
            </div>
            <div class="cart-item-sub">
              <span>فی: ${unit}</span>
              <span>مجموع: ${line}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="cart-item-controls">
              <button class="qty-btn" onclick='changeQuantity(${item.id}, ${JSON.stringify(item.selected_color || "")}, -1)' aria-label="کم کردن">−</button>
              <span class="qty-number">${item.quantity}</span>
              <button class="qty-btn" onclick='changeQuantity(${item.id}, ${JSON.stringify(item.selected_color || "")}, 1)' aria-label="زیاد کردن">+</button>
            </div>
            <button class="cart-remove-btn" onclick='removeFromCart(${item.id}, ${JSON.stringify(item.selected_color || "")})' aria-label="حذف" title="حذف">✕</button>
          </div>
        </div>
      `;
    })
    .join("");

  if (cartTotalPrice) cartTotalPrice.textContent = formatToman(total);
}

// --------------------
// رویدادهای مودال سبد خرید
// --------------------
if (cartBtn && cartModal) {
  cartBtn.addEventListener("click", () => {
    if (checkoutForm) {
      checkoutForm.hidden = true;
      checkoutForm.reset();
    }
    if (checkoutStatus) checkoutStatus.textContent = "";
    renderCartItems();
    cartModal.style.display = "flex";
  });
}

if (closeCartBtn && cartModal) {
  closeCartBtn.addEventListener("click", () => {
    cartModal.style.display = "none";
  });
}

if (cartModal) {
  cartModal.addEventListener("click", (e) => {
    if (e.target === cartModal) cartModal.style.display = "none";
  });
}

// تغییر دسته‌بندی با کلیک روی تب‌ها
if (tabsContainer) {
  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    renderCategory(btn.dataset.category);
  });
}

// --------------------
// ثبت سفارش (Checkout)
// --------------------
if (checkoutBtn && checkoutForm) {
  checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) {
      showToast("سبد خرید خالی است", "error");
      return;
    }
    if (checkoutStatus) checkoutStatus.textContent = "";
    checkoutForm.hidden = false;
    const nameInput = document.getElementById("customerName");
    if (nameInput) nameInput.focus();
  });
}

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (cart.length === 0) {
      if (checkoutStatus) {
        checkoutStatus.style.color = "#ef4444";
        checkoutStatus.textContent = "سبد خرید خالی است.";
      }
      showToast("سبد خرید خالی است", "error");
      return;
    }

    const formData = new FormData(checkoutForm);
    const orderData = {
      name: (formData.get("name") || "").trim(),
      phone: (formData.get("phone") || "").trim(),
      address: (formData.get("address") || "").trim(),
      items: cart,
    };

    if (submitOrderBtn) {
      submitOrderBtn.disabled = true;
      submitOrderBtn.textContent = "در حال ثبت...";
    }
    if (checkoutStatus) checkoutStatus.textContent = "";

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "ثبت سفارش ناموفق بود.");
      }

      // خالی کردن سبد خرید محلی
      cart = [];
      localStorage.setItem("store_cart", JSON.stringify(cart));
      updateCartBadge();

      checkoutForm.reset();
      checkoutForm.hidden = true;
      if (checkoutBtn) checkoutBtn.style.display = "none";
      if (cartTotalPrice) cartTotalPrice.textContent = "۰ تومان";

      if (cartItemsList) {
        cartItemsList.innerHTML = `
          <div style="text-align:center; padding: 30px 10px;">
            <div style="font-size: 42px; color: #10b981; line-height: 1; margin-bottom: 10px;">✓</div>
            <h3 style="color:#1e293b; margin-bottom: 6px; font-size: 1.1rem;">سفارش شما با موفقیت ثبت شد</h3>
            <p style="color:#475569; font-size: 0.95rem; margin-bottom: 6px;">
              شماره پیگیری: <strong style="color:#2563eb;">#${escapeHtml(result.order_id)}</strong>
            </p>
            <p style="color:#94a3b8; font-size: 0.82rem;">همکاران ما به زودی جهت ارسال با شما تماس می‌گیرند.</p>
          </div>
        `;
      }

      showToast("سفارش با موفقیت ثبت شد");
    } catch (error) {
      if (checkoutStatus) {
        checkoutStatus.style.color = "#ef4444";
        checkoutStatus.textContent = error.message || "خطا در ثبت سفارش.";
      }
      showToast(error.message || "خطا در ثبت سفارش", "error");
    } finally {
      if (submitOrderBtn) {
        submitOrderBtn.disabled = false;
        submitOrderBtn.textContent = "ثبت نهایی سفارش";
      }
    }
  });
}

// --------------------
// منوی کشویی موبایل (Drawer)
// --------------------
const openMenuBtn = document.getElementById("openMenuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const categoryDrawer = document.getElementById("categoryDrawer");

function openDrawer() {
  if (categoryDrawer && menuOverlay) {
    categoryDrawer.classList.add("open");
    menuOverlay.classList.add("active");
  }
}

function closeDrawer() {
  if (categoryDrawer && menuOverlay) {
    categoryDrawer.classList.remove("open");
    menuOverlay.classList.remove("active");
  }
}

if (openMenuBtn) openMenuBtn.addEventListener("click", openDrawer);
if (closeMenuBtn) closeMenuBtn.addEventListener("click", closeDrawer);
if (menuOverlay) menuOverlay.addEventListener("click", closeDrawer);

document.querySelectorAll(".drawer-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".drawer-item").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");

    const cat = item.getAttribute("data-category");
    renderCategory(cat);
    closeDrawer();
  });
});

// --------------------
// اجرای اولیه
// --------------------
updateCartBadge();
loadProducts();
