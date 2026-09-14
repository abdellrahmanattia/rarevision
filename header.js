/* ==========================================================================
   RARE VISION — js/header.js
   Task 1.2: Global Header Overhaul (search bar, bell notifications drawer,
   hamburger nav drawer, account button auth-gating) — now also the sole
   owner of the header's Cart (#cartPanel) and Sign In (#signinPanel) side
   drawers. See "INTEGRATION POINTS" at the bottom for why that last part
   matters and what it's doing about js/main.js.

   DESIGN NOTE — why this is a separate module and not a main.js edit:
   js/auth.js/js/shared.js and js/firebase-data.js were not included in this
   upload, so their contents/selectors are unknown. Rather than guess and
   risk breaking existing behavior, this file is entirely self-contained: it
   imports `auth`/`db` straight from firebase-config.js and drives the new
   markup on its own. Where it needs to talk to functionality that almost
   certainly already lives in main.js (the shop search box, the category
   pills), it does so *indirectly* — by dispatching real input/click events
   at the existing elements — instead of re-implementing that logic here.
   The Cart and Sign In drawers are the one exception to that "don't
   duplicate main.js" rule — see the section headers below and
   "INTEGRATION POINTS" for why.
   ========================================================================== */

import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', init);

function init() {
  initLogoFallback();
  initHeaderSearch();
  initNotifications();
  initNavDrawer();
  initCartDrawer();
  initSigninDrawer();
  initSigninForm();
  initAccount();
  initGlobalDismiss();
}

/* ==========================================================================
   Shared helpers
   ========================================================================== */

function qs(id) { return document.getElementById(id); }

function lockScroll() { document.body.style.overflow = 'hidden'; }
function unlockScroll() {
  // Only release the lock if none of the drawers/modals THIS file owns are
  // still open. Cart and Sign In are included here now too (see the two
  // sections below) — this file owns their open/close lifecycle end to end,
  // so it's responsible for not stomping on, say, the notify drawer's
  // scroll lock when the cart closes.
  const stillOpen = [qs('notifyPanel'), qs('navDrawer'), qs('profileModal'), qs('cartPanel'), qs('signinPanel')]
    .some(el => el && (el.classList.contains('open') || el.classList.contains('show')));
  if (!stillOpen) document.body.style.overflow = '';
}

/** Simple local toast, independent of whatever shared.js/main.js may also
 *  do with #toast — scoped to this file's own actions only. */
