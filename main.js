'use strict';

/* ==========================================================================
   RARE VISION — main.js
   Vanilla JS Storefront Core Engine & Dynamic Catalog Routing
   ========================================================================== */

const CATEGORY_GROUPS = {
  Shoes: ['Sneakers'],
  Clothes: ['Jackets', 'T-Shirts'],
  Accessories: ['Watches', 'Hats', 'Accessories'],
};

const BRAND_LOGOS = [
  { name: 'Louis Vuitton', slug: 'louis-vuitton' },
  { name: 'Gucci', slug: 'gucci' },
  { name: 'Chanel', slug: 'chanel' },
  { name: 'Hermès', slug: 'hermes' },
  { name: 'Zara', slug: 'zara' },
  { name: 'H&M', slug: 'hm' },
  { name: 'Tommy Hilfiger', slug: 'tommy-hilfiger' },
  { name: 'Calvin Klein', slug: 'calvin-klein' },
  { name: 'Nike', slug: 'nike' },
  { name: 'Adidas', slug: 'adidas' },
  { name: 'American Eagle', slug: 'american-eagle' },
  { name: 'Puma', slug: 'puma' },
  { name: 'Lacoste', slug: 'lacoste' },
  { name: 'U.S. Polo Assn.', slug: 'us-polo-assn' },
  { name: 'New Balance', slug: 'new-balance' },
  { name: 'Coach', slug: 'coach' },
  { name: 'Casio', slug: 'casio' },
];

const FALLBACK_PRODUCTS = [
  {
    id: 'sample-1',
    name: 'Rare Vision Classic Runner Sneaker',
    brand: 'Rare Vision',
    styleName: 'Classic Runner',
    productType: 'Sneakers',
    gender: 'Unisex',
    price: 1200,
    compareAtPrice: 1500,
    sizes: ['38', '39', '40', '41', '42', '43', '44'],
    colors: ['#1a1a1a', '#f5f5f5', '#8a1f1f'],
    image: 'https://picsum.photos/seed/rarevision-sample-1/900/1100',
    images: [
      'https://picsum.photos/seed/rarevision-sample-1/900/1100',
      'https://picsum.photos/seed/rarevision-sample-2/900/1100',
    ],
    shortDescription: 'A clean, everyday runner built for all-day comfort.',
    description: 'The Classic Runner pairs a lightweight knit upper with a cushioned midsole.',
    status: 'active',
    soldCount: 42,
    createdAt: new Date(),
  },
];

const PRODUCTS_PER_PAGE = 10;
const DISCOUNT_POPUP_DELAY_MS = 120000;
const DISCOUNT_POPUP_CODE = 'RV03';
const DISCOUNT_POPUP_SEEN_KEY = 'rvDiscountPopupSeen';
const DISCOUNT_POPUP_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

const state = {
  products: [],
  filtered: [],
  activeCategory: 'all',
  activeGender: 'all',
  activeFilter: 'all', // 'all' | 'new-arrivals' | 'best-sellers'
  sortBy: 'default',
  searchTerm: '',
  currentPage: 1,
  cart: [],
  discount: null,
};

