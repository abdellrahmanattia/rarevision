'use strict';

/* ==========================================================================
   RARE VISION — main.js
   Vanilla JS only. No build step, no dependencies.
   Requires js/shared.js to be loaded first (CONFIG, cart storage, formatters).

   Sections:
   1. STATE + DOM refs
   2. INIT / DATA LOADING
   3. NEW ARRIVALS + BEST SELLERS (home sections)
   4. BRAND MARQUEE
   5. SHOP BY CATEGORY (filter pills, gender dropdown, search, grid)
   6. PRODUCT DETAIL MODAL (gallery nav, dynamic sizing, dynamic pricing)
   7. CART (localStorage backed, size-aware line items)
   8. CART PANEL UI (open/close, "Complete Order" navigates to checkout.html)
   9. UTILITIES (toast, debounce, markdown-lite, stars)
   10. GUEST DISCOUNT POPUP (2-minute IDLE-triggered 15%-off offer, appended
       at the end of this file — see also Shop by Category pagination in
       section 6 and automatic New Arrivals/Best Sellers sorting in
       section 4)
   11. SILENT VISITOR TRACKING (fire-and-forget Firestore ping for the
       Admin Analytics dashboard — appended after section 10)
   ========================================================================== */

// Maps the 3 top-level shop filter pills to the underlying productType
// values stored on each Firestore product document. Edit this if you add
// new productType values and want them to fall under one of these pills.
const CATEGORY_GROUPS = {
  Shoes: ['Sneakers'],
  Clothes: ['Jackets', 'T-Shirts'],
  Accessories: ['Watches', 'Hats', 'Accessories'],
};

// Brand marquee content. Each entry renders as <img src="/assets/logos/{slug}.svg">.
// Claude does not generate or host the logo files themselves — you supply
// those (see README.md, "Brand marquee logos"). If a file is missing or
// fails to load, that logo gracefully falls back to a plain text label
// instead of showing a broken-image icon (see handleLogoError() below).
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

// Used ONLY when the Firestore `products` collection comes back empty —
// e.g. a freshly created project where products haven't been added yet.
// Holds a single hand-authored sample product (id "sample-1") purely for
// local preview/testing: it lets the home page's New Arrivals / Best
// Sellers / Shop grid render something clickable, which lands on
// product.html?id=sample-1 — resolved by js/firebase-data.js's
// fetchProductById() sample-product fallback (see that file). The site
// automatically stops using this the moment fetchProducts() returns at
// least one real document, so it's safe to leave in place after real
// products are uploaded via the Admin Panel — or just delete this entry.
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
      'https://picsum.photos/seed/rarevision-sample-3/900/1100',
      'https://picsum.photos/seed/rarevision-sample-4/900/1100',
    ],
    shortDescription: 'A clean, everyday runner built for all-day comfort.',
    description:
      'The Classic Runner pairs a lightweight knit upper with a cushioned midsole, ' +
      'so it wears just as well running errands as it does on a longer walk. A ' +
      'reinforced heel counter keeps the fit locked in, and the tonal outsole ' +
      'pattern adds grip without weighing the shoe down.\n\n' +
      'This is a local placeholder product (ID sample-1) for testing the ' +
      'storefront before real inventory is uploaded via the Admin Panel — ' +
      'swap it out any time by adding a real document to the `products` ' +
      'collection in Firestore.',
    status: 'active',
    createdAt: new Date(),
  },
];

// Shop-by-Category grid pagination: how many product cards render per page
// before "Previous / 1 2 3… / Next" controls take over. See
// renderShopGrid() / renderPaginationControls() in section 6.
const PRODUCTS_PER_PAGE = 10;

// 2-minute IDLE guest discount popup (section 10, near the end of this
// file). This is idle time, not time-on-page: the timer restarts on every
// mouse/keyboard/scroll/touch interaction and only fires once
// DISCOUNT_POPUP_DELAY_MS has elapsed with NO activity at all. localStorage
// key remembers that a visitor already saw/dismissed/claimed the offer so
// it doesn't nag them again on a later visit or page reload.
const DISCOUNT_POPUP_DELAY_MS = 120000;
const DISCOUNT_POPUP_CODE = 'RV03';
const DISCOUNT_POPUP_SEEN_KEY = 'rvDiscountPopupSeen';
// Activity events that count as "not idle" and reset the popup timer.
// passive:true on every listener since none of them ever call
// preventDefault() — keeps scrolling/touch smooth.
const DISCOUNT_POPUP_ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

// Silent visitor tracking (section 11, near the end of this file). Purely
// an internal counter for the Admin Analytics dashboard — no UI, nothing
// blocking, failures are swallowed.
const VISITOR_LOG_COLLECTION = 'visitors';

/* --------------------------------------------------------------------------
   2. STATE + DOM REFS
   -------------------------------------------------------------------------- */
const state = {
  products: [],
  filtered: [],
  activeCategory: 'all', // 'all' | 'Shoes' | 'Clothes' | 'Accessories'
  activeCollection: 'all', // 'all' | 'new-arrivals' | 'best-sellers'
  sort: 'default',
  activeGender: 'all',   // 'all' | 'Men' | 'Women' | 'Unisex' | 'Kids'
  searchTerm: '',
  currentPage: 1,        // 1-indexed page into state.filtered for the Shop by Category grid
  cart: [],              // [{id, size /* string|null */, qty}]
  discount: null,        // { code, type: 'percent'|'shipping', value } | null — cart drawer's Discount accordion
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
  sortSelect: document.getElementById('sortSelect'),

  genderDropdown: document.getElementById('genderDropdown'),
  genderDropdownBtn: document.getElementById('genderDropdownBtn'),
  genderDropdownLabel: document.getElementById('genderDropdownLabel'),
  genderDropdownMenu: document.getElementById('genderDropdownMenu'),

  // NOTE: #headerSearchBtn and #scrollTopBtn/#year are intentionally NOT
  // captured here anymore (see BUGFIX comments at their old call sites in
  // init() and bindStaticEvents() below) — #headerSearchBtn no longer
  // exists in the header markup (js/header.js's full search bar replaced
  // it), and #scrollTopBtn/#year live inside footer.html, which isn't in
  // the DOM yet at the moment this dom{} object is built (js/footer-loader.js
  // fetches and injects it asynchronously, well after this synchronous
  // script runs) — footer-loader.js already wires both up itself once the
  // footer is actually in the DOM, so main.js doesn't need to touch them.

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
  year: document.getElementById('year'),
};