function showLocalToast(message) {
  const toast = qs('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showLocalToast._t);
  showLocalToast._t = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ==========================================================================
   Logo — swap to a text fallback if the image asset fails to load, so a
   missing/renamed file doesn't leave the header blank.
   ========================================================================== */
function initLogoFallback() {
  document.querySelectorAll('.logo-img').forEach(img => {
    img.addEventListener('error', () => {
      const fallback = document.createElement('span');
      fallback.className = 'logo-lockup-fallback';
      fallback.innerHTML = '<span class="logo-rare">RARE</span><span class="logo-vision">VISION</span>';
      img.replaceWith(fallback);
    }, { once: true });
  });
}

/* ==========================================================================
   Header search bar (Image 1)
   On pages that already have the shop grid (index.html/shop.html), this
   reuses the EXISTING search input (#searchInput) and category pills
   (.pill[data-category]) rather than re-implementing filtering here — it
   dispatches the same events a person interacting with those controls
   directly would produce. On pages without that grid (e.g. product.html),
   there's nothing to dispatch events at, so it falls back to a real
   navigation to shop.html with the term/category in the query string —
   otherwise submitting the form here would silently do nothing.
   ========================================================================== */
function initHeaderSearch() {
  const form = qs('headerSearchForm');
  const input = qs('headerSearchInput');
  const categorySelect = qs('headerSearchCategory');
  if (!form || !input || !categorySelect) return;

  // Optionally replace the hardcoded category options with
  // siteSettings/general.categoriesList, if the document defines one.
  // One-time read — this list changes rarely, so a live listener isn't
  // needed here the way it is for notifications.
  getDoc(doc(db, 'siteSettings', 'general'))
    .then(snap => {
      const list = snap.exists() ? snap.data().categoriesList : null;
      if (Array.isArray(list) && list.length) {
        const current = categorySelect.value;
        categorySelect.innerHTML = '<option value="all" selected>All</option>' +
          list.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
        categorySelect.value = current || 'all';
      }
    })
    .catch(err => console.warn('[header] could not load siteSettings/general.categoriesList:', err));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const term = input.value.trim();
    const category = categorySelect.value;

    const shopSearchInput = qs('searchInput');
    const shopSection = qs('shop');

    if (shopSearchInput && shopSection) {
      // Already on a page with the shop grid — push the term into its own
      // search box and let its existing listener (in main.js) do the
      // actual filtering, then select the matching category pill the same
      // way a click would.
      shopSearchInput.value = term;
      shopSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const pillSelector = category === 'all'
        ? '.pill[data-category="all"]'
        : `.pill[data-category="${CSS.escape(category)}"]`;
      document.querySelector(pillSelector)?.click();

      shopSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // No shop grid on this page (e.g. product.html) — navigate for real.
    const url = new URL('shop.html', window.location.href);
    if (term) url.searchParams.set('q', term);
    if (category && category !== 'all') url.searchParams.set('cat', category);
    window.location.href = url.toString();
  });
}

/* ==========================================================================
   Notification bell + drawer (Image 3)
   Live Firestore query against notifications/{id} where isGlobal == true,
   newest first. Unread state is tracked locally (localStorage) since the
   data contract doesn't define a per-notification read flag.
   ========================================================================== */
const LAST_SEEN_KEY = 'rv_notifications_last_seen_ms';

function initNotifications() {
  const btn = qs('notifyBtn');
  const overlay = qs('notifyOverlay');
  const panel = qs('notifyPanel');
  const closeBtn = qs('notifyClose');
  const list = qs('notifyList');
  const empty = qs('notifyEmpty');
  const loading = qs('notifyLoading');
  const badge = qs('notifyBadge');
  if (!btn || !overlay || !panel || !list || !empty || !loading || !badge) return;

  let latestDocs = [];

  function open() {
    closeOtherOverlays('notify');
    overlay.classList.add('show');
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    lockScroll();
    markAllSeen();
  }
  function close() {
    overlay.classList.remove('show');
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
    unlockScroll();
  }
  btn.addEventListener('click', () => {
    panel.classList.contains('open') ? close() : open();
  });
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  registerOverlay('notify', close);

  function getLastSeenMs() {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? Number(raw) : 0;
  }

  function markAllSeen() {
    const newest = latestDocs[0]?.createdAtMs || Date.now();
    window.localStorage.setItem(LAST_SEEN_KEY, String(newest));
    badge.hidden = true;
    list.querySelectorAll('.notify-item.unread').forEach(el => el.classList.remove('unread'));
  }

  function updateBadge() {
    const lastSeen = getLastSeenMs();
    const unreadCount = latestDocs.filter(d => d.createdAtMs > lastSeen).length;
    if (unreadCount > 0) {
      badge.hidden = false;
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    } else {
      badge.hidden = true;
    }
  }

  function render() {
    loading.hidden = true;
    if (!latestDocs.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const lastSeen = getLastSeenMs();
    list.innerHTML = latestDocs.map(n => {
      const unread = n.createdAtMs > lastSeen;
      const thumb = n.thumbnail
        ? `<img class="notify-item-thumb" src="${escapeHtml(n.thumbnail)}" alt="">`
        : `<div class="notify-item-thumb"></div>`;
      return `
        <a class="notify-item${unread ? ' unread' : ''}" href="${escapeHtml(n.link || '#')}">
          ${thumb}
          <div class="notify-item-copy">
            <p class="notify-item-title">${escapeHtml(n.title)}</p>
            ${n.message ? `<p class="notify-item-message">${escapeHtml(n.message)}</p>` : ''}
            ${n.link ? `<span class="notify-item-link">${escapeHtml(n.linkText || 'Shop Now')}</span>` : ''}
          </div>
          <svg class="notify-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>`;
    }).join('');
    updateBadge();
  }

  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('isGlobal', '==', true),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  onSnapshot(notificationsQuery, snapshot => {
    latestDocs = snapshot.docs.map(d => {
      const data = d.data();
      const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || 0);
      return {
        id: d.id,
        title: data.title || 'Update',
        // Data contract names this field `message`; a couple of aliases
        // are accepted defensively in case content is entered differently.
        message: data.message || data.description || '',
        link: data.link || '',
        linkText: data.linkText || data.ctaText || '',
        thumbnail: data.thumbnail || data.image || data.imageUrl || '',
        createdAtMs,
      };
    });
    render();
  }, err => {
    console.error('[header] notifications listener failed:', err);
    loading.hidden = true;
    list.innerHTML = '';
    empty.hidden = false;
    empty.querySelector('.notify-empty-sub').textContent = 'Couldn\u2019t load notifications right now.';
  });
}

/* ==========================================================================
   Full-screen nav drawer (Image 4)
   ========================================================================== */
function initNavDrawer() {
  const toggle = qs('navToggle');
  const overlay = qs('navDrawerOverlay');
  const drawer = qs('navDrawer');
  const closeBtn = qs('navDrawerClose');
  const cartBtn = qs('navDrawerCart');
  const cartBadge = qs('navDrawerCartBadge');
  const mainCartToggle = qs('cartToggle');
  const mainCartBadge = qs('cartBadge');
  if (!toggle || !overlay || !drawer) return;

  function open() {
    closeOtherOverlays('nav');
    overlay.classList.add('show');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll();
  }
  function close() {
    overlay.classList.remove('show');
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    unlockScroll();
  }
  toggle.addEventListener('click', () => {
    drawer.classList.contains('open') ? close() : open();
  });
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  registerOverlay('nav', close);

  // Any link inside the drawer (category/gender filters or plain anchors)
  // closes the drawer after doing its own thing — filtering itself is
  // handled by main.js's existing [data-action="footer-filter"] handler,
  // the same one the footer links already use.
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => close());
  });

  // Cart icon inside the drawer defers to the real cart button so there is
  // exactly one place that owns "open the cart" logic.
  cartBtn?.addEventListener('click', () => {
    close();
    mainCartToggle?.click();
  });

  // Mirror the header cart badge into the drawer's cart badge without
  // needing to know how main.js updates it.
  if (mainCartBadge && cartBadge) {
    const syncBadge = () => {
      cartBadge.textContent = mainCartBadge.textContent;
      cartBadge.classList.toggle('show', mainCartBadge.classList.contains('show'));
    };
    syncBadge();
    new MutationObserver(syncBadge).observe(mainCartBadge, {
      childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'],
    });
  }
}