const dom = {
  newArrivalsGrid: document.getElementById('newArrivalsGrid'),
  bestSellersGrid: document.getElementById('bestSellersGrid'),
  brandTrack: document.getElementById('brandTrack'),

  productsGrid: document.getElementById('productsGrid'),
  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  paginationControls: document.getElementById('paginationControls'),
  resultsMeta: document.getElementById('resultsMeta'),
  searchInput: document.getElementById('searchInput'),
  searchClear: document.getElementById('searchClear'),
  categoryPills: document.getElementById('categoryPills'),
  resetFilters: document.getElementById('resetFilters'),

  genderDropdown: document.getElementById('genderDropdown'),
  genderDropdownBtn: document.getElementById('genderDropdownBtn'),
  genderDropdownLabel: document.getElementById('genderDropdownLabel'),
  genderDropdownMenu: document.getElementById('genderDropdownMenu'),
  sortSelect: document.getElementById('sortSelect'),
  shopCatalogTitle: document.getElementById('shopCatalogTitle'),

  navToggle: document.getElementById('navToggle'),
  cartToggle: document.getElementById('cartToggle'),
  cartClose: document.getElementById('cartClose'),
  cartOverlay: document.getElementById('cartOverlay'),
  cartPanel: document.getElementById('cartPanel'),
  cartBadge: document.getElementById('cartBadge'),
  cartItems: document.getElementById('cartItems'),
  cartEmpty: document.getElementById('cartEmpty'),
  cartEmptyShop: document.getElementById('cartEmptyShop'),
  cartTotal: document.getElementById('cartTotal'),
  cartFooter: document.getElementById('cartFooter'),
  checkoutBtn: document.getElementById('checkoutBtn'),

  shippingAccordion: document.getElementById('shippingAccordion'),
  shippingAccordionTrigger: document.getElementById('shippingAccordionTrigger'),
  shippingAccordionPanel: document.getElementById('shippingAccordionPanel'),

  discountAccordion: document.getElementById('discountAccordion'),
  discountAccordionTrigger: document.getElementById('discountAccordionTrigger'),
  discountAccordionPanel: document.getElementById('discountAccordionPanel'),
  cartDiscountInput: document.getElementById('cartDiscountInput'),
  cartApplyDiscountBtn: document.getElementById('cartApplyDiscountBtn'),
  cartDiscountMessage: document.getElementById('cartDiscountMessage'),
  cartDiscountRow: document.getElementById('cartDiscountRow'),
  cartDiscountRowLabel: document.getElementById('cartDiscountRowLabel'),
  cartDiscountRowAmount: document.getElementById('cartDiscountRowAmount'),

  freeShippingBar: document.getElementById('freeShippingBar'),
  freeShippingText: document.getElementById('freeShippingText'),
  freeShippingFill: document.getElementById('freeShippingFill'),

  cartSubtotalBlock: document.getElementById('cartSubtotalBlock'),
  cartSubtotalAmount: document.getElementById('cartSubtotalAmount'),
  cartSubtotalShippingNote: document.getElementById('cartSubtotalShippingNote'),

  cartUpsell: document.getElementById('cartUpsell'),
  cartUpsellTrack: document.getElementById('cartUpsellTrack'),

  accountToggle: document.getElementById('accountToggle'),
  signinOverlay: document.getElementById('signinOverlay'),
  signinPanel: document.getElementById('signinPanel'),
  signinClose: document.getElementById('signinClose'),
  signinForm: document.getElementById('signinForm'),
  signinEmail: document.getElementById('signinEmail'),
  signinPassword: document.getElementById('signinPassword'),
  signinPasswordToggle: document.getElementById('signinPasswordToggle'),
  forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
  signinFormError: document.getElementById('signinFormError'),
  signinFormSuccess: document.getElementById('signinFormSuccess'),
  signinSubmitBtn: document.getElementById('signinSubmitBtn'),

  discountPopupOverlay: document.getElementById('discountPopupOverlay'),
  discountPopup: document.getElementById('discountPopup'),
  discountPopupClose: document.getElementById('discountPopupClose'),
  discountPopupForm: document.getElementById('discountPopupForm'),
  discountPopupEmail: document.getElementById('discountPopupEmail'),
  discountPopupError: document.getElementById('discountPopupError'),
  discountPopupSubmit: document.getElementById('discountPopupSubmit'),
  discountPopupSuccess: document.getElementById('discountPopupSuccess'),
  discountPopupCode: document.getElementById('discountPopupCode'),
  discountPopupDone: document.getElementById('discountPopupDone'),
  discountPopupDismiss: document.getElementById('discountPopupDismiss'),

  toast: document.getElementById('toast'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  state.cart = loadCart();
  state.discount = loadDiscount();
  updateCartBadge();
  renderCart();

  if (dom.brandTrack) renderBrandMarquee();
  bindStaticEvents();

  logVisitorPing();
  scheduleGuestDiscountPopup();

  if (window.RareVisionAuth) {
    window.RareVisionAuth.onAuthChange(updateAccountButtonUI);
    window.RareVisionAuth.onAuthChange(handleAuthChangeForDiscountPopup);
  }

  // Parse URL Parameters for Catalog Dynamic Routing
  parseUrlParameters();

  state.products = await loadProducts();
  if (state.products.length === 0) {
    if (dom.loadingState) dom.loadingState.innerHTML = '<p>Could not load products. Please check your network or Firestore setup.</p>';
    renderCart();
    return;
  }

  if (dom.loadingState) dom.loadingState.hidden = true;
  if (dom.newArrivalsGrid) renderNewArrivals();
  if (dom.bestSellersGrid) renderBestSellers();

  applyFilters();
  renderCart();
}

function parseUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  const catParam = urlParams.get('cat') || urlParams.get('category');
  const searchParam = urlParams.get('q') || urlParams.get('search');
  const genderParam = urlParams.get('gender');
  const sortParam = urlParams.get('sort');

  if (filterParam) {
    state.activeFilter = filterParam.toLowerCase();
  }
  if (catParam) {
    state.activeCategory = catParam;
  }
  if (genderParam) {
    state.activeGender = genderParam;
  }
  if (searchParam && dom.searchInput) {
    dom.searchInput.value = searchParam;
    state.searchTerm = searchParam.trim().toLowerCase();
    if (dom.searchClear) dom.searchClear.hidden = false;
  }
  if (sortParam && dom.sortSelect) {
    state.sortBy = sortParam;
    dom.sortSelect.value = sortParam;
  }

  if (urlParams.get('signin') === '1') openSignin();
  if (urlParams.get('cart') === '1') openCart();
}

async function loadProducts() {
  try {
    if (window.RareVisionFirebase && typeof window.RareVisionFirebase.fetchProducts === 'function') {
      const products = await window.RareVisionFirebase.fetchProducts();
      if (Array.isArray(products) && products.length > 0) return products;
    }
  } catch (err) {
    console.error('Failed to load products from Firestore', err);
  }
  return FALLBACK_PRODUCTS;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function renderNewArrivals() {
  if (!dom.newArrivalsGrid) return;
  const items = [...state.products]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 3);
  dom.newArrivalsGrid.innerHTML = items.map((p) => homeProductCardHtml(p)).join('');
}

function renderBestSellers() {
  if (!dom.bestSellersGrid) return;
  const items = [...state.products]
    .sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0))
    .slice(0, 3);
  dom.bestSellersGrid.innerHTML = items.map((p, i) => homeProductCardHtml(p, i + 1)).join('');
}