/* --------------------------------------------------------------------------
   3. INIT / DATA LOADING
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // BUGFIX (QA pass): this used to read `dom.year.textContent = ...` here,
  // but #year lives inside footer.html, which js/footer-loader.js fetches
  // and injects into #global-footer asynchronously — it is NOT in the DOM
  // yet at the moment this file's `dom` object above was built, so
  // dom.year was always null and this line threw a TypeError on every
  // single page load, before ANY of the rest of init() below could run
  // (no cart, no product loading, no event bindings — the entire
  // storefront's JS silently died right here). footer-loader.js already
  // fills in #year (and wires up #scrollTopBtn) itself once the footer
  // fragment is actually in the DOM — see its fillYear()/wireScrollTop() —
  // so nothing needs to happen here at all.
  state.cart = loadCart();
  state.discount = loadDiscount();
  updateCartBadge(); // item count doesn't depend on product data, safe to show immediately

  // Render the cart panel's shell (empty state / free-shipping bar /
  // accordions / footer) right away too, not just the badge above.
  // js/header.js's initCartDrawer() attaches its own #cartToggle click
  // handler synchronously on DOMContentLoaded and can slide #cartPanel open
  // the instant the page paints — well before `await loadProducts()` below
  // ever resolves. Previously the first renderCart() call happened only
  // after that fetch, so a shopper who opened the cart in that window saw a
  // half-built panel: #cartEmpty still missing its `.show` class, the
  // free-shipping bar/subtotal block still sitting on their default
  // `hidden` attribute, and #checkoutBtn stuck on its default `disabled`
  // markup — a blank-looking drawer with just the accordions floating in it.
  // Calling renderCart() here uses whatever's already in localStorage, so
  // the empty state (or a correctly enabled/disabled Complete Order button)
  // is right on the very first paint, regardless of network speed. Line
  // items that ARE in the cart still need state.products to resolve their
  // name/image/price, so on a slow connection they can briefly not appear
  // until the second renderCart() call below runs once loadProducts()
  // resolves — normally near-instant, and self-correcting.
  renderCart();

  renderBrandMarquee();
  bindStaticEvents();

  // Fire-and-forget analytics ping — see section 11. Never awaited and
  // never allowed to affect anything else in init().
  logVisitorPing();

  // Starts the 2-minute IDLE timer for the guest discount popup — resets
  // on activity, fires only after a full 2 minutes with none — regardless
  // of whether product data below loads successfully. See section 10.
  scheduleGuestDiscountPopup();

  // Reflect Firebase auth state on the header's Account icon (see
  // updateAccountButtonUI() and js/auth.js's onAuthChange()).
  if (window.RareVisionAuth) {
    window.RareVisionAuth.onAuthChange(updateAccountButtonUI);
    // Also registered here (section 10): the instant a guest signs in,
    // permanently stop the idle timer for this session and dismiss the
    // popup if it happens to be open — signed-in shoppers never see it.
    window.RareVisionAuth.onAuthChange(handleAuthChangeForDiscountPopup);
  }

  // Lets register.html's "Already have an account? Sign in" trigger and
  // its header Account icon deep-link straight into this drawer, its
  // header Cart icon deep-link straight into the cart panel (via
  // index.html?signin=1 / index.html?cart=1), and its header search bar's
  // hand-off (see js/register.js's handleHeaderSearchSubmit()) land the
  // typed term into this page's own search box via index.html?search=...
  const deepLinkParams = new URLSearchParams(window.location.search);
  if (deepLinkParams.get('signin') === '1') {
    openSignin();
  }
  if (deepLinkParams.get('cart') === '1') {
    openCart();
  }
  if (deepLinkParams.has('signin') || deepLinkParams.has('cart') || deepLinkParams.has('search')) {
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
  }

  state.products = await loadProducts();
  if (state.products.length === 0) {
    dom.loadingState.innerHTML = '<p>Could not load products. Please check your Firestore setup, then refresh the page.</p>';
    renderCart(); // still render whatever cart state we have
    return;
  }

  dom.loadingState.hidden = true;
  renderNewArrivals();
  renderBestSellers();

  // BUGFIX (QA pass): register.html's header search bar redirects here with
  // a ?search=<term> query param (see js/register.js), but this page never
  // read that param — the hand-off silently dropped the shopper's typed
  // search term instead of landing them on a pre-filtered Shop section.
  // applyFilters() (below) already reads state.searchTerm, so prefilling it
  // (and the visible search box) here is all that's needed.
  const handedOffSearch = deepLinkParams.get('search');
  if (handedOffSearch) {
    dom.searchInput.value = handedOffSearch;
    state.searchTerm = handedOffSearch.trim().toLowerCase();
    dom.searchClear.hidden = state.searchTerm.length === 0;
  }

  applyCatalogRoute(deepLinkParams);
  applyFilters();
  renderCart(); // now product data is available to resolve names/images/prices

  if (handedOffSearch) {
    document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
  }
}

// Loads products from the Firestore `products` collection via the
// window.RareVisionFirebase bridge (see js/firebase-data.js). Falls back to
// FALLBACK_PRODUCTS if Firestore isn't reachable, isn't configured yet, or
// simply has no documents in it — see that array's own comment above.
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

/* --------------------------------------------------------------------------
   4. NEW ARRIVALS + BEST SELLERS (home sections)
   -------------------------------------------------------------------------- */
// Converts a Firestore `createdAt` value into a comparable epoch-ms number.
// docSnap.data() hands back a real Firestore Timestamp instance (with a
// .toMillis() method) for fields written via serverTimestamp() — not a
// plain number or Date — so a naive `b.createdAt - a.createdAt` would sort
// incorrectly (or produce NaN). Also tolerates a plain Date, a
// {seconds, nanoseconds} POJO, a numeric epoch, or a parseable string, so
// FALLBACK_PRODUCTS and hand-entered Firestore docs sort safely too.
function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + (Number(value.nanoseconds) || 0) / 1e6;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// NEW ARRIVALS: the 3 most recently created published products, newest
// first, per Firestore's `createdAt` field. fetchProducts() already
// excludes status:'hidden' docs, so no extra filtering is needed here.
function renderNewArrivals() {
  const items = [...state.products]
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    .slice(0, 3);
  dom.newArrivalsGrid.innerHTML = items.map((p) => homeProductCardHtml(p)).join('');
}

