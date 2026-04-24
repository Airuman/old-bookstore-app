// ===== ロール管理 =====
let currentRole = 'user';

const ADMIN_PASSWORD = 'admin1234';

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

// ===== 利用者テーブル（閲覧のみ） =====
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
    return buildRowHTML(b, idx, ''); // アクションボタンなし
  }).join('');
}

// Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAdminPwModal();
});
