// ===== ロール管理 =====
let currentRole = 'user';

const ADMIN_PASSWORD = 'admin1234';

// ===== カート・返却リスト =====
const cart       = new Set();
const returnList = new Set();

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  applyRole('user');
});

// ===== ロール切り替え =====
function setRole(role) {
  if (role === 'admin' && currentRole !== 'admin') { openAdminPwModal(); return; }
  applyRole(role);
}

function applyRole(role) {
  currentRole = role;
  document.getElementById('role-admin').classList.toggle('active', role === 'admin');
  document.getElementById('role-user').classList.toggle('active', role === 'user');
  document.body.classList.toggle('role-user',  role === 'user');
  document.body.classList.toggle('role-admin', role === 'admin');
  if (role === 'user') {
    const t = document.getElementById('content-import');
    if (t?.classList.contains('active')) showTab('dashboard');
  }
  if (role === 'admin') renderUsersPanel();
  updateCartFab();
  applyFilters();
  if (role !== 'user') showToast('管理者モードに切替', 'info');
}

// ===== 管理者パスワード =====
function openAdminPwModal() {
  const i = document.getElementById('admin-pw-input');
  i.value = '';
  document.getElementById('admin-pw-error').textContent = '';
  document.getElementById('admin-pw-overlay').classList.add('open');
  setTimeout(() => i.focus(), 100);
}
function closeAdminPwModal() {
  document.getElementById('admin-pw-overlay').classList.remove('open');
  document.getElementById('role-admin').classList.remove('active');
  document.getElementById('role-user').classList.add('active');
}
function confirmAdminPw() {
  const i = document.getElementById('admin-pw-input');
  if (i.value === ADMIN_PASSWORD) {
    document.getElementById('admin-pw-overlay').classList.remove('open');
    applyRole('admin');
  } else {
    document.getElementById('admin-pw-error').textContent = 'パスワードが正しくありません';
    i.value = ''; i.focus();
  }
}

// ===== テーブル描画ルーター =====
function renderBooksTable() {
  currentRole === 'admin' ? renderBooksTableAdmin() : renderBooksTableUser();
}

