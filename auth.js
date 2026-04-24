// ===== auth.js: Firebase Authentication + Firestore =====
// CDN (ESM) 経由で Firebase を読み込む（index.html の <script type="module"> から呼ばれる）

// Firebaseはindex.htmlで読み込まれるCDNのグローバルオブジェクト(firebase)を使用します。

// ===== Firebase 初期化 =====
const firebaseConfig = {
  apiKey:            'AIzaSyBskfHnBIC_P0PcWssEaK7wuXH0eBflQAI',
  authDomain:        'book-kannri.firebaseapp.com',
  projectId:         'book-kannri',
  storageBucket:     'book-kannri.firebasestorage.app',
  messagingSenderId: '559290869536',
  appId:             '1:559290869536:web:73c56a86d45fef846b1945',
};

const app  = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ===== 現在のユーザー =====
let currentUser = null; // { uid, name, email }

// ===== 認証状態の監視（ページ読み込み時に自動復元） =====
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Firestore から表示名を取得
    const snap = await db.collection('users').doc(user.uid).get();
    const name = snap.exists ? snap.data().name : (user.displayName || user.email);
    currentUser = { uid: user.uid, name, email: user.email };
  } else {
    currentUser = null;
  }
  updateUserHeader();
  updateCartFab?.();
  applyFilters?.();
});

// ===== 新規登録 =====
async function submitRegister() {
  const name  = document.getElementById('register-name')?.value?.trim();
  const email = document.getElementById('register-email')?.value?.trim();
  const pw    = document.getElementById('register-pw')?.value;
  const pw2   = document.getElementById('register-pw2')?.value;
  const err   = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-submit');

  if (!name || !email || !pw) { err.textContent = 'すべての項目を入力してください'; return; }
  if (pw !== pw2)              { err.textContent = 'パスワードが一致しません'; return; }
  if (pw.length < 6)           { err.textContent = 'パスワードは6文字以上にしてください'; return; }

  btn.disabled = true; btn.textContent = '登録中...';
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    // Firestore にユーザー名を保存
    await db.collection('users').doc(cred.user.uid).set({ name, email, createdAt: new Date().toISOString() });
    await cred.user.updateProfile({ displayName: name });
    closeAuthModal();
    showToast(`ようこそ、${name}さん！`, 'success');
  } catch (e) {
    err.textContent = firebaseErrorMsg(e.code);
  } finally {
    btn.disabled = false; btn.textContent = '登録する';
  }
}

// ===== ログイン =====
async function submitLogin() {
  const email = document.getElementById('login-email')?.value?.trim();
  const pw    = document.getElementById('login-pw')?.value;
  const err   = document.getElementById('auth-error');
  const btn   = document.getElementById('auth-submit');

  if (!email || !pw) { err.textContent = 'メールアドレスとパスワードを入力してください'; return; }

  btn.disabled = true; btn.textContent = 'ログイン中...';
  try {
    await auth.signInWithEmailAndPassword(email, pw);
    closeAuthModal();
    showToast('ログインしました', 'success');
  } catch (e) {
    err.textContent = firebaseErrorMsg(e.code);
  } finally {
    btn.disabled = false; btn.textContent = 'ログイン';
  }
}

// ===== ログアウト =====
async function logoutUser() {
  await auth.signOut();
  cart?.clear();
  returnList?.clear();
  updateCartFab?.();
  showToast('ログアウトしました', 'info');
}

// ===== Firebase エラーコード → 日本語メッセージ =====
function firebaseErrorMsg(code) {
  const map = {
    'auth/email-already-in-use':    'このメールアドレスはすでに登録されています',
    'auth/invalid-email':           'メールアドレスの形式が正しくありません',
    'auth/weak-password':           'パスワードは6文字以上にしてください',
    'auth/user-not-found':          'メールアドレスまたはパスワードが正しくありません',
    'auth/wrong-password':          'メールアドレスまたはパスワードが正しくありません',
    'auth/invalid-credential':      'メールアドレスまたはパスワードが正しくありません',
    'auth/too-many-requests':       'ログイン試行が多すぎます。しばらくしてからお試しください',
    'auth/network-request-failed':  'ネットワークエラーが発生しました',
  };
  return map[code] || `エラーが発生しました（${code}）`;
}

// ===== UI: 認証モーダルの開閉・タブ切り替え =====
function openAuthModal(mode = 'login') {
  switchAuthMode(mode);
  document.getElementById('auth-overlay').classList.add('open');
  setTimeout(() => document.getElementById(mode === 'login' ? 'login-email' : 'register-name')?.focus(), 100);
}
function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('open');
}
function switchAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-tab-login').classList.toggle('active', isLogin);
  document.getElementById('auth-tab-register').classList.toggle('active', !isLogin);
  document.getElementById('auth-form-login').style.display    = isLogin ? '' : 'none';
  document.getElementById('auth-form-register').style.display = isLogin ? 'none' : '';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-submit').textContent = isLogin ? 'ログイン' : '登録する';
  document.getElementById('auth-submit').onclick = isLogin ? submitLogin : submitRegister;
}

// ===== UI: ヘッダーのユーザー表示 =====
function updateUserHeader() {
  const area = document.getElementById('user-header-area');
  if (!area) return;
  if (currentUser) {
    const initial = [...(currentUser.name || '?')].find(c => c.trim()) || '?';
    area.innerHTML = `
      <div class="user-avatar">${esc(initial)}</div>
      <span class="user-name-label">${esc(currentUser.name)}</span>
      <button class="btn-logout" onclick="logoutUser()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        ログアウト
      </button>`;
  } else {
    area.innerHTML = `
      <button class="btn-primary" onclick="openAuthModal('login')" style="padding:6px 16px;font-size:13px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        ログイン / 登録
      </button>`;
  }
}

// ===== グローバルに公開 =====
// role.js 等の通常 script から currentUser を参照できるよう getter で公開
Object.defineProperty(window, 'currentUser', {
  get: () => currentUser,
  configurable: true,
});
window.openAuthModal  = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthMode = switchAuthMode;
window.submitLogin    = submitLogin;
window.submitRegister = submitRegister;
window.logoutUser     = logoutUser;

// Escape キー
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuthModal(); });