function homeProductCardHtml(p, rank) {
  const onSale = typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.price;
  const discountPct = onSale ? Math.round(((p.compareAtPrice - p.price) / p.compareAtPrice) * 100) : 0;
  const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
  const available = isProductAvailable(p);
  const badges = Array.isArray(p.badges) ? p.badges : [];
  const colors = Array.isArray(p.colors) ? p.colors : [];
  const fitSpec = (p.specifications || []).find((s) => (s.label || '').toLowerCase() === 'fit');
  const subtitle = fitSpec ? fitSpec.value : '';

  const cornerBadge = onSale
    ? `<span class="home-badge sale">${discountPct}% OFF</span>`
    : badges[0]
    ? `<span class="home-badge">${escapeHtml(badges[0])}</span>`
    : '';
  const rankBadge = rank ? `<span class="home-rank-badge">#${rank}</span>` : '';
  const ctaLabel = !available ? 'Out of Stock' : hasSizes ? 'Choose Options' : 'Add to Cart';
  const ctaAction = hasSizes ? 'view-product' : 'quick-add';

  return `
  <article class="home-card" data-id="${escapeHtml(p.id)}">
    <div class="home-card-media" data-action="view-product" data-id="${escapeHtml(p.id)}">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      ${cornerBadge}
      ${rankBadge}
      ${!available ? '<div class="out-of-stock">Out of Stock</div>' : ''}
      <button class="choose-options-btn" data-action="${ctaAction}" data-id="${escapeHtml(p.id)}" ${!available ? 'disabled' : ''}>${ctaLabel}</button>
    </div>
    <div class="home-card-body">
      ${colors.length ? `<div class="swatch-row">${colors.map((c) => `<span class="swatch-dot" style="background:${escapeHtml(c)}"></span>`).join('')}</div>` : ''}
      <h3 class="home-card-name" data-action="view-product" data-id="${escapeHtml(p.id)}">${escapeHtml(p.name)}</h3>
      ${subtitle ? `<p class="home-card-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <div class="home-price-row">
        ${onSale ? `<span class="home-price-old">${formatPrice(p.compareAtPrice)}</span>` : ''}
        <span class="home-price ${onSale ? 'sale' : ''}">${formatPrice(p.price)}</span>
      </div>
      <div class="home-rating-row">
        <span class="stars" aria-hidden="true">${renderStars(p.averageRating)}</span>
        <span class="rating-count">(${Number(p.reviewCount) || 0})</span>
      </div>
    </div>
  </article>`;
}

function renderBrandMarquee() {
  if (!dom.brandTrack) return;
  const itemHtml = (b) => `
    <div class="brand-logo-item" data-brand="${escapeHtml(b.name)}">
      <img class="brand-logo" src="/assets/logos/${b.slug}.svg" alt="${escapeHtml(b.name)}" loading="lazy">
    </div>`;

  const itemsHtml = BRAND_LOGOS.map(itemHtml).join('');
  dom.brandTrack.innerHTML = itemsHtml + itemsHtml;

  dom.brandTrack.querySelectorAll('.brand-logo').forEach((img) => {
    img.addEventListener('error', () => handleLogoError(img), { once: true });
  });

  dom.brandTrack.addEventListener('click', (e) => {
    const item = e.target.closest('.brand-logo-item');
    if (!item) return;
    const brand = item.dataset.brand;
    if (window.location.pathname.includes('shop.html')) {
      dom.searchInput.value = brand;
      state.searchTerm = brand.toLowerCase();
      dom.searchClear.hidden = false;
      setActiveCategory('all');
    } else {
      window.location.href = `shop.html?q=${encodeURIComponent(brand)}`;
    }
  });
}

function handleLogoError(imgEl) {
  const wrapper = imgEl.closest('.brand-logo-item');
  if (!wrapper) return;
  const name = wrapper.dataset.brand || '';
  const fallback = document.createElement('span');
  fallback.className = 'brand-logo-fallback';
  fallback.textContent = name;
  imgEl.replaceWith(fallback);
}

function isProductAvailable(p) {
  const sizes = Array.isArray(p.sizes) ? p.sizes : [];
  if (sizes.length > 0) return sizes.some((s) => s.stockStatus === 'In Stock');
  return p.inStock !== false;
}

function productMatchesCategory(p, category) {
  if (category === 'all') return true;
  const group = CATEGORY_GROUPS[category];
  return Array.isArray(group) && group.includes(p.productType);
}

const handleSearchInput = debounce(() => {
  if (!dom.searchInput) return;
  state.searchTerm = dom.searchInput.value.trim().toLowerCase();
  if (dom.searchClear) dom.searchClear.hidden = state.searchTerm.length === 0;
  applyFilters();
}, 120);

function applyFilters() {
  if (!dom.productsGrid) return;
  const term = state.searchTerm;
  const cat = state.activeCategory;
  const gender = state.activeGender;
  const filter = state.activeFilter;

  let list = state.products.filter((p) => {
    if (!productMatchesCategory(p, cat)) return false;
    if (gender !== 'all' && p.gender !== gender) return false;
    if (!term) return true;
    const haystack = `${p.name} ${p.styleName || ''} ${p.brand} ${p.productType} ${p.shortDescription || ''}`.toLowerCase();
    return haystack.includes(term);
  });

  // Apply Catalog Filter parameter
  if (filter === 'new-arrivals') {
    list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  } else if (filter === 'best-sellers') {
    list.sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0));
  } else if (state.sortBy && state.sortBy !== 'default') {
    if (state.sortBy === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (state.sortBy === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (state.sortBy === 'newest') {
      list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    } else if (state.sortBy === 'best-selling') {
      list.sort((a, b) => (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0));
    }
  }

  state.filtered = list;
  state.currentPage = 1;
  renderShopGrid(state.filtered);
  updateCatalogHeading();
  updatePillsUI();
}

function updateCatalogHeading() {
  if (!dom.shopCatalogTitle) return;
  if (state.activeFilter === 'new-arrivals') {
    dom.shopCatalogTitle.textContent = 'NEW ARRIVALS';
  } else if (state.activeFilter === 'best-sellers') {
    dom.shopCatalogTitle.textContent = 'BEST SELLERS';
  } else if (state.activeCategory !== 'all') {
    dom.shopCatalogTitle.textContent = state.activeCategory.toUpperCase();
  } else {
    dom.shopCatalogTitle.textContent = 'ALL PRODUCTS';
  }
}

function updatePillsUI() {
  if (!dom.categoryPills) return;
  dom.categoryPills.querySelectorAll('.pill').forEach((pill) => {
    const pFilter = pill.dataset.filter;
    const pCat = pill.dataset.category;
    let isActive = false;

    if (pFilter && pFilter === state.activeFilter) isActive = true;
    else if (pCat && pCat === state.activeCategory && state.activeFilter === 'all') isActive = true;

    pill.classList.toggle('active', isActive);
  });
}

function renderShopGrid(list) {
  if (dom.resultsMeta) dom.resultsMeta.textContent = `${list.length} result${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    dom.productsGrid.innerHTML = '';
    if (dom.emptyState) dom.emptyState.hidden = false;
    if (dom.paginationControls) {
      dom.paginationControls.hidden = true;
      dom.paginationControls.innerHTML = '';
    }
    return;
  }
  if (dom.emptyState) dom.emptyState.hidden = true;

  const totalPages = Math.max(1, Math.ceil(list.length / PRODUCTS_PER_PAGE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageItems = list.slice(start, start + PRODUCTS_PER_PAGE);

  dom.productsGrid.innerHTML = pageItems.map((p) => shopProductCardHtml(p)).join('');
  renderPaginationControls(list.length, totalPages);
}

function renderPaginationControls(totalItems, totalPages) {
  if (!dom.paginationControls) return;
  if (totalItems <= PRODUCTS_PER_PAGE) {
    dom.paginationControls.hidden = true;
    dom.paginationControls.innerHTML = '';
    return;
  }

  const current = state.currentPage;
  const numberButtons = buildPageNumberList(current, totalPages)
    .map((entry) => {
      if (entry === '...') return '<span class="page-ellipsis" aria-hidden="true">…</span>';
      const isActive = entry === current;
      return `<button type="button" class="page-btn${isActive ? ' active' : ''}" data-page="${entry}"${isActive ? ' aria-current="page"' : ''}>${entry}</button>`;
    })
    .join('');

  dom.paginationControls.innerHTML = `
    <button type="button" class="page-btn page-btn--nav" data-page="${current - 1}" ${current <= 1 ? 'disabled' : ''}>Previous</button>
    ${numberButtons}
    <button type="button" class="page-btn page-btn--nav" data-page="${current + 1}" ${current >= totalPages ? 'disabled' : ''}>Next</button>
  `;
  dom.paginationControls.hidden = false;
}

function buildPageNumberList(current, totalPages) {
  const delta = 1;
  const keep = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - delta && i <= current + delta)) {
      keep.push(i);
    }
  }

  const withGaps = [];
  let previous = 0;
  keep.forEach((page) => {
    if (previous) {
      if (page - previous === 2) {
        withGaps.push(previous + 1);
      } else if (page - previous > 2) {
        withGaps.push('...');
      }
    }
    withGaps.push(page);
    previous = page;
  });
  return withGaps;
}

