let allGroupedProducts = {};
let currentCategory = "hats";

// خواندن سبد خرید از localStorage (اگر قبلا ذخیره شده بود)
let cart = JSON.parse(localStorage.getItem("store_cart")) || [];

// المان‌های DOM
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

// ذخیره در localStorage و بروزرسانی رابط کاربری
function saveCart() {
  localStorage.setItem("store_cart", JSON.stringify(cart));
  updateCartBadge();
  renderCartItems();
}

// بروزرسانی عدد بالای سبد خرید
function updateCartBadge() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (cartCount) {
    cartCount.textContent = totalCount;
  }
}

// دریافت محصولات از بک‌اند
async function loadProducts() {
  try {
    const res = await fetch("/api/products_by_category");
    if (!res.ok) throw new Error("Failed to load products");
    allGroupedProducts = await res.json();

    const firstTab = tabsContainer ? tabsContainer.querySelector(".tab") : null;
    if (firstTab && firstTab.dataset.category) {
      currentCategory = firstTab.dataset.category;
    }

    renderCategory(currentCategory);
    updateCartBadge();
  } catch (err) {
    console.error(err);
    if (grid) {
      grid.innerHTML = `<p style="color:red;">Error loading products.</p>`;
    }
  }
}

// نمایش کارت محصولات برای دسته انتخابی
function renderCategory(category) {
  currentCategory = category;
  if (activeCategoryTitle) {
    activeCategoryTitle.textContent = category.toUpperCase();
  }

  if (tabsContainer) {
    const buttons = tabsContainer.querySelectorAll(".tab");
    buttons.forEach((btn) => {
      if (btn.dataset.category === category) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  const products = allGroupedProducts[category] || [];

  if (products.length === 0) {
    if (grid) grid.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (grid) {
    grid.innerHTML = products.map(createProductCard).join("");
  }
}

// قالب کارت محصول
function createProductCard(p) {
  const imgSrc = p.image_url ? p.image_url : "https://via.placeholder.com/300x200?text=No+Image";
  const desc = p.description ? p.description : "";
  const priceFormatted = Number(p.price).toLocaleString();

  return `
    <article class="card">
      <div class="card-img-wrap">
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" />
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(p.name)}</h3>
        <p class="card-desc">${escapeHtml(desc)}</p>
        <div class="card-footer">
          <span class="card-price">$${priceFormatted}</span>
          <button class="btn-buy" onclick="addToCart(${p.id}, '${escapeHtml(p.name)}', ${p.price}, '${escapeHtml(p.image_url || '')}')">خرید محصول</button>
        </div>
      </div>
    </article>
  `;
}

// افزودن محصول به سبد خرید
window.addToCart = function(id, name, price, imageUrl) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: price,
      imageUrl: imageUrl,
      quantity: 1
    });
  }
  saveCart();
};

// تغییر تعداد محصول (+ یا -)
window.changeQuantity = function(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
};

// حذف کامل یک آیتم
window.removeFromCart = function(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
};

// رندر کردن اقلام درون پنجره سبد خرید
// رندر کردن اقلام درون پنجره سبد خرید
function renderCartItems() {
  if (!cartItemsList) return;

  // ۱. محاسبه مجموع قیمت در هر صورت
  let total = 0;
  cart.forEach(item => {
    total += item.price * item.quantity;
  });

  // ۲. نمایش حالت خالی یا لیست اقلام
  if (cart.length === 0) {
    cartItemsList.innerHTML = `<div style="text-align: center; color: #64748b; padding: 30px 0;">Your cart is empty.</div>`;
    if (cartTotalPrice) cartTotalPrice.textContent = "$0";
    if (checkoutBtn) checkoutBtn.style.display = "none";
    return;
  }

  // اگر کالا داشتیم، دکمه checkout را نشان بده
  if (checkoutBtn) checkoutBtn.style.display = "block";

  // ۳. رندر کردن لیست
  cartItemsList.innerHTML = cart.map(item => {
    const img = item.imageUrl || "https://via.placeholder.com/50";
    return `
      <div class="cart-item">
        <img src="${img}" alt="${escapeHtml(item.name)}" class="cart-item-img" />
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">$${Number(item.price).toLocaleString()}</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeQuantity(${item.id}, -1)">-</button>
          <span class="qty-number">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQuantity(${item.id}, 1)">+</button>
        </div>
        <button class="cart-remove-btn" onclick="removeFromCart(${item.id})" title="Remove">&times;</button>
      </div>
    `;
  }).join("");

  // ۴. بروزرسانی قیمت نهایی
  if (cartTotalPrice) {
    cartTotalPrice.textContent = `$${total.toLocaleString()}`;
  }
}


// هلپر برای جلوگیری از خطای کاراکترها در onclick و HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// باز و بسته شدن مودال
if (cartBtn && cartModal) {
  cartBtn.addEventListener("click", () => {
    if (checkoutForm) {
      checkoutForm.hidden = true;
      checkoutForm.reset();
    }
    if (checkoutStatus) {
      checkoutStatus.textContent = "";
    }
    renderCartItems();
    cartModal.style.display = "flex";
  });
}

