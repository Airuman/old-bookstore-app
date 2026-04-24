// ===== Constants =====
const MS_PER_DAY = 86400000; // 1日のミリ秒数

// ===== State =====
let allBooks = [];
let filteredBooks = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = { key: null, dir: 1 };
let currentPage = 1;
const PAGE_SIZE = 15;
let lendingFilter = 'all';

// ===== Tab Navigation =====
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('content-' + tab).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ===== File Import =====
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}
function handleDragLeave() {
  document.getElementById('upload-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) importFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) importFile(file);
}

// 注意: この関数は crud.js の importFile() に置き換えられました。
// handleFileSelect / handleDrop は importFile() を直接呼びます。
function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    showImportResult('error', '❌ 対応していないファイル形式です（.xlsx / .xls / .csv）');
    return;
  }
  showProgress(true);
  setProgress(20, 'ファイルを読み込み中...');
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      setProgress(50, 'データを解析中...');
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setProgress(80, 'データを処理中...');
      allBooks = rows.map((row, idx) => normalizeBook(row, idx));
      setProgress(100, '完了！');
      setTimeout(() => {
        showProgress(false);
        showImportResult('success', `✅ ${allBooks.length} 件の書籍データを読み込みました`);
        updateDataStatus(file.name);
        applyFilters();
        updateDashboard();
        showToast(`${allBooks.length} 件読み込み完了`, 'success');
      }, 400);
    } catch (err) {
      showProgress(false);
      showImportResult('error', '❌ ファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function normalizeBook(row, idx) {
  const keys = Object.keys(row);
  const get = (...names) => {
    for (const n of names) {
      const k = keys.find(k => k.replace(/\s/g,'').toLowerCase().includes(n.toLowerCase()));
      if (k !== undefined && row[k] !== '') return String(row[k]);
    }
    return '';
  };
  const rawStatus = get('状態','ステータス','status','貸出');
  const status = detectStatus(rawStatus);
  const dueDateRaw = get('返却期限','返却日','duedate','due');
  const dueDate = parseDate(dueDateRaw);
  const today = new Date(); today.setHours(0,0,0,0);
  let computedStatus = status;
  if (status === 'lent' && dueDate) {
    const diff = Math.ceil((dueDate - today) / MS_PER_DAY);
    if (diff < 0) computedStatus = 'overdue';
    else if (diff <= 3) computedStatus = 'soon';
  }
  return {
    id: get('管理番号','id','番号','No') || String(idx + 1),
    title: get('書名','タイトル','title','本のタイトル') || '（タイトル不明）',
    author: get('著者名','著者','author','作者'),
    genre: get('ジャンル','分類','genre','category','カテゴリ'),
    isbn: get('isbn','ISBN'),
    status: computedStatus,
    borrower: get('借りた人','借受者','borrower','生徒名','氏名'),
    lendDate: parseDate(get('貸出日','借出日','lenddate')),
    dueDate,
    rawStatus,
  };
}

function detectStatus(s) {
  const v = s.replace(/\s/g,'').toLowerCase();
  if (['貸出可','可','available','○','◯','在庫あり','あり'].includes(v)) return 'available';
  if (['貸出中','中','lent','borrowed','×','✗','貸出'].includes(v)) return 'lent';
  if (['超過','期限超過','overdue','遅延'].includes(v)) return 'overdue';
  return s ? 'lent' : 'available';
}

function parseDate(val) {
  if (!val || val === '') return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  if (!isNaN(d)) return d;
  // Try Japanese format YYYY/MM/DD or YYYY年MM月DD日
  const m = String(val).match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (m) return new Date(+m[1], +m[2]-1, +m[3]);
  return null;
}

function formatDate(d) {
  if (!d) return '—';
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((d - today) / MS_PER_DAY);
}

// ===== Filter & Search =====
function filterBooks(filter) {
  currentFilter = filter;
  currentPage = 1;
  document.querySelectorAll('#filter-all,#filter-available,#filter-lent,#filter-overdue').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-' + filter)?.classList.add('active');
  applyFilters();
}

function handleSearch() {
  const val = document.getElementById('search-input').value;
  currentSearch = val;
  document.getElementById('search-clear').style.display = val ? 'flex' : 'none';
  currentPage = 1;
  applyFilters();
}

function clearSearch() {
  document.getElementById('search-input').value = '';
  currentSearch = '';
  document.getElementById('search-clear').style.display = 'none';
  currentPage = 1;
  applyFilters();
}

function applyFilters() {
  let books = [...allBooks];
  if (currentFilter !== 'all') {
    books = books.filter(b => {
      if (currentFilter === 'available') return b.status === 'available';
      if (currentFilter === 'lent') return b.status === 'lent' || b.status === 'soon';
      if (currentFilter === 'overdue') return b.status === 'overdue';
      return true;
    });
  }
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    // null/undefined に対して安全な検索 (修正: b.author等がundefinedでもエラーにならない)
    books = books.filter(b =>
      (b.title  || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.genre  || '').toLowerCase().includes(q) ||
      (b.isbn   || '').toLowerCase().includes(q) ||
      (b.id     || '').toLowerCase().includes(q)
    );
  }
  if (currentSort.key) {
    books.sort((a,b) => {
      let va = a[currentSort.key] || ''; let vb = b[currentSort.key] || '';
      if (va instanceof Date) va = va.getTime();
      if (vb instanceof Date) vb = vb.getTime();
      return (va < vb ? -1 : va > vb ? 1 : 0) * currentSort.dir;
    });
  }
  filteredBooks = books;
  renderBooksTable();
  renderPagination();
  const info = document.getElementById('search-results-info');
  info.textContent = allBooks.length > 0
    ? `${filteredBooks.length} 件 / 全 ${allBooks.length} 件`
    : '';
}