// BEST SELLERS: the 3 highest `soldCount` published products, highest
// first. The top 3 automatically get "#1"/"#2"/"#3" corner badges via the
// `rank` argument to homeProductCardHtml() (see its rankBadge markup).
function renderBestSellers() {
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

/* --------------------------------------------------------------------------
   5. BRAND MARQUEE
   -------------------------------------------------------------------------- */
function renderBrandMarquee() {
  const itemHtml = (b) => `
    <div class="brand-logo-item" data-brand="${escapeHtml(b.name)}">
      <img
        class="brand-logo"
        src="/assets/logos/${b.slug}.svg"
        alt="${escapeHtml(b.name)}"
        loading="lazy"
      >
    </div>`;

  const itemsHtml = BRAND_LOGOS.map(itemHtml).join('');
  // The track is duplicated once so the CSS animation (translateX -50% -> 0)
  // loops seamlessly with no visible seam or reset jump.
  dom.brandTrack.innerHTML = itemsHtml + itemsHtml;

  // Until the real files exist at /assets/logos/*.svg, fall back to a clean
  // text label instead of a broken-image icon. Once you upload the actual
  // logo files this fallback simply never triggers.
  dom.brandTrack.querySelectorAll('.brand-logo').forEach((img) => {
    img.addEventListener('error', () => handleLogoError(img), { once: true });
  });

  // Clicking a brand jumps to the Shop section pre-filtered by that name.
  dom.brandTrack.addEventListener('click', (e) => {
    const item = e.target.closest('.brand-logo-item');
    if (!item) return;
    const brand = item.dataset.brand;
    dom.searchInput.value = brand;
    state.searchTerm = brand.toLowerCase();
    dom.searchClear.hidden = false;
    setActiveCategory('all');
    setActiveGender('all');
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
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

/* --------------------------------------------------------------------------
   6. SHOP BY CATEGORY (filter pills, gender dropdown, search, grid)
   -------------------------------------------------------------------------- */
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

function productMatchesCollection(product, collection) {
  if (collection === 'all') return true;
  const metadataKey = collection === 'new-arrivals' ? 'isNewArrival' : 'isBestSeller';
  const label = collection === 'new-arrivals' ? 'new-arrivals' : 'best-sellers';
  const taggedProductsExist = state.products.some((item) =>
    item[metadataKey] === true || (Array.isArray(item.collections) && item.collections.includes(label))
  );
  // Firestore catalogs that explicitly tag a collection use those tags. Older
  // catalogs remain compatible: their entire published inventory is the
  // collection, ordered by the same createdAt/soldCount rule as the homepage.
  if (!taggedProductsExist) return true;
  return product[metadataKey] === true || (Array.isArray(product.collections) && product.collections.includes(label));
}

function compareProducts(a, b) {
  if (state.activeCollection === 'new-arrivals' || state.sort === 'newest') {
    return toMillis(b.createdAt) - toMillis(a.createdAt);
  }
  if (state.activeCollection === 'best-sellers' || state.sort === 'best-selling') {
    return (Number(b.soldCount) || 0) - (Number(a.soldCount) || 0);
  }
  if (state.sort === 'price-low') return (Number(a.price) || 0) - (Number(b.price) || 0);
  if (state.sort === 'price-high') return (Number(b.price) || 0) - (Number(a.price) || 0);
  return 0;
}

const handleSearchInput = debounce(() => {
  state.searchTerm = dom.searchInput.value.trim().toLowerCase();
  dom.searchClear.hidden = state.searchTerm.length === 0;
  applyFilters();
}, 120);

function applyFilters() {
  const term = state.searchTerm;
  const cat = state.activeCategory;
  const gender = state.activeGender;

  state.filtered = state.products.filter((p) => {
    if (!productMatchesCollection(p, state.activeCollection)) return false;
    if (!productMatchesCategory(p, cat)) return false;
    if (gender !== 'all' && p.gender !== gender) return false;
    if (!term) return true;
    const haystack = `${p.name} ${p.styleName || ''} ${p.brand} ${p.productType} ${p.shortDescription || ''}`.toLowerCase();
    return haystack.includes(term);
  });
  state.filtered.sort(compareProducts);

  // Any change to the active filters starts back on page 1 — otherwise a
  // shopper could land on, say, page 4 of a search result set that now
  // only has 1 page.
  state.currentPage = 1;
  renderShopGrid(state.filtered);
}

function renderShopGrid(list) {
  dom.resultsMeta.textContent = `${list.length} result${list.length === 1 ? '' : 's'}`;

  if (list.length === 0) {
    dom.productsGrid.innerHTML = '';
    dom.emptyState.hidden = false;
    dom.paginationControls.hidden = true;
    dom.paginationControls.innerHTML = '';
    return;
  }
  dom.emptyState.hidden = true;

  const totalPages = Math.max(1, Math.ceil(list.length / PRODUCTS_PER_PAGE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * PRODUCTS_PER_PAGE;
  const pageItems = list.slice(start, start + PRODUCTS_PER_PAGE);

  dom.productsGrid.innerHTML = pageItems.map((p) => shopProductCardHtml(p)).join('');
  renderPaginationControls(list.length, totalPages);
}

// Renders "Previous | 1 2 3 … N | Next" controls, only when there's more
// than one page (i.e. more than PRODUCTS_PER_PAGE results) per spec.
function renderPaginationControls(totalItems, totalPages) {
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

// Builds a compact page-number list around the current page, e.g.
// [1, '...', 4, 5, 6, '...', 12], always keeping the first and last page
// visible so a shopper can always jump straight to either end.
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
        withGaps.push(previous + 1); // single skipped page: show it instead of an ellipsis
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

// Event delegation covers New Arrivals, Best Sellers, and the Shop grid at
// once, including cards re-rendered after filtering — nothing needs to be
// re-bound manually after the initial call.
function bindProductGridEvents() {
  [dom.newArrivalsGrid, dom.bestSellersGrid, dom.productsGrid, dom.cartUpsellTrack].forEach((grid) => {
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
          const original = target.textContent;
          target.textContent = 'Added ✓';
          setTimeout(() => {
            target.textContent = original;
          }, 1100);
        } else {
          showToast('This item is currently out of stock.');
        }
      }
    });
  });
}

/* --------------------------------------------------------------------------
   7. CART (localStorage backed, size-aware line items)
   cartKey / loadCart / saveCart / formatPrice / escapeHtml all come from
   shared.js — this section only has the functions specific to rendering
   the storefront's cart panel.
   -------------------------------------------------------------------------- */
function findProduct(id) {
  return state.products.find((p) => p.id === id);
}

/**
 * Adds a product (optionally with a chosen size) to the cart.
 * Returns { ok: true } on success, or { ok: false, reason } on failure so
 * callers can decide how/where to surface the error (inline vs. toast).
 */
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
  const count = cartCount();
  dom.cartBadge.textContent = count;
  dom.cartBadge.classList.toggle('show', count > 0);
}

function renderCart() {
  const items = state.cart
    .map((item) => ({ item, product: findProduct(item.id) }))
    .filter((x) => x.product);

  if (items.length === 0) {
    dom.cartItems.innerHTML = '';
    dom.cartEmpty.classList.add('show');
    dom.checkoutBtn.disabled = true;
  } else {
    dom.cartEmpty.classList.remove('show');
    dom.checkoutBtn.disabled = false;
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

  // Discount: a 'percent' code lowers the total shown here; a 'shipping'
  // code has nothing to discount in the drawer (no shipping line is shown
  // until checkout) but stays applied — see applyCartDiscountCode().
  const subtotal = cartTotal();
  const discountAmount =
    state.discount && state.discount.type === 'percent' ? subtotal * (state.discount.value / 100) : 0;
  const total = Math.max(0, subtotal - discountAmount);

  dom.cartTotal.textContent = formatPrice(total);

  if (state.discount && discountAmount > 0) {
    dom.cartDiscountRow.hidden = false;
    dom.cartDiscountRowLabel.textContent = `Discount (${state.discount.code})`;
    dom.cartDiscountRowAmount.textContent = `-${formatPrice(discountAmount)}`;
  } else {
    dom.cartDiscountRow.hidden = true;
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

// "Add N more items for Free Shipping" progress bar + the Subtotal/Free
// Shipping summary block beneath it. Reads CONFIG.FREE_SHIPPING_ITEM_THRESHOLD
// (js/shared.js) — the same number checkout.js uses to actually zero out the
// shipping line, so the promise this bar makes is always kept.
function updateFreeShippingBar() {
  const threshold = CONFIG.FREE_SHIPPING_ITEM_THRESHOLD;
  if (!threshold || threshold <= 0 || state.cart.length === 0) {
    dom.freeShippingBar.hidden = true;
    dom.cartSubtotalBlock.hidden = true;
    return;
  }

  const count = cartCount();
  const remaining = Math.max(0, threshold - count);
  const percent = Math.min(100, (count / threshold) * 100);

  dom.freeShippingBar.hidden = false;
  dom.freeShippingFill.style.width = `${percent}%`;

  dom.cartSubtotalBlock.hidden = false;
  dom.cartSubtotalAmount.textContent = formatPrice(cartTotal());
  dom.cartSubtotalShippingNote.textContent =
    remaining === 0 ? 'Unlocked' : `Add ${remaining} item${remaining === 1 ? '' : 's'}`;

  if (remaining === 0) {
    dom.freeShippingBar.classList.add('unlocked');
    dom.freeShippingText.innerHTML = `You've unlocked <strong>Free Shipping</strong>!`;
  } else {
    dom.freeShippingBar.classList.remove('unlocked');
    dom.freeShippingText.innerHTML = `Add <strong>${remaining}</strong> more item${remaining === 1 ? '' : 's'} for <strong>Free Shipping</strong>`;
  }
}

// "Others Also Bought" — pulled from products the admin flagged with a
// `cartSuggestion: true` field on the Firestore product document, not
// computed automatically. Products already sitting in the cart are
// skipped so the strip never suggests something the shopper already added.
function renderCartUpsell() {
  if (state.cart.length === 0) {
    dom.cartUpsell.hidden = true;
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
  dom.cartUpsellTrack.innerHTML = items.map((p) => cartUpsellCardHtml(p)).join('');
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

/* --------------------------------------------------------------------------
   8. CART PANEL UI (open/close, shipping accordion, "Complete Order" nav)
   -------------------------------------------------------------------------- */
function openCart() {
  closeSignin(); // keep only one side drawer open at a time
  dom.cartPanel.classList.add('open');
  dom.cartOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  dom.cartPanel.classList.remove('open');
  dom.cartOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   8b. SIGN IN DRAWER (Section 1: login + forgot password, Section 2: link
   to register.html). Wired straight into window.RareVisionAuth, exposed by
   js/auth.js (loaded as a <script type="module"> in index.html's <head>,
   so it runs and sets window.RareVisionAuth before this deferred script does).
   -------------------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

function openSignin() {
  closeCart(); // keep only one side drawer open at a time
  clearSigninMessages();
  dom.signinPanel.classList.add('open');
  dom.signinOverlay.classList.add('show');
  dom.signinPanel.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => dom.signinEmail.focus(), 60);
}

function closeSignin() {
  dom.signinPanel.classList.remove('open');
  dom.signinOverlay.classList.remove('show');
  dom.signinPanel.setAttribute('aria-hidden', 'true');
  if (!dom.cartPanel.classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

function clearSigninMessages() {
  dom.signinFormError.hidden = true;
  dom.signinFormError.textContent = '';
  dom.signinFormSuccess.hidden = true;
  dom.signinFormSuccess.textContent = '';
}

function showSigninError(message) {
  dom.signinFormSuccess.hidden = true;
  dom.signinFormError.textContent = message;
  dom.signinFormError.hidden = false;
}

function showSigninSuccess(message) {
  dom.signinFormError.hidden = true;
  dom.signinFormSuccess.textContent = message;
  dom.signinFormSuccess.hidden = false;
}

function setSigninLoading(isLoading) {
  dom.signinSubmitBtn.disabled = isLoading;
  dom.signinSubmitBtn.querySelector('.btn-text').hidden = isLoading;
  dom.signinSubmitBtn.querySelector('.btn-spinner').hidden = !isLoading;
}

function togglePasswordVisibility() {
  const showing = dom.signinPassword.type === 'text';
  dom.signinPassword.type = showing ? 'password' : 'text';
  dom.signinPasswordToggle.classList.toggle('is-visible', !showing);
  dom.signinPasswordToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
}

async function handleSigninSubmit(e) {
  e.preventDefault();
  clearSigninMessages();

  if (!window.RareVisionAuth) {
    showSigninError('Sign in is not available right now. Please refresh and try again.');
    return;
  }

  const email = dom.signinEmail.value.trim();
  const password = dom.signinPassword.value;

  if (!email || !password) {
    showSigninError('Please fill in both your email and password.');
    if (!email) dom.signinEmail.focus(); else dom.signinPassword.focus();
    return;
  }
  if (!isValidEmail(email)) {
    showSigninError('Please enter a valid email address.');
    dom.signinEmail.focus();
    return;
  }

  setSigninLoading(true);
  const result = await window.RareVisionAuth.loginUser(email, password);
  setSigninLoading(false);

  if (result.success) {
    const firstName = result.user && result.user.displayName ? result.user.displayName.split(' ')[0] : '';
    showToast(firstName ? `Welcome back, ${firstName}!` : 'Welcome back!');
    dom.signinForm.reset();
    closeSignin();
  } else {
    showSigninError(result.message);
  }
}

async function handleForgotPassword() {
  clearSigninMessages();

  if (!window.RareVisionAuth) {
    showSigninError('Password reset is not available right now. Please refresh and try again.');
    return;
  }

  const email = dom.signinEmail.value.trim();
  if (!email) {
    showSigninError('Enter your email above, then tap "Forgot your password?" again.');
    dom.signinEmail.focus();
    return;
  }
  if (!isValidEmail(email)) {
    showSigninError('Please enter a valid email address.');
    dom.signinEmail.focus();
    return;
  }

  dom.forgotPasswordBtn.disabled = true;
  const result = await window.RareVisionAuth.resetPassword(email);
  dom.forgotPasswordBtn.disabled = false;

  if (result.success) {
    showSigninSuccess(`Password reset email sent to ${email}.`);
  } else {
    showSigninError(result.message);
  }
}

// Reflects the shopper's signed-in state on the header's Account icon: a
// small gold dot when signed in, and clicking the icon signs them out
// instead of reopening this drawer. See js/auth.js's onAuthChange().
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
  const isOpen = dom.shippingAccordionPanel.hidden === false;
  dom.shippingAccordionPanel.hidden = isOpen;
  dom.shippingAccordionTrigger.setAttribute('aria-expanded', String(!isOpen));
  dom.shippingAccordion.classList.toggle('open', !isOpen);
}

function toggleDiscountAccordion() {
  const isOpen = dom.discountAccordionPanel.hidden === false;
  dom.discountAccordionPanel.hidden = isOpen;
  dom.discountAccordionTrigger.setAttribute('aria-expanded', String(!isOpen));
  dom.discountAccordion.classList.toggle('open', !isOpen);
  if (!isOpen) dom.cartDiscountInput.focus();
}

// Checks the code against the same CONFIG.DISCOUNT_CODES used at checkout
// (js/shared.js), then persists it via saveDiscount() so checkout.html
// picks up the same applied code automatically.
function applyCartDiscountCode() {
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
  const message =
    match.type === 'shipping'
      ? `Code "${code}" applied — free shipping at checkout.`
      : `Code "${code}" applied.`;
  showCartDiscountMessage(message, false);
  renderCart();
}

function showCartDiscountMessage(text, isError) {
  dom.cartDiscountMessage.textContent = text;
  dom.cartDiscountMessage.hidden = false;
  dom.cartDiscountMessage.classList.toggle('error', isError);
}

/* --------------------------------------------------------------------------
   9. UTILITIES
   formatPrice / escapeHtml come from shared.js.
   -------------------------------------------------------------------------- */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => dom.toast.classList.remove('show'), 2400);
}

// Renders a fixed 5-star row, filling stars up to the nearest whole number.
// (A simplified alternative to half-star precision — swap in an SVG-based
// renderer later if you want fractional stars.)
function renderStars(rating) {
  const rounded = Math.round(Number(rating) || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= rounded ? 'filled' : ''}">★</span>`;
  }
  return html;
}

// A deliberately small, dependency-free Markdown subset renderer.
// Supports: **bold**, *italic*, [text](url) links, "- " bullet lists,
// "1. " numbered lists, and paragraphs (blank-line OR list-boundary separated).
// The source text is HTML-escaped BEFORE any tags are added, so this is
// safe to use even if a product's description ever contains stray angle
// brackets.
//
// Deliberately line-based rather than blank-line-block-based: whoever is
// writing product descriptions very often types a lead-in line directly
// above a list with no blank line
// in between (e.g. "Highlights:" followed immediately by "- Feature one"),
// and that lead-in line still needs to render as its own paragraph rather
// than getting swallowed into a non-list block.
function renderMarkdownLite(raw) {
  if (!raw) return '';
  const lines = escapeHtml(raw).split('\n');

  const htmlBlocks = [];
  let paragraphLines = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      htmlBlocks.push(`<p>${inlineMarkdown(paragraphLines.join('<br>'))}</p>`);
      paragraphLines = [];
    }
  }

  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      flushParagraph();
      i++;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      flushParagraph();
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^-\s+/, ''))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    paragraphLines.push(trimmed);
    i++;
  }
  flushParagraph();

  return htmlBlocks.join('');
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/* --------------------------------------------------------------------------
   STATIC EVENT BINDINGS
   -------------------------------------------------------------------------- */
function bindStaticEvents() {
  bindProductGridEvents();

  // BUGFIX (QA pass): this used to bind a click listener to
  // dom.headerSearchBtn here. #headerSearchBtn (the old icon-only search
  // button) was removed from the header markup in favor of the full
  // #headerSearchForm search bar that js/header.js now owns (see
  // js/header.js's initHeaderSearch() and its own "INTEGRATION POINTS"
  // note #3). Since dom.headerSearchBtn was therefore always null,
  // `.addEventListener` on it threw a TypeError right here on every page
  // load — which meant EVERY binding below this line in this function
  // (search box, category pills, reset filters, pagination, gender
  // dropdown, view-all/footer-filter links, scroll-to-top, the entire cart
  // panel, the product modal, the sign-in drawer, and the guest discount
  // popup) silently never got wired up. Removed; the header search bar's
  // functionality lives entirely in js/header.js now.

  // Search box (Shop by Category)
  dom.searchInput.addEventListener('input', handleSearchInput);
  dom.searchClear.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchTerm = '';
    dom.searchClear.hidden = true;
    applyFilters();
  });

  // Category filter pills
  dom.categoryPills.querySelectorAll('.pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      if (pill.dataset.filter) setActiveCollection(pill.dataset.filter);
      else setActiveCategory(pill.dataset.category);
    });
  });

  dom.resetFilters.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchTerm = '';
    dom.searchClear.hidden = true;
    setActiveGender('all');
    setActiveCategory('all');
    setActiveCollection('all');
  });

  dom.sortSelect?.addEventListener('change', () => {
    state.sort = dom.sortSelect.value;
    applyFilters();
  });

  // Pagination controls (Previous / page numbers / Next) — delegated since
  // the buttons are re-rendered on every filter/page change.
  dom.paginationControls.addEventListener('click', (e) => {
    const btn = e.target.closest('.page-btn:not(:disabled)');
    if (!btn) return;
    const page = Number(btn.dataset.page);
    if (!Number.isFinite(page) || page < 1 || page === state.currentPage) return;
    state.currentPage = page;
    renderShopGrid(state.filtered);
    document.getElementById('shop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Custom gender dropdown
  dom.genderDropdownBtn.addEventListener('click', () => {
    const willOpen = dom.genderDropdownMenu.hidden;
    dom.genderDropdownMenu.hidden = !willOpen;
    dom.genderDropdownBtn.setAttribute('aria-expanded', String(willOpen));
    dom.genderDropdown.classList.toggle('open', willOpen);
  });
  dom.genderDropdownMenu.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      setActiveGender(li.dataset.value);
      closeGenderDropdown();
    });
  });
  document.addEventListener('click', (e) => {
    if (!dom.genderDropdown.contains(e.target)) closeGenderDropdown();
  });

  // Footer "Shop by Category" links
  document.querySelectorAll('[data-action="footer-filter"]').forEach((link) => {
    link.addEventListener('click', () => {
      if (link.dataset.category) setActiveCategory(link.dataset.category);
      if (link.dataset.gender) setActiveGender(link.dataset.gender);
    });
  });

  // BUGFIX (QA pass): the scroll-to-top button (#scrollTopBtn) lives inside
  // footer.html, injected asynchronously by js/footer-loader.js — it isn't
  // in the DOM yet when this function runs, so dom.scrollTopBtn was always
  // null here too. footer-loader.js already wires this button's click
  // handler itself once the footer fragment is actually injected (see its
  // wireScrollTop()), so no binding is needed here.

  // Cart panel
  dom.cartToggle.addEventListener('click', openCart);
  dom.cartClose.addEventListener('click', closeCart);
  dom.cartOverlay.addEventListener('click', closeCart);
  dom.cartEmptyShop.addEventListener('click', closeCart);
  dom.shippingAccordionTrigger.addEventListener('click', toggleShippingAccordion);
  dom.discountAccordionTrigger.addEventListener('click', toggleDiscountAccordion);
  dom.cartApplyDiscountBtn.addEventListener('click', applyCartDiscountCode);
  dom.cartDiscountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCartDiscountCode();
    }
  });

  // Sign in drawer
  dom.accountToggle.addEventListener('click', handleAccountToggleClick);
  dom.signinClose.addEventListener('click', closeSignin);
  dom.signinOverlay.addEventListener('click', closeSignin);
  dom.signinForm.addEventListener('submit', handleSigninSubmit);
  dom.signinPasswordToggle.addEventListener('click', togglePasswordVisibility);
  dom.forgotPasswordBtn.addEventListener('click', handleForgotPassword);

  // Guest discount popup
  dom.discountPopupForm.addEventListener('submit', handleDiscountPopupSubmit);
  dom.discountPopupClose.addEventListener('click', () => closeDiscountPopup(true));
  dom.discountPopupOverlay.addEventListener('click', () => closeDiscountPopup(true));
  dom.discountPopupDismiss.addEventListener('click', () => closeDiscountPopup(true));
  dom.discountPopupDone.addEventListener('click', () => closeDiscountPopup());

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (dom.discountPopup.classList.contains('open')) {
      closeDiscountPopup(true);
    } else if (dom.signinPanel.classList.contains('open')) {
      closeSignin();
    } else {
      closeCart();
    }
  });

  // "Complete Order" hands off to the dedicated checkout page. The cart
  // itself is read from localStorage there (via shared.js), so no data
  // needs to be passed through the URL.
  dom.checkoutBtn.addEventListener('click', () => {
    if (dom.checkoutBtn.disabled) return;
    window.location.href = 'checkout.html';
  });
}