function shopProductCardHtml(p) {
  const onSale = typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.price;
  const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
  const available = isProductAvailable(p);
  const badges = Array.isArray(p.badges) ? p.badges : [];
  const displayName = p.styleName && p.styleName.trim() ? p.styleName : p.name;
  const ctaLabel = !available ? 'Out of Stock' : hasSizes ? 'Select Size' : 'Add to Cart';
  const ctaAction = hasSizes ? 'view-product' : 'quick-add';

  return `
  <article class="shop-card" data-id="${escapeHtml(p.id)}">
    <div class="shop-card-media" data-action="view-product" data-id="${escapeHtml(p.id)}">
      ${badges.length ? `<div class="shop-badge-stack">${badges.map((b) => `<span class="shop-badge">${escapeHtml(b)}</span>`).join('')}</div>` : ''}
      ${onSale ? '<span class="shop-badge sale">Sale</span>' : ''}
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      ${!available ? '<div class="out-of-stock">Out of Stock</div>' : ''}
    </div>
    <div class="shop-card-body">
      <h3 class="shop-card-title" data-action="view-product" data-id="${escapeHtml(p.id)}">${escapeHtml(displayName)}</h3>
      <span class="shop-card-brand">.${escapeHtml((p.brand || '').toUpperCase())}</span>
      <p class="shop-card-fullname">${escapeHtml(p.name)}</p>
      <div class="shop-rating-row">
        <span class="rating-count">(${Number(p.reviewCount) || 0})</span>
        <span class="stars" aria-hidden="true">${renderStars(p.averageRating)}</span>
      </div>
      <div class="shop-price-row">
        ${onSale ? `<span class="shop-price-old">${formatPrice(p.compareAtPrice)}</span>` : ''}
        <span class="shop-price ${onSale ? 'sale' : ''}">${formatPrice(p.price)}</span>
      </div>
      <button class="btn-select-size" data-action="${ctaAction}" data-id="${escapeHtml(p.id)}" ${!available ? 'disabled' : ''}>${ctaLabel}</button>
    </div>
  </article>`;
}

function bindProductGridEvents() {
  [dom.newArrivalsGrid, dom.bestSellersGrid, dom.productsGrid, dom.cartUpsellTrack].forEach((grid) => {
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const id = target.dataset.id;
      if (!id) return;

      if (target.dataset.action === 'view-product') {
        window.location.href = `product.html?id=${encodeURIComponent(id)}`;
      } else if (target.dataset.action === 'quick-add') {
        const result = addToCart(id, null, 1);
        if (result.ok) {
          const product = findProduct(id);
          showToast(`Added "${product.name}" to your cart`);
        } else {
          showToast('This item is currently out of stock.');
        }
      }
    });
  });
}

function findProduct(id) {
  return state.products.find((p) => p.id === id);
}

function addToCart(id, size, qty) {
  const product = findProduct(id);
  if (!product) return { ok: false, reason: 'not-found' };

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  if (sizes.length > 0) {
    if (!size) return { ok: false, reason: 'size-required' };
    const sizeEntry = sizes.find((s) => s.size === size);
    if (!sizeEntry || sizeEntry.stockStatus !== 'In Stock') {
      return { ok: false, reason: 'out-of-stock' };
    }
  } else if (product.inStock === false) {
    return { ok: false, reason: 'out-of-stock' };
  }

  const key = cartKey(id, size);
  const existing = state.cart.find((item) => cartKey(item.id, item.size) === key);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.push({ id, size: size || null, qty });
  }

  saveCart(state.cart);
  renderCart();
  updateCartBadge();
  return { ok: true };
}

function changeQty(id, size, delta) {
  const key = cartKey(id, size);
  const item = state.cart.find((i) => cartKey(i.id, i.size) === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter((i) => cartKey(i.id, i.size) !== key);
  }
  saveCart(state.cart);
  renderCart();
  updateCartBadge();
}

function removeFromCart(id, size) {
  const key = cartKey(id, size);
  state.cart = state.cart.filter((i) => cartKey(i.id, i.size) !== key);
  saveCart(state.cart);
  renderCart();
  updateCartBadge();
}

