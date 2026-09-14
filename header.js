/* ==========================================================================
   RARE VISION — js/header.js
   Global Header Overhaul (search bar, bell notifications drawer,
   hamburger nav drawer, account button auth-gating, cart/signin drawers).
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
  const stillOpen = [qs('notifyPanel'), qs('navDrawer'), qs('profileModal'), qs('cartPanel'), qs('signinPanel')]
    .some(el => el && (el.classList.contains('open') || el.classList.contains('show')));
  if (!stillOpen) document.body.style.overflow = '';
}

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
   Logo Fallback
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
   Header Search Bar
   ========================================================================== */
function initHeaderSearch() {
  const form = qs('headerSearchForm');
  const input = qs('headerSearchInput');
  const categorySelect = qs('headerSearchCategory');
  if (!form || !input || !categorySelect) return;

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
      shopSearchInput.value = term;
      shopSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

      const pillSelector = category === 'all'
        ? '.pill[data-category="all"]'
        : `.pill[data-category="${CSS.escape(category)}"]`;
      document.querySelector(pillSelector)?.click();

      shopSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const url = new URL('shop.html', window.location.href);
    if (term) url.searchParams.set('q', term);
    if (category && category !== 'all') url.searchParams.set('cat', category);
    window.location.href = url.toString();
  });
}

/* ==========================================================================
   Notifications Drawer
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
   Full-Screen Navigation Drawer (#navDrawer)
   Strictly opens dynamic slide-out drawer on hamburger click.
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

  toggle.addEventListener('click', (e) => {
    e.stopImmediatePropagation();
    drawer.classList.contains('open') ? close() : open();
  });

  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  registerOverlay('nav', close);

  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => close());
  });

  cartBtn?.addEventListener('click', () => {
    close();
    mainCartToggle?.click();
  });

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
   Cart Drawer (#cartPanel / #cartOverlay)
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
    e.stopImmediatePropagation();
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
   Sign In Drawer (#signinPanel / #signinOverlay)
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
    e.stopImmediatePropagation();
    const isVisible = passwordInput.type === 'text';
    passwordInput.type = isVisible ? 'password' : 'text';
    passwordToggle.classList.toggle('is-visible', !isVisible);
    passwordToggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
  });

  forgotBtn?.addEventListener('click', async e => {
    e.stopImmediatePropagation();
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
    e.stopImmediatePropagation();
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
   Account Button (Profile / Auth Modal)
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
    e.stopImmediatePropagation();
    handleAccountClick();
  });
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
   Overlay Manager
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