const CATALOG_FILTERS = new Set(['all', 'new-arrivals', 'best-sellers']);

function applyCatalogRoute(params) {
  const filter = params.get('filter');
  if (CATALOG_FILTERS.has(filter)) state.activeCollection = filter;
  const category = params.get('cat');
  if (category && ['Shoes', 'Clothes', 'Accessories'].includes(category)) state.activeCategory = category;
  const gender = params.get('gender');
  if (gender && ['Men', 'Women', 'Kids', 'Unisex'].includes(gender)) state.activeGender = gender;
  const sort = params.get('sort');
  if (sort && dom.sortSelect?.querySelector(`option[value="${sort}"]`)) {
    state.sort = sort;
    dom.sortSelect.value = sort;
  }
  const query = params.get('q');
  if (query && !state.searchTerm) {
    state.searchTerm = query.trim().toLowerCase();
    dom.searchInput.value = query;
    dom.searchClear.hidden = !state.searchTerm;
  }
  updateCatalogControls();
  if (state.activeGender !== 'all') {
    const option = dom.genderDropdownMenu?.querySelector(`[data-value="${state.activeGender}"]`);
    if (option) dom.genderDropdownLabel.textContent = option.textContent;
  }
}

function setActiveCollection(filter) {
  state.activeCollection = CATALOG_FILTERS.has(filter) ? filter : 'all';
  updateCatalogControls();
  if (document.getElementById('shopCatalogTitle')) {
    const url = new URL(window.location.href);
    url.searchParams.set('filter', state.activeCollection);
    window.history.replaceState({}, '', url);
  }
  applyFilters();
}