function cartTotal() {
  return state.cart.reduce((sum, item) => {
    const product = findProduct(item.id);
    return product ? sum + product.price * item.qty : sum;
  }, 0);
}

function cartCount() {
  return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  if (!dom.cartBadge) return;
  const count = cartCount();
  dom.cartBadge.textContent = count;
  dom.cartBadge.classList.toggle('show', count > 0);
}

function renderCart() {
  if (!dom.cartItems) return;
  const items = state.cart
    .map((item) => ({ item, product: findProduct(item.id) }))
    .filter((x) => x.product);

  if (items.length === 0) {
    dom.cartItems.innerHTML = '';
    if (dom.cartEmpty) dom.cartEmpty.classList.add('show');
    if (dom.checkoutBtn) dom.checkoutBtn.disabled = true;
  } else {
    if (dom.cartEmpty) dom.cartEmpty.classList.remove('show');
    if (dom.checkoutBtn) dom.checkoutBtn.disabled = false;
    dom.cartItems.innerHTML = items
      .map(({ item, product }) => {
        const idAttr = escapeHtml(item.id);
        const sizeAttr = escapeHtml(item.size || '');
        return `
      <div class="cart-item">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
        <div>
          <p class="cart-item-name">${escapeHtml(product.name)}</p>
          ${item.size ? `<span class="cart-item-size">Size: ${escapeHtml(item.size)}</span>` : ''}
          <span class="cart-item-price">${formatPrice(product.price)}</span>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="dec" data-id="${idAttr}" data-size="${sizeAttr}">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${idAttr}" data-size="${sizeAttr}">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-action="remove" data-id="${idAttr}" data-size="${sizeAttr}">Remove</button>
      </div>`;
      })
      .join('');
  }

  const subtotal = cartTotal();
  const discountAmount = state.discount && state.discount.type === 'percent' ? subtotal * (state.discount.value / 100) : 0;
  const total = Math.max(0, subtotal - discountAmount);

  if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(total);

  if (state.discount && discountAmount > 0) {
    if (dom.cartDiscountRow) dom.cartDiscountRow.hidden = false;
    if (dom.cartDiscountRowLabel) dom.cartDiscountRowLabel.textContent = `Discount (${state.discount.code})`;
    if (dom.cartDiscountRowAmount) dom.cartDiscountRowAmount.textContent = `-${formatPrice(discountAmount)}`;
  } else {
    if (dom.cartDiscountRow) dom.cartDiscountRow.hidden = true;
  }

  dom.cartItems.querySelectorAll('[data-action="inc"]').forEach((b) =>
    b.addEventListener('click', () => changeQty(b.dataset.id, b.dataset.size || null, 1))
  );
  dom.cartItems.querySelectorAll('[data-action="dec"]').forEach((b) =>
    b.addEventListener('click', () => changeQty(b.dataset.id, b.dataset.size || null, -1))
  );
  dom.cartItems.querySelectorAll('[data-action="remove"]').forEach((b) =>
    b.addEventListener('click', () => removeFromCart(b.dataset.id, b.dataset.size || null))
  );

  updateFreeShippingBar();
  renderCartUpsell();
}

function updateFreeShippingBar() {
  if (!dom.freeShippingBar) return;
  const threshold = CONFIG.FREE_SHIPPING_ITEM_THRESHOLD;
  if (!threshold || threshold <= 0 || state.cart.length === 0) {
    dom.freeShippingBar.hidden = true;
    if (dom.cartSubtotalBlock) dom.cartSubtotalBlock.hidden = true;
    return;
  }

  const count = cartCount();
  const remaining = Math.max(0, threshold - count);
  const percent = Math.min(100, (count / threshold) * 100);

  dom.freeShippingBar.hidden = false;
  if (dom.freeShippingFill) dom.freeShippingFill.style.width = `${percent}%`;

  if (dom.cartSubtotalBlock) {
    dom.cartSubtotalBlock.hidden = false;
    if (dom.cartSubtotalAmount) dom.cartSubtotalAmount.textContent = formatPrice(cartTotal());
    if (dom.cartSubtotalShippingNote) dom.cartSubtotalShippingNote.textContent = remaining === 0 ? 'Unlocked' : `Add ${remaining} item${remaining === 1 ? '' : 's'}`;
  }

  if (remaining === 0) {
    dom.freeShippingBar.classList.add('unlocked');
    if (dom.freeShippingText) dom.freeShippingText.innerHTML = `You've unlocked <strong>Free Shipping</strong>!`;
  } else {
    dom.freeShippingBar.classList.remove('unlocked');
    if (dom.freeShippingText) dom.freeShippingText.innerHTML = `Add <strong>${remaining}</strong> more item${remaining === 1 ? '' : 's'} for <strong>Free Shipping</strong>`;
  }
}

function renderCartUpsell() {
  if (!dom.cartUpsell || state.cart.length === 0) {
    if (dom.cartUpsell) dom.cartUpsell.hidden = true;
    return;
  }

  const cartIds = new Set(state.cart.map((item) => item.id));
  const items = state.products.filter(
    (p) => p.cartSuggestion === true && isProductAvailable(p) && !cartIds.has(p.id)
  );

  if (items.length === 0) {
    dom.cartUpsell.hidden = true;
    return;
  }

  dom.cartUpsell.hidden = false;
  if (dom.cartUpsellTrack) dom.cartUpsellTrack.innerHTML = items.map((p) => cartUpsellCardHtml(p)).join('');
}