/* ==========================================================================
   Cart drawer (#cartPanel / #cartOverlay)

   main.js *also* defines an openCart()/closeCart() pair and binds them
   straight to #cartToggle/#cartClose/#cartOverlay. That's fine for the
   "add to cart" success flow and the ?cart=1 deep link, which call those
   functions directly and never go through this file — but it means the
   header icon itself would otherwise have two independent handlers racing
   on every click. This file becomes the single source of truth for THAT
   specific click by calling stopImmediatePropagation() before main.js's
   later-registered listener gets a chance to run (see INTEGRATION POINTS
   for why the load order makes that reliable). It still closes the panel
   correctly no matter which script opened it, since both operate on the
   same #cartPanel/#cartOverlay classes.
   ========================================================================== */
function openCart() {
  closeOtherOverlays('cart');
  qs('cartOverlay')?.classList.add('show');
  qs('cartPanel')?.classList.add('open');
  lockScroll();
}
function closeCart() {
  qs('cartOverlay')?.classList.remove('show');
  qs('cartPanel')?.classList.remove('open');
  unlockScroll();
}
function initCartDrawer() {
  const toggle = qs('cartToggle');
  const overlay = qs('cartOverlay');
  const panel = qs('cartPanel');
  if (!toggle || !overlay || !panel) return;

  toggle.addEventListener('click', e => {
    e.stopImmediatePropagation(); // see section comment above
    openCart();
  });
  qs('cartClose')?.addEventListener('click', e => {
    e.stopImmediatePropagation();
    closeCart();
  });
  overlay.addEventListener('click', e => {
    e.stopImmediatePropagation();
    closeCart();
  });
  registerOverlay('cart', closeCart);
}

/* ==========================================================================
   Sign In drawer (#signinPanel / #signinOverlay)

   Same relationship to main.js as the cart drawer above: main.js's own
   openSignin()/closeSignin() remain in place for the ?signin=1 deep link
   and the "Already have an account?" link on register.html, but the header
   Account icon's signed-out click is fully owned here.
   ========================================================================== */