function updateCatalogControls() {
  dom.categoryPills?.querySelectorAll('.pill').forEach((pill) => {
    const value = pill.dataset.filter || pill.dataset.category;
    const active = pill.dataset.filter
      ? pill.dataset.filter === state.activeCollection
      : pill.dataset.category === state.activeCategory && state.activeCollection === 'all';
    pill.classList.toggle('active', active);
    if (value === state.activeCollection && pill.dataset.filter) pill.setAttribute('aria-pressed', 'true');
    else pill.removeAttribute('aria-pressed');
  });
  const title = document.getElementById('shopCatalogTitle');
  if (title) title.textContent = ({ all: 'ALL PRODUCTS', 'new-arrivals': 'NEW ARRIVALS', 'best-sellers': 'BEST SELLERS' })[state.activeCollection];
}

function setActiveCategory(category) {
  state.activeCategory = category || 'all';
  state.activeCollection = 'all';
  updateCatalogControls();
  applyFilters();
}

function setActiveGender(gender) {
  state.activeGender = gender;
  const option = dom.genderDropdownMenu.querySelector(`[data-value="${gender}"]`);
  dom.genderDropdownLabel.textContent = option ? option.textContent : 'All Genders';
  dom.genderDropdownMenu.querySelectorAll('li').forEach((li) => {
    li.classList.toggle('selected', li.dataset.value === gender);
  });
  applyFilters();
}