function cartUpsellCardHtml(p) {
  const onSale = typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.price;
  const hasSizes = Array.isArray(p.sizes) && p.sizes.length > 0;
  const ctaAction = hasSizes ? 'view-product' : 'quick-add';
  const idAttr = escapeHtml(p.id);
  const nameAttr = escapeHtml(p.name);

  return `
  <div class="cart-upsell-card">
    <div class="cart-upsell-media" data-action="view-product" data-id="${idAttr}">
      <img src="${escapeHtml(p.image)}" alt="${nameAttr}" loading="lazy">
      <button class="cart-upsell-add-btn" data-action="${ctaAction}" data-id="${idAttr}" aria-label="Add ${nameAttr} to cart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
      </button>
    </div>
    <p class="cart-upsell-name">${escapeHtml(p.styleName || p.name)}</p>
    <div class="cart-upsell-price-row">
      ${onSale ? `<span class="cart-upsell-price-old">${formatPrice(p.compareAtPrice)}</span>` : ''}
      <span class="cart-upsell-price ${onSale ? 'sale' : ''}">${formatPrice(p.price)}</span>
    </div>
  </div>`;
}

function openCart() {
  closeSignin();
  if (dom.cartPanel) dom.cartPanel.classList.add('open');
  if (dom.cartOverlay) dom.cartOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  if (dom.cartPanel) dom.cartPanel.classList.remove('open');
  if (dom.cartOverlay) dom.cartOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(value) { return EMAIL_RE.test(String(value || '').trim()); }

function openSignin() {
  closeCart();
  clearSigninMessages();
  if (dom.signinPanel) {
    dom.signinPanel.classList.add('open');
    dom.signinPanel.setAttribute('aria-hidden', 'false');
  }
  if (dom.signinOverlay) dom.signinOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  if (dom.signinEmail) setTimeout(() => dom.signinEmail.focus(), 60);
}

function closeSignin() {
  if (dom.signinPanel) {
    dom.signinPanel.classList.remove('open');
    dom.signinPanel.setAttribute('aria-hidden', 'true');
  }
  if (dom.signinOverlay) dom.signinOverlay.classList.remove('show');
  if (dom.cartPanel && !dom.cartPanel.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function clearSigninMessages() {
  if (dom.signinFormError) { dom.signinFormError.hidden = true; dom.signinFormError.textContent = ''; }
  if (dom.signinFormSuccess) { dom.signinFormSuccess.hidden = true; dom.signinFormSuccess.textContent = ''; }
}

function showSigninError(message) {
  if (dom.signinFormSuccess) dom.signinFormSuccess.hidden = true;
  if (dom.signinFormError) {
    dom.signinFormError.textContent = message;
    dom.signinFormError.hidden = false;
  }
}

function showSigninSuccess(message) {
  if (dom.signinFormError) dom.signinFormError.hidden = true;
  if (dom.signinFormSuccess) {
    dom.signinFormSuccess.textContent = message;
    dom.signinFormSuccess.hidden = false;
  }
}

function setSigninLoading(isLoading) {
  if (!dom.signinSubmitBtn) return;
  dom.signinSubmitBtn.disabled = isLoading;
  const text = dom.signinSubmitBtn.querySelector('.btn-text');
  const spinner = dom.signinSubmitBtn.querySelector('.btn-spinner');
  if (text) text.hidden = isLoading;
  if (spinner) spinner.hidden = !isLoading;
}

function togglePasswordVisibility() {
  if (!dom.signinPassword) return;
  const showing = dom.signinPassword.type === 'text';
  dom.signinPassword.type = showing ? 'password' : 'text';
  if (dom.signinPasswordToggle) {
    dom.signinPasswordToggle.classList.toggle('is-visible', !showing);
    dom.signinPasswordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  }
}

async function handleSigninSubmit(e) {
  e.preventDefault();
  clearSigninMessages();
  if (!window.RareVisionAuth) return;

  const email = dom.signinEmail ? dom.signinEmail.value.trim() : '';
  const password = dom.signinPassword ? dom.signinPassword.value : '';

  if (!email || !password) {
    showSigninError('Please fill in both your email and password.');
    return;
  }
  if (!isValidEmail(email)) {
    showSigninError('Please enter a valid email address.');
    return;
  }

  setSigninLoading(true);
  const result = await window.RareVisionAuth.loginUser(email, password);
  setSigninLoading(false);

  if (result.success) {
    const firstName = result.user && result.user.displayName ? result.user.displayName.split(' ')[0] : '';
    showToast(firstName ? `Welcome back, ${firstName}!` : 'Welcome back!');
    if (dom.signinForm) dom.signinForm.reset();
    closeSignin();
  } else {
    showSigninError(result.message);
  }
}

async function handleForgotPassword() {
  clearSigninMessages();
  if (!window.RareVisionAuth) return;

  const email = dom.signinEmail ? dom.signinEmail.value.trim() : '';
  if (!email || !isValidEmail(email)) {
    showSigninError('Please enter a valid email address above.');
    return;
  }

  if (dom.forgotPasswordBtn) dom.forgotPasswordBtn.disabled = true;
  const result = await window.RareVisionAuth.resetPassword(email);
  if (dom.forgotPasswordBtn) dom.forgotPasswordBtn.disabled = false;

  if (result.success) showSigninSuccess(`Password reset email sent to ${email}.`);
  else showSigninError(result.message);
}

function updateAccountButtonUI(user) {
  if (!dom.accountToggle) return;
  if (user) {
    dom.accountToggle.classList.add('is-signed-in');
    dom.accountToggle.title = `Signed in as ${user.email || 'your account'} — click to sign out`;
  } else {
    dom.accountToggle.classList.remove('is-signed-in');
    dom.accountToggle.removeAttribute('title');
  }
}

async function handleAccountToggleClick() {
  const user = window.RareVisionAuth ? window.RareVisionAuth.getCurrentUser() : null;
  if (user) {
    const result = await window.RareVisionAuth.logoutUser();
    showToast(result.success ? 'You have been signed out.' : result.message);
  } else {
    openSignin();
  }
}

function toggleShippingAccordion() {
  if (!dom.shippingAccordionPanel) return;
  const isOpen = dom.shippingAccordionPanel.hidden === false;
  dom.shippingAccordionPanel.hidden = isOpen;
  if (dom.shippingAccordionTrigger) dom.shippingAccordionTrigger.setAttribute('aria-expanded', String(!isOpen));
  if (dom.shippingAccordion) dom.shippingAccordion.classList.toggle('open', !isOpen);
}

function toggleDiscountAccordion() {
  if (!dom.discountAccordionPanel) return;
  const isOpen = dom.discountAccordionPanel.hidden === false;
  dom.discountAccordionPanel.hidden = isOpen;
  if (dom.discountAccordionTrigger) dom.discountAccordionTrigger.setAttribute('aria-expanded', String(!isOpen));
  if (dom.discountAccordion) dom.discountAccordion.classList.toggle('open', !isOpen);
  if (!isOpen && dom.cartDiscountInput) dom.cartDiscountInput.focus();
}

function applyCartDiscountCode() {
  if (!dom.cartDiscountInput) return;
  const code = dom.cartDiscountInput.value.trim().toUpperCase();
  if (!code) return;

  const match = CONFIG.DISCOUNT_CODES[code];
  if (!match) {
    state.discount = null;
    saveDiscount(null);
    showCartDiscountMessage(`"${code}" is not a valid code.`, true);
    renderCart();
    return;
  }

  state.discount = { code, type: match.type, value: match.value };
  saveDiscount(state.discount);
  const message = match.type === 'shipping' ? `Code "${code}" applied — free shipping at checkout.` : `Code "${code}" applied.`;
  showCartDiscountMessage(message, false);
  renderCart();
}

function showCartDiscountMessage(text, isError) {
  if (!dom.cartDiscountMessage) return;
  dom.cartDiscountMessage.textContent = text;
  dom.cartDiscountMessage.hidden = false;
  dom.cartDiscountMessage.classList.toggle('error', isError);
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function showToast(msg) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => dom.toast.classList.remove('show'), 2400);
}

function renderStars(rating) {
  const rounded = Math.round(Number(rating) || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= rounded ? 'filled' : ''}">★</span>`;
  }
  return html;
}

function bindStaticEvents() {
  bindProductGridEvents();

  if (dom.searchInput) dom.searchInput.addEventListener('input', handleSearchInput);
  if (dom.searchClear) {
    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      state.searchTerm = '';
      dom.searchClear.hidden = true;
      applyFilters();
    });
  }

  if (dom.categoryPills) {
    dom.categoryPills.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        if (pill.dataset.filter) state.activeFilter = pill.dataset.filter;
        else state.activeFilter = 'all';

        if (pill.dataset.category) state.activeCategory = pill.dataset.category;
        else state.activeCategory = 'all';

        applyFilters();
      });
    });
  }

  if (dom.resetFilters) {
    dom.resetFilters.addEventListener('click', () => {
      if (dom.searchInput) dom.searchInput.value = '';
      state.searchTerm = '';
      if (dom.searchClear) dom.searchClear.hidden = true;
      state.activeCategory = 'all';
      state.activeGender = 'all';
      state.activeFilter = 'all';
      state.sortBy = 'default';
      if (dom.sortSelect) dom.sortSelect.value = 'default';
      applyFilters();
    });
  }

  if (dom.paginationControls) {
    dom.paginationControls.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn:not(:disabled)');
      if (!btn) return;
      const page = Number(btn.dataset.page);
      if (!Number.isFinite(page) || page < 1 || page === state.currentPage) return;
      state.currentPage = page;
      renderShopGrid(state.filtered);
      document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (dom.genderDropdownBtn && dom.genderDropdownMenu) {
    dom.genderDropdownBtn.addEventListener('click', () => {
      const willOpen = dom.genderDropdownMenu.hidden;
      dom.genderDropdownMenu.hidden = !willOpen;
      dom.genderDropdownBtn.setAttribute('aria-expanded', String(willOpen));
      if (dom.genderDropdown) dom.genderDropdown.classList.toggle('open', willOpen);
    });
    dom.genderDropdownMenu.querySelectorAll('li').forEach((li) => {
      li.addEventListener('click', () => {
        state.activeGender = li.dataset.value;
        if (dom.genderDropdownLabel) dom.genderDropdownLabel.textContent = li.textContent;
        dom.genderDropdownMenu.hidden = true;
        if (dom.genderDropdownBtn) dom.genderDropdownBtn.setAttribute('aria-expanded', 'false');
        if (dom.genderDropdown) dom.genderDropdown.classList.remove('open');
        applyFilters();
      });
    });
  }

  if (dom.sortSelect) {
    dom.sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });
  }

  if (dom.cartToggle) dom.cartToggle.addEventListener('click', openCart);
  if (dom.cartClose) dom.cartClose.addEventListener('click', closeCart);
  if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);
  if (dom.cartEmptyShop) dom.cartEmptyShop.addEventListener('click', closeCart);
  if (dom.shippingAccordionTrigger) dom.shippingAccordionTrigger.addEventListener('click', toggleShippingAccordion);
  if (dom.discountAccordionTrigger) dom.discountAccordionTrigger.addEventListener('click', toggleDiscountAccordion);
  if (dom.cartApplyDiscountBtn) dom.cartApplyDiscountBtn.addEventListener('click', applyCartDiscountCode);

  if (dom.accountToggle) dom.accountToggle.addEventListener('click', handleAccountToggleClick);
  if (dom.signinClose) dom.signinClose.addEventListener('click', closeSignin);
  if (dom.signinOverlay) dom.signinOverlay.addEventListener('click', closeSignin);
  if (dom.signinForm) dom.signinForm.addEventListener('submit', handleSigninSubmit);
  if (dom.signinPasswordToggle) dom.signinPasswordToggle.addEventListener('click', togglePasswordVisibility);
  if (dom.forgotPasswordBtn) dom.forgotPasswordBtn.addEventListener('click', handleForgotPassword);

  if (dom.discountPopupForm) dom.discountPopupForm.addEventListener('submit', handleDiscountPopupSubmit);
  if (dom.discountPopupClose) dom.discountPopupClose.addEventListener('click', () => closeDiscountPopup(true));
  if (dom.discountPopupOverlay) dom.discountPopupOverlay.addEventListener('click', () => closeDiscountPopup(true));
  if (dom.discountPopupDismiss) dom.discountPopupDismiss.addEventListener('click', () => closeDiscountPopup(true));
  if (dom.discountPopupDone) dom.discountPopupDone.addEventListener('click', () => closeDiscountPopup());

  if (dom.checkoutBtn) {
    dom.checkoutBtn.addEventListener('click', () => {
      if (dom.checkoutBtn.disabled) return;
      window.location.href = 'checkout.html';
    });
  }
}