function openSignin() {
  closeOtherOverlays('signin');
  const panel = qs('signinPanel');
  qs('signinOverlay')?.classList.add('show');
  panel?.classList.add('open');
  panel?.setAttribute('aria-hidden', 'false');
  lockScroll();
}
function closeSignin() {
  const panel = qs('signinPanel');
  qs('signinOverlay')?.classList.remove('show');
  panel?.classList.remove('open');
  panel?.setAttribute('aria-hidden', 'true');
  unlockScroll();
}
function initSigninDrawer() {
  const overlay = qs('signinOverlay');
  const panel = qs('signinPanel');
  if (!overlay || !panel) return;

  qs('signinClose')?.addEventListener('click', e => {
    e.stopImmediatePropagation();
    closeSignin();
  });
  overlay.addEventListener('click', e => {
    e.stopImmediatePropagation();
    closeSignin();
  });
  registerOverlay('signin', closeSignin);
}

/* ==========================================================================
   Sign In drawer — form behavior (#signinForm)

   Kept separate from initSigninDrawer() above (which only owns open/close)
   so the drawer's plumbing and its form logic can be reasoned about
   independently. Signing in successfully doesn't need to do anything else
   here: the onAuthStateChanged listener in initAccount() below picks up
   the new user automatically for the next Account click.
   ========================================================================== */
function initSigninForm() {
  const form = qs('signinForm');
  const emailInput = qs('signinEmail');
  const passwordInput = qs('signinPassword');
  const passwordToggle = qs('signinPasswordToggle');
  const forgotBtn = qs('signinForgotPassword');
  const errorEl = qs('signinError');
  const successEl = qs('signinSuccess');
  const submitBtn = qs('signinSubmit');
  if (!form || !emailInput || !passwordInput) return;

  function showError(message) {
    if (successEl) successEl.hidden = true;
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  function showSuccess(message) {
    if (errorEl) errorEl.hidden = true;
    if (!successEl) return;
    successEl.textContent = message;
    successEl.hidden = false;
  }
  function clearMessages() {
    if (errorEl) errorEl.hidden = true;
    if (successEl) successEl.hidden = true;
  }

  passwordToggle?.addEventListener('click', e => {
    e.stopImmediatePropagation(); // see INTEGRATION POINTS note 2
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    passwordToggle.classList.toggle('is-visible', !isVisible);
    passwordToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
  });

  forgotBtn?.addEventListener('click', async e => {
    e.stopImmediatePropagation(); // see INTEGRATION POINTS note 2
    const email = emailInput.value.trim();
    if (!email) {
      showError('Enter your email address above, then tap "Forgot password?" again.');
      emailInput.focus();
      return;
    }
    forgotBtn.disabled = true;
    try {
      await sendPasswordResetEmail(auth, email);
      showSuccess('Password reset email sent — check your inbox.');
    } catch (err) {
      console.error('[header] password reset failed:', err);
      showError('Could not send a reset email for that address.');
    } finally {
      forgotBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    e.stopImmediatePropagation(); // see INTEGRATION POINTS note 2
    clearMessages();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showError('Enter your email and password to continue.');
      return;
    }
    submitBtn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      closeSignin();
      form.reset();
      showLocalToast('Signed in');
    } catch (err) {
      console.error('[header] sign in failed:', err);
      showError('Incorrect email or password. Please try again.');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* ==========================================================================
   Account button (header + nav drawer) — Firebase Auth-gated

   Signed out -> openSignin() (above). Signed in -> the existing profile
   modal behavior, unchanged. main.js binds its own handler to the same
   #accountToggle button (sign-in gating + an immediate sign-out on click
   when signed in) — stopImmediatePropagation() below keeps that from
   double-firing alongside this file's behavior for the same reason as the
   cart drawer.
   ========================================================================== */
function initAccount() {
  const accountBtn = qs('accountToggle');
  const drawerAccountBtn = qs('navDrawerAccount');
  const drawerAccountLink = qs('navDrawerAccountLink');
  const overlay = qs('profileModalOverlay');
  const modal = qs('profileModal');
  const closeBtn = qs('profileModalClose');
  const body = qs('profileModalBody');
  if (!overlay || !modal || !body) return;

  let currentUser = null;
  onAuthStateChanged(auth, user => { currentUser = user; });

  function openModal() {
    closeOtherOverlays('profile');
    const email = currentUser?.email || '';
    const initial = email ? email.charAt(0) : '?';
    body.innerHTML = `
      <div class="profile-modal-avatar">${escapeHtml(initial)}</div>
      <p class="profile-modal-email">${escapeHtml(email)}</p>
      <button type="button" class="profile-modal-signout" id="profileSignOutBtn">Sign Out</button>
    `;
    qs('profileSignOutBtn').addEventListener('click', async () => {
      try {
        await signOut(auth);
        showLocalToast('Signed out');
        closeModal();
      } catch (err) {
        console.error('[header] sign out failed:', err);
        showLocalToast('Could not sign out — try again');
      }
    });
    overlay.classList.add('show');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll();
  }
  function closeModal() {
    overlay.classList.remove('show');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }
  closeBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);
  registerOverlay('profile', closeModal);

  function handleAccountClick() {
    if (currentUser) {
      openModal();
    } else {
      openSignin();
    }
  }

  accountBtn?.addEventListener('click', e => {
    e.stopImmediatePropagation(); // see section comment above
    handleAccountClick();
  });
  // Drawer buttons/links must never fall through to a real navigation
  // (there's no working /account route) — preventDefault() first, close
  // the nav drawer out of the way, then trigger the same signed-in/out
  // branching as the header's own Account icon.
  drawerAccountBtn?.addEventListener('click', e => {
    e.preventDefault();
    qs('navDrawer')?.classList.remove('open');
    handleAccountClick();
  });
  drawerAccountLink?.addEventListener('click', e => {
    e.preventDefault();
    qs('navDrawer')?.classList.remove('open');
    handleAccountClick();
  });
}

/* ==========================================================================
   Escape key + overlay registry
   Lets each drawer/modal register a close function so Escape (and opening
   one overlay while another is open) can close whichever is active,
   without the individual init* functions needing to know about each other.
   ========================================================================== */
const overlayCloseFns = {};
function registerOverlay(name, closeFn) { overlayCloseFns[name] = closeFn; }
function closeOtherOverlays(exceptName) {
  Object.entries(overlayCloseFns).forEach(([name, fn]) => {
    if (name !== exceptName) fn();
  });
}

function initGlobalDismiss() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeOtherOverlays(null);
  });
}