function closeGenderDropdown() {
  dom.genderDropdownMenu.hidden = true;
  dom.genderDropdownBtn.setAttribute('aria-expanded', 'false');
  dom.genderDropdown.classList.remove('open');
}

/* --------------------------------------------------------------------------
   10. GUEST DISCOUNT POPUP
   2-minute IDLE-triggered offer: signed-out shoppers who go
   DISCOUNT_POPUP_DELAY_MS with no mouse/keyboard/scroll/touch activity get
   a 15%-off code (RV03) in exchange for their email. The idle timer resets
   on every activity event (see DISCOUNT_POPUP_ACTIVITY_EVENTS above) and
   only fires after a full idle stretch — so an actively-browsing shopper
   never sees it, no matter how long they've been on the page.

   Submitting writes a `subscribers` doc and an `emailQueue` job via
   window.RareVisionFirebase.subscribeForDiscount() (see js/firebase-data.js)
   — this is the audience-list write, and the emailQueue doc is a fallback
   a Cloud Function/worker could pick up later. The immediate send now goes
   through window.RareVisionEmail.sendWelcomeEmail() (see the module bridge
   at the bottom of js/email-dispatcher.js), fired right after the
   subscription write succeeds — see handleDiscountPopupSubmit() below.
   -------------------------------------------------------------------------- */