let discountIdleTimer = null;
function scheduleGuestDiscountPopup() {
  if (dom.discountPopupCode) dom.discountPopupCode.textContent = DISCOUNT_POPUP_CODE;
  if (hasSeenDiscountPopup()) return;
  resetDiscountIdleTimer();
  DISCOUNT_POPUP_ACTIVITY_EVENTS.forEach((evt) => {
    document.addEventListener(evt, resetDiscountIdleTimer, { passive: true });
  });
}

function resetDiscountIdleTimer() {
  if (hasSeenDiscountPopup()) {
    stopDiscountIdleTracking();
    return;
  }
  if (discountIdleTimer) clearTimeout(discountIdleTimer);
  discountIdleTimer = setTimeout(maybeShowGuestDiscountPopup, DISCOUNT_POPUP_DELAY_MS);
}

function stopDiscountIdleTracking() {
  if (discountIdleTimer) {
    clearTimeout(discountIdleTimer);
    discountIdleTimer = null;
  }
  DISCOUNT_POPUP_ACTIVITY_EVENTS.forEach((evt) => {
    document.removeEventListener(evt, resetDiscountIdleTimer, { passive: true });
  });
}

function handleAuthChangeForDiscountPopup(user) {
  if (!user) return;
  stopDiscountIdleTracking();
  if (dom.discountPopup && dom.discountPopup.classList.contains('open')) {
    closeDiscountPopup();
  }
}