// ===== 利用者テーブル =====
function renderBooksTableUser() {
  const tbody = document.getElementById('books-tbody');
  if (filteredBooks.length === 0) {
    const msg = allBooks.length === 0 ? 'データを読み込んでください' : '検索結果がありません';
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>${msg}</p></div></td></tr>`;
    return;
  }
  const start = (currentPage - 1) * PAGE_SIZE;
  tbody.innerHTML = filteredBooks.slice(start, start + PAGE_SIZE).map(b => {
    const idx = allBooks.indexOf(b);
    return buildRowHTML(b, idx, buildUserActions(b, idx));
  }).join('');
}

function buildUserActions(b, idx) {
  if (b.status === 'available') {
    const inCart = cart.has(idx);
    return `
      <button class="btn-sm" onclick="borrowNow(${idx})"
        style="color:var(--primary);border-color:var(--primary);background:var(--primary-pale)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        今すぐ借りる
      </button>
      <button class="btn-sm" onclick="toggleCart(${idx})"
        style="${inCart ? 'color:var(--success);border-color:var(--success);background:var(--success-pale)' : ''}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        ${inCart ? '追加済み ✓' : 'カートへ'}
      </button>`;
  }
  const inReturn = returnList.has(idx);
  return `<button class="btn-sm" onclick="toggleReturn(${idx})"
    style="${inReturn
      ? 'color:var(--danger);border-color:var(--danger);background:var(--danger-pale)'
      : 'color:var(--success);border-color:var(--success);background:var(--success-pale)'}">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
    ${inReturn ? 'リストから削除' : '返却リストへ'}
  </button>`;
}

// ===== カート操作 =====
function toggleCart(idx) {
  if (cart.has(idx)) cart.delete(idx); else cart.add(idx);
  updateCartFab(); applyFilters();
}
function toggleReturn(idx) {
  if (returnList.has(idx)) returnList.delete(idx); else returnList.add(idx);
  updateCartFab(); applyFilters();
}
function updateCartFab() {
  const fab = document.getElementById('cart-fab');
  if (!fab) return;
  const total = cart.size + returnList.size;
  fab.style.display = (currentRole === 'user' && total > 0) ? 'flex' : 'none';
  document.getElementById('cart-fab-count').textContent = total;
}

// ===== 今すぐ借りる =====
function borrowNow(idx) {
  if (!allBooks[idx]) return;
  openCheckoutModal([idx]);
}

// ===== カートモーダル =====
function openCartModal() { renderCartModal(); document.getElementById('cart-modal-overlay').classList.add('open'); }
function closeCartModal() { document.getElementById('cart-modal-overlay').classList.remove('open'); }

function renderCartModal() {
  const cartItems   = [...cart].map(i => ({ idx: i, book: allBooks[i] })).filter(x => x.book);
  const returnItems = [...returnList].map(i => ({ idx: i, book: allBooks[i] })).filter(x => x.book);
  let html = '';
  if (cartItems.length > 0) {
    html += `<div class="cart-section">
      <div class="cart-section-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        借りる本（${cartItems.length}冊）
      </div>
      <div class="cart-items">${cartItems.map(({ idx, book }) => `
        <div class="cart-item">
          <div class="cart-item-icon">📖</div>
          <div class="cart-item-info">
            <div class="cart-item-title">${esc(book.title)}</div>
            <div class="cart-item-sub">${esc(book.author) || '著者不明'}${book.genre ? ' · ' + esc(book.genre) : ''}</div>
          </div>
          <button class="cart-item-remove" onclick="removeFromCart(${idx})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('')}
      </div>
    </div>`;
  }
  if (returnItems.length > 0) {
    html += `<div class="cart-section">
      <div class="cart-section-title" style="color:var(--success)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
        返却する本（${returnItems.length}冊）
      </div>
      <div class="cart-items">${returnItems.map(({ idx, book }) => `
        <div class="cart-item">
          <div class="cart-item-icon">📚</div>
          <div class="cart-item-info">
            <div class="cart-item-title">${esc(book.title)}</div>
            <div class="cart-item-sub">${esc(book.borrower) || ''}${book.dueDate ? ' · 期限: ' + formatDate(book.dueDate) : ''}</div>
          </div>
          <button class="cart-item-remove" onclick="removeFromReturn(${idx})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`).join('')}
      </div>
    </div>`;
  }
  document.getElementById('cart-modal-body').innerHTML = html;
  const footer = document.getElementById('cart-modal-footer');
  footer.innerHTML = '';
  if (cartItems.length > 0) {
    const idxList = cartItems.map(x => x.idx).join(',');
    footer.innerHTML += `<button class="btn-primary" onclick="openCheckoutModal([${idxList}])">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ${cartItems.length}冊を借りる手続きへ
    </button>`;
  }
  if (returnItems.length > 0) {
    footer.innerHTML += `<button class="btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 14px rgba(16,185,129,0.3)" onclick="confirmReturnList()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
      ${returnItems.length}冊を返却する
    </button>`;
  }
}

function removeFromCart(idx) {
  cart.delete(idx); updateCartFab();
  if (cart.size === 0 && returnList.size === 0) closeCartModal(); else renderCartModal();
  applyFilters();
}
function removeFromReturn(idx) {
  returnList.delete(idx); updateCartFab();
  if (cart.size === 0 && returnList.size === 0) closeCartModal(); else renderCartModal();
  applyFilters();
}

// ===== チェックアウト =====
let _checkoutIdxs = [];

function openCheckoutModal(idxs) {
  // ログインチェック
  if (!currentUser) {
    showToast('先にログインしてください', 'error');
    openAuthModal('login');
    return;
  }
  _checkoutIdxs = idxs;
  closeCartModal();
  const isSingle = idxs.length === 1;
  const book = allBooks[idxs[0]];
  document.getElementById('checkout-title').textContent =
    isSingle ? `「${book?.title}」を借りる` : `${idxs.length}冊をまとめて借りる`;

  let listHTML = '';
  if (!isSingle) {
    listHTML = `<div class="checkout-book-list">${idxs.map(i => `
      <div class="checkout-book-item">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span>${esc(allBooks[i]?.title || '')}</span>
      </div>`).join('')}</div>`;
  }

  // ログイン済みユーザー名を表示（変更不可）
  document.getElementById('checkout-body').innerHTML = `
    ${listHTML}
    <div class="form-group" style="margin-bottom:14px">
      <label class="form-label">借りる人</label>
      <div style="padding:9px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:14px;color:var(--text-primary);display:flex;align-items:center;gap:8px">
        <div class="user-avatar sm">${esc([...currentUser.name].find(c=>c.trim())||'?')}</div>
        ${esc(currentUser.name)}
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="checkout-due">返却期限</label>
      <input class="form-input" type="date" id="checkout-due" value="${defaultDueDate()}" />
    </div>`;

  document.getElementById('checkout-submit').textContent =
    isSingle ? '今すぐ借りる' : `${idxs.length}冊を借りる`;
  document.getElementById('checkout-overlay').classList.add('open');
  setTimeout(() => document.getElementById('checkout-due')?.focus(), 100);
}

function closeCheckoutModal() {
  document.getElementById('checkout-overlay').classList.remove('open');
}

function confirmCheckout() {
  if (!currentUser) { showToast('ログインが必要です', 'error'); return; }
  const dueVal  = document.getElementById('checkout-due')?.value;
  const dueDate = dueVal ? new Date(dueVal) : null;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  let borrowed = 0;
  _checkoutIdxs.forEach(idx => {
    const b = allBooks[idx];
    if (!b || b.status !== 'available') return;
    b.borrower = currentUser.name;
    b.lendDate = today;
    b.dueDate  = dueDate;
    if (dueDate) {
      const diff = Math.ceil((dueDate - today) / MS_PER_DAY);
      b.status = diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : 'lent';
    } else { b.status = 'lent'; }
    cart.delete(idx);
    borrowed++;
  });
  saveBooks();
  closeCheckoutModal();
  updateCartFab();
  applyFilters();
  updateDashboard();
  const title = allBooks[_checkoutIdxs[0]]?.title || '';
  showToast(borrowed === 1 ? `「${title}」を貸出しました` : `${borrowed}冊を貸出しました`, 'success');
}

// ===== 一括返却 =====
function confirmReturnList() {
  const idxsCopy = [...returnList];
  let count = 0;
  idxsCopy.forEach(i => {
    const b = allBooks[i]; if (!b) return;
    b.status = 'available'; b.borrower = ''; b.lendDate = null; b.dueDate = null; b.rawStatus = 'available';
    returnList.delete(i); count++;
  });
  saveBooks(); closeCartModal(); updateCartFab(); applyFilters(); updateDashboard();
  showToast(`${count}冊を返却しました`, 'success');
}

function defaultDueDate() {
  const d = new Date(); d.setDate(d.getDate() + 14); return toInputDate(d);
}

// Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAdminPwModal(); closeCartModal(); closeCheckoutModal(); }
});