// ===== Sort =====
function sortTable(key) {
  if (currentSort.key === key) currentSort.dir *= -1;
  else { currentSort.key = key; currentSort.dir = 1; }
  document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '↕');
  const icon = document.getElementById('sort-' + key);
  if (icon) icon.textContent = currentSort.dir === 1 ? '↑' : '↓';
  applyFilters();
}

// ===== Render Table =====
// role.js でロール対応版に差し替えられるが、フォールバックとして基本版を定義
function renderBooksTable() {
  const tbody = document.getElementById('books-tbody');
  if (filteredBooks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>${allBooks.length === 0 ? 'データを読み込んでください' : '検索結果がありません'}</p>
      ${allBooks.length === 0 ? '<button class="btn-primary" onclick="showTab(\'import\')">データを読み込む</button>' : ''}
    </div></td></tr>`;
    return;
  }
  const start = (currentPage-1)*PAGE_SIZE;
  const pageBooks = filteredBooks.slice(start, start+PAGE_SIZE);
  tbody.innerHTML = pageBooks.map((b, i) => {
    // 修正: O(n²) の indexOf をやめ、O(n) のインデックス計算に変更
    const idx = allBooks.indexOf(b);
    return `
    <tr>
      <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${esc(b.id)}</span></td>
      <td><strong style="color:var(--text-primary)">${esc(b.title)}</strong></td>
      <td>${esc(b.author) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${b.genre ? `<span style="background:var(--primary-pale);color:var(--primary);padding:3px 9px;border-radius:50px;font-size:11px;font-weight:600">${esc(b.genre)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span style="font-family:monospace;font-size:11px;color:var(--text-muted)">${esc(b.isbn) || '—'}</span></td>
      <td>${statusBadge(b.status)}</td>
      <td>${dueDateCell(b)}</td>
      <td><button class="btn-sm" onclick="openModal(${idx})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>詳細
      </button></td>
    </tr>`;
  }).join('');
}

// ===== 行HTML生成ヘルパー (role.js・crud.js から共通利用) =====
// 修正: renderBooksTable 内の長大なHTMLを切り出し、可読性を向上
function buildRowHTML(b, idx, actionsHTML) {
  return `<tr>
    <td><span style="font-family:monospace;font-size:12px;color:var(--text-muted)">${esc(b.id)}</span></td>
    <td><strong style="color:var(--text-primary)">${esc(b.title)}</strong></td>
    <td>${esc(b.author) || '<span style="color:var(--text-muted)">—</span>'}</td>
    <td>${b.genre ? `<span style="background:var(--primary-pale);color:var(--primary);padding:3px 9px;border-radius:50px;font-size:11px;font-weight:600">${esc(b.genre)}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
    <td><span style="font-family:monospace;font-size:11px;color:var(--text-muted)">${esc(b.isbn) || '—'}</span></td>
    <td>${statusBadge(b.status)}</td>
    <td>${dueDateCell(b)}</td>
    <td><div class="table-actions">${actionsHTML}</div></td>
  </tr>`;
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function statusBadge(status) {
  const map = {
    available: ['badge-available','貸出可能'],
    lent:      ['badge-lent','貸出中'],
    overdue:   ['badge-overdue','期限超過'],
    soon:      ['badge-soon','返却期限近い'],
  };
  const [cls, label] = map[status] || ['badge-lent','貸出中'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function dueDateCell(b) {
  if (!b.dueDate) return '<span style="color:var(--text-muted)">—</span>';
  const days = daysUntil(b.dueDate);
  const color = days < 0 ? 'var(--danger)' : days <= 3 ? 'var(--soon)' : 'var(--text-secondary)';
  const suffix = days < 0 ? ` (${Math.abs(days)}日超過)` : days <= 3 ? ` (あと${days}日)` : '';
  return `<span style="color:${color};font-weight:${days<=3?'600':'400'}">${formatDate(b.dueDate)}${suffix}</span>`;
}

// ===== Pagination =====
function renderPagination() {
  const total = Math.ceil(filteredBooks.length / PAGE_SIZE);
  const el = document.getElementById('pagination');
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let i=1;i<=total;i++) {
    if (total > 7 && Math.abs(i-currentPage) > 2 && i !== 1 && i !== total) {
      if (i === 2 || i === total-1) html += `<span style="color:var(--text-muted);padding:0 4px">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===total?'disabled':''}>›</button>`;
  el.innerHTML = html;
}
function goPage(p) {
  const total = Math.ceil(filteredBooks.length / PAGE_SIZE);
  if (p<1||p>total) return;
  currentPage = p;
  renderBooksTable();
  renderPagination();
  document.getElementById('content-books').scrollIntoView({behavior:'smooth'});
}

// ===== Lending Tab =====
function filterLending(filter) {
  lendingFilter = filter;
  document.querySelectorAll('#lend-filter-all,#lend-filter-overdue,#lend-filter-soon').forEach(b=>b.classList.remove('active'));
  document.getElementById('lend-filter-'+filter)?.classList.add('active');
  renderLendingGrid();
}

function renderLendingGrid() {
  const grid = document.getElementById('lending-grid');
  let books = allBooks.filter(b => b.status !== 'available');
  if (lendingFilter === 'overdue') books = books.filter(b => b.status === 'overdue');
  if (lendingFilter === 'soon') books = books.filter(b => b.status === 'soon');
  if (books.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <p>${allBooks.length===0?'データを読み込んでください':'該当する貸出書籍がありません'}</p>
      ${allBooks.length===0?'<button class="btn-primary" onclick="showTab(\'import\')">データを読み込む</button>':''}
    </div>`;
    return;
  }
  grid.innerHTML = books.map(b => {
    const idx = allBooks.indexOf(b);
    const days = daysUntil(b.dueDate);
    const cls = b.status==='overdue'?'overdue':b.status==='soon'?'soon':'';
    return `<div class="lending-card ${cls}" onclick="openModal(${idx})">
      <div class="lending-card-title">${esc(b.title)}</div>
      <div class="lending-card-author">${esc(b.author)||'著者不明'}</div>
      <div style="margin-bottom:12px">${statusBadge(b.status)}</div>
      <div class="lending-card-info">
        ${b.borrower?`<div class="info-row"><span class="info-label">借受者</span><span class="info-value">${esc(b.borrower)}</span></div>`:''}
        ${b.lendDate?`<div class="info-row"><span class="info-label">貸出日</span><span class="info-value">${formatDate(b.lendDate)}</span></div>`:''}
        ${b.dueDate?`<div class="info-row"><span class="info-label">返却期限</span><span class="info-value" style="color:${days!=null&&days<0?'var(--danger)':days!=null&&days<=3?'var(--soon)':'inherit'}">${formatDate(b.dueDate)}${days!=null&&days<0?` (${Math.abs(days)}日超過)`:days!=null&&days<=3?` (あと${days}日)`:''}</span></div>`:''}
      </div>
    </div>`;
  }).join('');
}