let discountIdleTimer = null;

function scheduleGuestDiscountPopup() {
  if (dom.discountPopupCode) dom.discountPopupCode.textContent = DISCOUNT_POPUP_CODE;
  if (hasSeenDiscountPopup()) return;

  resetDiscountIdleTimer();
  DISCOUNT_POPUP_ACTIVITY_EVENTS.forEach((evt) => {
    document.addEventListener(evt, resetDiscountIdleTimer, { passive: true });
  });
}

// Restarts the idle countdown. Called once on page load (counts as idle
// until the shopper's first interaction) and again on every qualifying
// activity event.
function resetDiscountIdleTimer() {
  if (hasSeenDiscountPopup()) {
    stopDiscountIdleTracking();
    return;
  }
  if (discountIdleTimer) clearTimeout(discountIdleTimer);
  discountIdleTimer = setTimeout(maybeShowGuestDiscountPopup, DISCOUNT_POPUP_DELAY_MS);
}

// Tears down the idle-activity listeners for the rest of this page view —
// called once the popup has been shown/claimed/dismissed, or the instant a
// guest signs in, so we're not paying for event listeners no longer needed.
function stopDiscountIdleTracking() {
  if (discountIdleTimer) {
    clearTimeout(discountIdleTimer);
    discountIdleTimer = null;
  }
  DISCOUNT_POPUP_ACTIVITY_EVENTS.forEach((evt) => {
    document.removeEventListener(evt, resetDiscountIdleTimer, { passive: true });
  });
}

// Registered on window.RareVisionAuth.onAuthChange() in init(). Signed-in
// shoppers must never see the guest offer — this fires the moment auth
// state resolves to a user (whether they were already signed in on load,
// or just signed in mid-session) and both stops the idle timer and closes
// the popup if it happened to already be open.
function handleAuthChangeForDiscountPopup(user) {
  if (!user) return;
  stopDiscountIdleTracking();
  if (dom.discountPopup.classList.contains('open')) {
    closeDiscountPopup(); // don't markSeen — this is an auth-state hide, not a dismissal
  }
}

function hasSeenDiscountPopup() {
  try {
    return localStorage.getItem(DISCOUNT_POPUP_SEEN_KEY) === '1';
  } catch (err) {
    // localStorage can throw in some private-browsing modes — treat that
    // the same as "hasn't seen it" rather than crashing the timer.
    return false;
  }
}

function markDiscountPopupSeen() {
  try {
    localStorage.setItem(DISCOUNT_POPUP_SEEN_KEY, '1');
  } catch (err) {
    // Non-fatal: worst case the popup is eligible to show again later.
  }
}