if (closeCartBtn && cartModal) {
  closeCartBtn.addEventListener("click", () => {
    cartModal.style.display = "none";
  });
}

// بستن مودال با کلیک روی پس‌زمینه بیرونی
if (cartModal) {
  cartModal.addEventListener("click", (e) => {
    if (e.target === cartModal) {
      cartModal.style.display = "none";
    }
  });
}

// تعویض تب‌ها
if (tabsContainer) {
  tabsContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    const cat = btn.dataset.category;
    renderCategory(cat);
  });
}

// باز کردن فرم Checkout با کلیک روی دکمه
if (checkoutBtn && checkoutForm) {
  checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    if (checkoutStatus) checkoutStatus.textContent = "";
    checkoutForm.hidden = false;
    const nameInput = document.getElementById("customerName");
    if (nameInput) nameInput.focus();
  });
}

// ثبت نهایی سفارش
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (cart.length === 0) {
      if (checkoutStatus) {
        checkoutStatus.style.color = "#ef4444";
        checkoutStatus.textContent = "Your cart is empty.";
      }
      return;
    }

    const formData = new FormData(checkoutForm);
    const orderData = {
      name: (formData.get("name") || "").trim(),
      phone: (formData.get("phone") || "").trim(),
      address: (formData.get("address") || "").trim(),
      items: cart
    };

    if (submitOrderBtn) {
      submitOrderBtn.disabled = true;
      submitOrderBtn.textContent = "Placing order...";
    }
    if (checkoutStatus) checkoutStatus.textContent = "";

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Failed to place order.");
      }

      // ۱. خالی کردن سبد خرید و حافظه
      cart = [];
      localStorage.setItem("store_cart", JSON.stringify(cart));
      updateCartBadge();

      // ۲. ریست و مخفی کردن فرم و دکمه
      checkoutForm.reset();
      checkoutForm.hidden = true;
      if (checkoutBtn) checkoutBtn.style.display = "none";
      if (cartTotalPrice) cartTotalPrice.textContent = `$${result.total_price.toLocaleString()}`;

      // ۳. نمایش کارت تاییدیه سفارش داخل مودال
      if (cartItemsList) {
        cartItemsList.innerHTML = `
          <div style="text-align: center; padding: 35px 15px;">
            <div style="font-size: 46px; color: #10b981; line-height: 1; margin-bottom: 12px;">✓</div>
            <h3 style="color: #1e293b; margin-bottom: 8px; font-size: 1.25rem;">Order Placed Successfully!</h3>
            <p style="color: #475569; font-size: 1rem; margin-bottom: 6px;">
              Your Order ID: <strong style="color: #2563eb;">#${result.order_id}</strong>
            </p>
            <p style="color: #94a3b8; font-size: 0.85rem;">Thank you for your purchase.</p>
          </div>
        `;
      }
    } catch (error) {
      if (checkoutStatus) {
        checkoutStatus.style.color = "#ef4444";
        checkoutStatus.textContent = error.message || "An error occurred. Please try again.";
      } else {
        alert(error.message);
      }
    } finally {
      if (submitOrderBtn) {
        submitOrderBtn.disabled = false;
        submitOrderBtn.textContent = "Place Order";
      }
    }
  });
}

// نمایش فوری نشانگر سبد و سپس واکشی محصولات
// نمایش فوری نشانگر سبد و سپس واکشی محصولات
updateCartBadge();
renderCartItems(); // <--- این را حتما اضافه کن تا در لحظه باز شدن مودال یا لود صفحه، قیمت درست باشد
loadProducts();


// --- Hamburger Menu & Drawer Functionality ---
const openMenuBtn = document.getElementById('openMenuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const menuOverlay = document.getElementById('menuOverlay');
const categoryDrawer = document.getElementById('categoryDrawer');

function openDrawer() {
  if (categoryDrawer && menuOverlay) {
    categoryDrawer.classList.add('open');
    menuOverlay.classList.add('active');
  }
}

function closeDrawer() {
  if (categoryDrawer && menuOverlay) {
    categoryDrawer.classList.remove('open');
    menuOverlay.classList.remove('active');
  }
}

if (openMenuBtn) openMenuBtn.addEventListener('click', openDrawer);
if (closeMenuBtn) closeMenuBtn.addEventListener('click', closeDrawer);
if (menuOverlay) menuOverlay.addEventListener('click', closeDrawer);

// اتصال آیتم‌های منوی کشویی به فیلتر دسته‌بندی
document.querySelectorAll('.drawer-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.drawer-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    const cat = item.getAttribute('data-category');
    // کلیک همزمان روی تب مربوطه در صفحه اصلی
    const matchingTab = document.querySelector(`.tab[data-category="${cat}"]`);
    if (matchingTab) {
      matchingTab.click();
    } else if (cat === 'all') {
      const allTab = document.querySelector('.tab:first-child');
      if (allTab) allTab.click();
    }
    
    closeDrawer();
  });
});