// ===== Dashboard =====
function updateDashboard() {
  const total = allBooks.length;
  const available = allBooks.filter(b=>b.status==='available').length;
  const lent = allBooks.filter(b=>b.status==='lent'||b.status==='soon').length;
  const overdue = allBooks.filter(b=>b.status==='overdue').length;
  animateValue('stat-total-value', total);
  animateValue('stat-available-value', available);
  animateValue('stat-lent-value', lent);
  animateValue('stat-overdue-value', overdue);
  renderGenreChart();
  renderStatusDonut(available, lent, overdue);
  renderRecentList();
  renderLendingGrid();
}

function animateValue(id, target) {
  const el = document.getElementById(id);
  let start = 0; const dur = 600;
  const step = (ts) => {
    if (!start) start = ts;
    const prog = Math.min((ts-start)/dur, 1);
    el.textContent = Math.round(prog * target);
    if (prog < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderGenreChart() {
  const counts = {};
  allBooks.forEach(b => { if (b.genre) counts[b.genre] = (counts[b.genre]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = sorted[0]?.[1] || 1;
  const el = document.getElementById('genre-chart');
  if (sorted.length === 0) {
    el.innerHTML = '<div class="chart-placeholder"><p style="color:var(--text-muted);font-size:13px">ジャンルデータがありません</p></div>';
    return;
  }
  el.innerHTML = `<div class="genre-bars" style="width:100%">
    ${sorted.map(([g,n])=>`
      <div class="genre-bar-item">
        <span class="genre-bar-label">${esc(g)}</span>
        <div class="genre-bar-track"><div class="genre-bar-fill" style="width:${(n/max*100).toFixed(1)}%"></div></div>
        <span class="genre-bar-count">${n}</span>
      </div>`).join('')}
  </div>`;
}

function renderStatusDonut(available, lent, overdue) {
  const total = available + lent + overdue || 1;
  const r = 60; const cx = 70; const cy = 70; const stroke = 16;
  const circ = 2 * Math.PI * r;
  const segments = [
    { val: available, color: '#10b981', label: '貸出可能' },
    { val: lent,      color: '#f59e0b', label: '貸出中' },
    { val: overdue,   color: '#ef4444', label: '期限超過' },
  ];
  let offset = 0;
  const paths = segments.map(s => {
    const len = (s.val / total) * circ;
    const path = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}"
      stroke-width="${stroke}" stroke-dasharray="${len} ${circ-len}"
      stroke-dashoffset="${-offset}" stroke-linecap="round" style="transform-origin:${cx}px ${cy}px;transform:rotate(-90deg)" />`;
    offset += len;
    return path;
  });
  const svg = `<svg class="donut-svg" width="140" height="140" viewBox="0 0 140 140">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f4ff" stroke-width="${stroke}"/>
    ${paths.join('')}
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="700" fill="#1e1b4b">${total}</text>
    <text x="${cx}" y="${cy+18}" text-anchor="middle" font-size="9" fill="#9ca3af">総蔵書数</text>
  </svg>`;
  const legend = segments.map(s=>`
    <div class="legend-item">
      <div class="legend-dot" style="background:${s.color}"></div>
      <span class="legend-count">${s.val}</span>
      <span class="legend-label">${s.label}</span>
    </div>`).join('');
  document.getElementById('status-chart').innerHTML =
    `<div class="donut-wrap">${svg}<div class="donut-legend">${legend}</div></div>`;
}

function renderRecentList() {
  const el = document.getElementById('recent-list');
  const recent = allBooks.filter(b=>b.status!=='available').slice(0,8);
  if (recent.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:12px 0">貸出中の書籍はありません</p>';
    return;
  }
  const emojis = ['📚','📖','📕','📗','📘','📙','📓','📔'];
  el.innerHTML = recent.map((b,i)=>`
    <div class="recent-item" onclick="openModal(${allBooks.indexOf(b)})" style="cursor:pointer">
      <div class="recent-book-icon">${emojis[i%emojis.length]}</div>
      <div class="recent-info">
        <div class="recent-title">${esc(b.title)}</div>
        <div class="recent-sub">${esc(b.author)||'著者不明'}${b.borrower?' · '+esc(b.borrower):''}</div>
      </div>
      <div class="recent-badge">${statusBadge(b.status)}</div>
    </div>`).join('');
}

// ===== Modal =====
function openModal(idx) {
  const b = allBooks[idx];
  if (!b) return;
  document.getElementById('modal-title').textContent = b.title;
  const rows = [
    ['管理番号', b.id],
    ['書名', b.title],
    ['著者名', b.author||'—'],
    ['ジャンル', b.genre||'—'],
    ['ISBN', b.isbn||'—'],
    ['状態', ''],
    ['借受者', b.borrower||'—'],
    ['貸出日', formatDate(b.lendDate)],
    ['返却期限', formatDate(b.dueDate)],
  ];
  document.getElementById('modal-body').innerHTML = rows.map(([label, val], i) =>
    `<div class="modal-detail-row">
      <div class="modal-detail-label">${label}</div>
      <div class="modal-detail-value">${i===5 ? statusBadge(b.status) : esc(val)}</div>
    </div>`
  ).join('');
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

// ===== Toast =====
function showToast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='0.3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

// ===== Progress =====
function showProgress(show) {
  document.getElementById('import-progress').style.display = show ? 'block' : 'none';
}
function setProgress(pct, text) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = text;
}
function showImportResult(type, msg) {
  const el = document.getElementById('import-result');
  el.style.display = 'block';
  el.className = 'import-result ' + type;
  el.textContent = msg;
}

// ===== Data Status =====
function updateDataStatus(filename) {
  const el = document.getElementById('data-status');
  el.innerHTML = `<div class="status-dot active"></div><span>${filename}</span>`;
}

// ===== Sample Download =====
function downloadSample() {
  const ws_data = [
    ['管理番号','書名','著者名','ジャンル','ISBN','状態','借りた人','貸出日','返却期限'],
    ['B001','吾輩は猫である','夏目漱石','小説','978-4-10-100010-0','貸出可','','',''],
    ['B002','銀河鉄道の夜','宮沢賢治','小説','978-4-10-303901-7','貸出中','田中 太郎','2026/04/10','2026/04/24'],
    ['B003','ノルウェイの森','村上春樹','小説','978-4-06-264031-2','貸出中','佐藤 花子','2026/04/01','2026/04/15'],
    ['B004','数学の世界','山田 一郎','理数','978-4-10-123456-0','貸出可','','',''],
    ['B005','世界の歴史','鈴木 次郎','歴史','978-4-10-654321-0','貸出中','高橋 三郎','2026/04/12','2026/04/26'],
    ['B006','星の王子さま','サン＝テグジュペリ','児童文学','978-4-10-211801-4','貸出可','','',''],
    ['B007','プログラミング入門','伊藤 四郎','コンピュータ','978-4-10-999000-1','貸出中','渡辺 五子','2026/03/20','2026/04/03'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [8,24,14,12,20,10,12,12,12].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, '蔵書一覧');
  XLSX.writeFile(wb, '図書管理テンプレート.xlsx');
  showToast('テンプレートをダウンロードしました', 'success');
}

// ===== ユーザーファイル ドロップ =====
function handleUsersDrop(e) {
  e.preventDefault();
  document.getElementById('users-upload-zone')?.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) importUsersFile(file);
}

// ===== ユーザーサンプルExcelダウンロード =====
function downloadUsersSample() {
  const ws_data = [
    ['ID', '名前'],
    ['U001', '田中 太郎'],
    ['U002', '佐藤 花子'],
    ['U003', '鈴木 一郎'],
    ['U004', '高橋 三郎'],
    ['U005', '伊藤 次子'],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 8 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'ユーザー一覧');
  XLSX.writeFile(wb, 'ユーザーテンプレート.xlsx');
  showToast('ユーザーテンプレートをダウンロードしました', 'success');
}