function hasSeenDiscountPopup() {
  try { return localStorage.getItem(DISCOUNT_POPUP_SEEN_KEY) === '1'; }
  catch (err) { return false; }
}

function markDiscountPopupSeen() {
  try { localStorage.setItem(DISCOUNT_POPUP_SEEN_KEY, '1'); }
  catch (err) {}
}

function maybeShowGuestDiscountPopup() {
  if (hasSeenDiscountPopup()) return;
  const user = window.RareVisionAuth ? window.RareVisionAuth.getCurrentUser() : null;
  if (user) return;

  const somethingElseOpen = (dom.signinPanel && dom.signinPanel.classList.contains('open')) ||
                             (dom.cartPanel && dom.cartPanel.classList.contains('open'));
  if (somethingElseOpen) {
    setTimeout(maybeShowGuestDiscountPopup, 5000);
    return;
  }
  openDiscountPopup();
}

function openDiscountPopup() {
  if (!dom.discountPopup) return;
  stopDiscountIdleTracking();
  resetDiscountPopupView();
  if (dom.discountPopupOverlay) dom.discountPopupOverlay.classList.add('show');
  dom.discountPopup.classList.add('open');
  dom.discountPopup.setAttribute('aria-hidden', 'false');
}

function closeDiscountPopup(markSeen) {
  if (!dom.discountPopup) return;
  if (dom.discountPopupOverlay) dom.discountPopupOverlay.classList.remove('show');
  dom.discountPopup.classList.remove('open');
  dom.discountPopup.setAttribute('aria-hidden', 'true');
  if (markSeen) {
    markDiscountPopupSeen();
    stopDiscountIdleTracking();
  }
}

function resetDiscountPopupView() {
  if (dom.discountPopupForm) dom.discountPopupForm.hidden = false;
  if (dom.discountPopupSuccess) dom.discountPopupSuccess.hidden = true;
  if (dom.discountPopupDismiss) dom.discountPopupDismiss.hidden = false;
  if (dom.discountPopupError) dom.discountPopupError.hidden = true;
  if (dom.discountPopupEmail) dom.discountPopupEmail.value = '';
}

async function handleDiscountPopupSubmit(e) {
  e.preventDefault();
  const email = dom.discountPopupEmail ? dom.discountPopupEmail.value.trim() : '';

  if (!isValidEmail(email)) {
    if (dom.discountPopupError) {
      dom.discountPopupError.textContent = 'Please enter a valid email address.';
      dom.discountPopupError.hidden = false;
    }
    return;
  }
  if (dom.discountPopupError) dom.discountPopupError.hidden = true;

  const btn = dom.discountPopupSubmit;
  if (btn) btn.disabled = true;

  try {
    if (window.RareVisionFirebase && typeof window.RareVisionFirebase.subscribeForDiscount === 'function') {
      await window.RareVisionFirebase.subscribeForDiscount(email);
    }
    if (window.RareVisionEmail && typeof window.RareVisionEmail.sendWelcomeEmail === 'function') {
      window.RareVisionEmail.sendWelcomeEmail(email, {}).catch((err) => console.error(err));
    }

    if (dom.discountPopupForm) dom.discountPopupForm.hidden = true;
    if (dom.discountPopupDismiss) dom.discountPopupDismiss.hidden = true;
    if (dom.discountPopupSuccess) dom.discountPopupSuccess.hidden = false;
    markDiscountPopupSeen();
    stopDiscountIdleTracking();
    showToast('Check your inbox — your 15% off code is on its way.');
  } catch (err) {
    console.error('Failed to save subscriber email', err);
    if (dom.discountPopupError) {
      dom.discountPopupError.textContent = 'Something went wrong saving your email. Please try again.';
      dom.discountPopupError.hidden = false;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function logVisitorPing() {
  try {
    if (!window.RareVisionFirebase || typeof window.RareVisionFirebase.logVisitor !== 'function') return;
    const payload = {
      path: window.location.pathname,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(),
    };
    Promise.resolve(window.RareVisionFirebase.logVisitor(payload)).catch(() => {});
  } catch (err) {}
}