/* ==========================================================================
   INTEGRATION POINTS — please double-check in main.js / auth.js
   ==========================================================================
   1. #navToggle, #notifyBtn, #cartToggle, and #accountToggle all have click
      listeners attached HERE, and #cartToggle/#accountToggle are ALSO
      bound in main.js (openCart/closeCart and handleAccountToggleClick).
      This file now wins that race on purpose: because it loads as a
      type="module" script in <head> while main.js is a classic script with
      `defer` at the bottom of <body>, this file's DOMContentLoaded handler
      — and therefore its addEventListener calls — always run first. Each
      handler here calls event.stopImmediatePropagation() as its first line,
      which prevents main.js's same-element listener (registered afterward)
      from firing for that click. If index.html is ever changed so main.js
      loads/registers before this file (e.g. main.js converted to a module,
      or the two script tags reordered), that guarantee breaks and BOTH
      handlers will fire again — worth a comment in main.js too if you can
      touch it, and worth re-testing this specifically if script loading
      ever changes.
   2. Because of (1), main.js's own #accountToggle handler no longer runs on
      icon click — signed-in clicks now open ONLY the #profileModal defined
      here (its "Sign Out" button still calls Firebase's signOut()), instead
      of also triggering main.js's immediate, silent sign-out. main.js's
      openSignin()/closeSignin()/openCart()/closeCart() are otherwise left
      alone and still work for their other call sites (the ?signin=1/
      ?cart=1 deep links, the "add to cart" success flow) since those call
      the functions directly rather than going through a click on these
      specific buttons.
      This file ALSO now owns #signinForm's submit (plus its password-
      visibility toggle and "Forgot password?" button) end to end —
      product.html doesn't load main.js at all, so it needs its own working
      sign-in flow. On pages that DO load main.js and already bind that
      same form, the stopImmediatePropagation() calls on those three
      handlers make this file win the race for the same load-order reason
      as (1); main.js's handler(s) become inert. Worth confirming there
      isn't a second, incompatible sign-in flow living on #signinForm in
      main.js/auth.js before this ships to index.html.
   3. #headerSearchBtn (the old icon-only search button) was removed from
      the header markup in favor of the full search bar. If main.js binds
      anything to that id, that binding is now inert.
   ========================================================================== */