function maybeShowGuestDiscountPopup() {
  if (hasSeenDiscountPopup()) return;

  // window.RareVisionAuth.getCurrentUser() is the same synchronous getter
  // js/auth.js already exposes for the header's account icon (see
  // handleAccountToggleClick() above) — null/undefined means signed out.
  const user = window.RareVisionAuth ? window.RareVisionAuth.getCurrentUser() : null;
  if (user) return; // signed-in shoppers never see the guest offer

  // Don't stack this popup on top of another open panel — check back
  // shortly instead of interrupting whatever the shopper is doing.
  const somethingElseOpen =
    dom.signinPanel.classList.contains('open') ||
    dom.cartPanel.classList.contains('open');
  if (somethingElseOpen) {
    setTimeout(maybeShowGuestDiscountPopup, 5000);
    return;
  }

  openDiscountPopup();
}

function openDiscountPopup() {
  // Popup is up — no need to keep listening for idle/activity resets
  // (which would otherwise just re-fire maybeShowGuestDiscountPopup on top
  // of itself once the shopper moves their mouse over the modal).
  stopDiscountIdleTracking();
  resetDiscountPopupView();
  dom.discountPopupOverlay.classList.add('show');
  dom.discountPopup.classList.add('open');
  dom.discountPopup.setAttribute('aria-hidden', 'false');
}

function closeDiscountPopup(markSeen) {
  dom.discountPopupOverlay.classList.remove('show');
  dom.discountPopup.classList.remove('open');
  dom.discountPopup.setAttribute('aria-hidden', 'true');
  if (markSeen) {
    markDiscountPopupSeen();
    stopDiscountIdleTracking();
  }
}

function resetDiscountPopupView() {
  dom.discountPopupForm.hidden = false;
  dom.discountPopupSuccess.hidden = true;
  dom.discountPopupDismiss.hidden = false;
  dom.discountPopupError.hidden = true;
  dom.discountPopupEmail.value = '';
}

// BUGFIX (QA pass): this file used to declare a second, slightly different
// `isValidEmail(value)` function here, silently shadowing the one already
// defined in section 8b (near EMAIL_RE, used by the sign-in/forgot-password
// forms). Two function declarations with the same name in the same scope
// is a code-health smell (whichever is defined last silently wins) even
// though both regexes happened to behave the same in practice — the
// sign-in forms' version already handles a non-string/undefined `value`
// safely (`String(value || '')`), so that's the one kept; this popup now
// reuses it instead of maintaining a second copy.
async function handleDiscountPopupSubmit(e) {
  e.preventDefault();
  const email = dom.discountPopupEmail.value.trim();

  if (!isValidEmail(email)) {
    dom.discountPopupError.textContent = 'Please enter a valid email address.';
    dom.discountPopupError.hidden = false;
    return;
  }
  dom.discountPopupError.hidden = true;

  const btn = dom.discountPopupSubmit;
  const btnText = btn.querySelector('.btn-text');
  const btnSpinner = btn.querySelector('.btn-spinner');
  btn.disabled = true;
  if (btnText) btnText.hidden = true;
  if (btnSpinner) btnSpinner.hidden = false;

  try {
    if (window.RareVisionFirebase && typeof window.RareVisionFirebase.subscribeForDiscount === 'function') {
      await window.RareVisionFirebase.subscribeForDiscount(email);
    }

    // Fire the actual welcome/discount-code email through the dispatcher
    // bridge (see the window.RareVisionEmail export at the bottom of
    // js/email-dispatcher.js). Deliberately NOT awaited and NOT allowed to
    // fail the submission: the audience-list write above already
    // succeeded, so the popup should show the success state regardless of
    // whether the email transport is fast, slow, or (via its own internal
    // tier fallback down to an emailQueue doc) still in flight.
    if (window.RareVisionEmail && typeof window.RareVisionEmail.sendWelcomeEmail === 'function') {
      window.RareVisionEmail.sendWelcomeEmail(email, { firstName: undefined }).catch((err) => {
        console.error('[main] sendWelcomeEmail failed (subscription itself still succeeded):', err);
      });
    }

    dom.discountPopupForm.hidden = true;
    dom.discountPopupDismiss.hidden = true;
    dom.discountPopupSuccess.hidden = false;
    markDiscountPopupSeen();
    stopDiscountIdleTracking();
    showToast('Check your inbox — your 15% off code is on its way.');
  } catch (err) {
    console.error('Failed to save subscriber email', err);
    dom.discountPopupError.textContent = 'Something went wrong saving your email. Please try again.';
    dom.discountPopupError.hidden = false;
  } finally {
    btn.disabled = false;
    if (btnText) btnText.hidden = false;
    if (btnSpinner) btnSpinner.hidden = true;
  }
}

/* --------------------------------------------------------------------------
   11. SILENT VISITOR TRACKING (Admin Analytics)
   Fire-and-forget page-view ping for the Admin Analytics dashboard. Fires
   once per page load, does not touch the DOM, shows no UI, and never
   throws or delays anything else in init() — a failure here (ad blocker,
   offline, Firestore rules, etc.) is silently swallowed.

   main.js is loaded as a classic (non-module) script, so it can't `import`
   Firestore itself — like fetchProducts()/subscribeForDiscount() above,
   this goes through the window.RareVisionFirebase bridge that
   js/firebase-data.js (a <script type="module">) is expected to expose.
   NOTE: js/firebase-data.js was not part of this change set, so the write
   itself still needs a matching bridge method added there, e.g.:

     // js/firebase-data.js
     import { collection, addDoc, serverTimestamp } from '...firebase-firestore.js';
     async function logVisitor(payload) {
       return addDoc(collection(db, 'visitors'), { ...payload, createdAt: serverTimestamp() });
     }
     window.RareVisionFirebase = { ...window.RareVisionFirebase, logVisitor };

   Until that bridge method exists, the guard below makes this a safe
   no-op rather than a thrown error.
   -------------------------------------------------------------------------- */
function logVisitorPing() {
  try {
    if (!window.RareVisionFirebase || typeof window.RareVisionFirebase.logVisitor !== 'function') return;

    const payload = {
      path: window.location.pathname,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(), // client-side hint; the Firestore bridge should also stamp serverTimestamp()
    };

    // Not awaited on purpose — this must never delay or block page init.
    Promise.resolve(window.RareVisionFirebase.logVisitor(payload)).catch((err) => {
      console.error('[main] logVisitorPing failed (non-fatal):', err);
    });
  } catch (err) {
    console.error('[main] logVisitorPing failed (non-fatal):', err);
  }
}
