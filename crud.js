// LocalStorage key
const LS_KEY = 'libraryOS_books';

// ===== LocalStorage: 保存・読み込み =====
function saveBooks() {
  const data = allBooks.map(b => ({
    ...b,
    lendDate: b.lendDate ? b.lendDate.toISOString() : null,
    dueDate:  b.dueDate  ? b.dueDate.toISOString()  : null,
  }));
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function loadBooks() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    allBooks = data.map(b => ({
      ...b,
      lendDate: b.lendDate ? new Date(b.lendDate) : null,
      dueDate:  b.dueDate  ? new Date(b.dueDate)  : null,
    }));
    return true;
  } catch(e) { return false; }
}

// ===== processFile: app.js 版に localStorage 保存を追加 =====
// 修正: 関数の上書きをやめ、app.js の processFile を直接拡張する代わりに
//       importFile() という明示的な関数として定義し、index.html 側で呼び出す
function importFile(file) {
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
        saveBooks();
        showImportResult('success', `✅ ${allBooks.length} 件の書籍データを読み込みました（ブラウザに自動保存済み）`);
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

// ===== 書籍テーブル描画: 管理者用アクションボタン付き =====
// 修正: renderBooksTable を上書きするのをやめ、renderBooksTableAdmin() として独立定義
//       role.js の renderBooksTableForRole() から呼び分ける
function renderBooksTableAdmin() {
  const tbody = document.getElementById('books-tbody');
  if (filteredBooks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>${allBooks.length === 0 ? 'データを読み込むか、本を追加してください' : '検索結果がありません'}</p>
      ${allBooks.length === 0 ? '<button class="btn-primary" onclick="openBookForm(null)">本を追加する</button>' : ''}
    </div></td></tr>`;
    return;
  }
  const start = (currentPage-1)*PAGE_SIZE;
  const pageBooks = filteredBooks.slice(start, start+PAGE_SIZE);
  // 修正: buildRowHTML ヘルパーを使い、HTMLを関数内に詰め込まない
  tbody.innerHTML = pageBooks.map(b => {
    const idx = allBooks.indexOf(b);
    const actions = buildAdminActions(idx);
    return buildRowHTML(b, idx, actions);
  }).join('');
}

// 管理者用アクションボタンHTML生成
function buildAdminActions(idx) {
  return `
    <button class="btn-sm" onclick="openBookForm(${idx})" title="編集">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      編集
    </button>
    <button class="btn-sm" onclick="openDeleteConfirm(${idx})" title="削除" style="color:var(--danger);border-color:var(--danger);background:var(--danger-pale)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      削除
    </button>`;
}

// ===== 書籍フォーム（追加 / 編集） =====
// 修正: _editIdx をオブジェクトにまとめてスコープを管理
const _formState = { editIdx: null };

function openBookForm(idx) {
  _formState.editIdx = idx;
  const isEdit = idx !== null && idx !== undefined;
  document.getElementById('form-modal-title').textContent = isEdit ? '書籍を編集' : '本を追加';
  document.getElementById('form-submit-btn').innerHTML =
    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${isEdit ? '更新する' : '追加する'}`;
  const form = document.getElementById('book-form');
  form.reset();
  if (isEdit) {
    const b = allBooks[idx];
    document.getElementById('form-id').value = b.id;
    document.getElementById('form-title').value = b.title;
    document.getElementById('form-author').value = b.author || '';
    document.getElementById('form-genre').value = b.genre || '';
    document.getElementById('form-isbn').value = b.isbn || '';
    document.getElementById('form-status').value = ['available','lent','overdue','soon'].includes(b.status)
      ? (b.status === 'soon' ? 'lent' : b.status)
      : 'available';
    document.getElementById('form-borrower').value = b.borrower || '';
    document.getElementById('form-lend-date').value = b.lendDate ? toInputDate(b.lendDate) : '';
    document.getElementById('form-due-date').value  = b.dueDate  ? toInputDate(b.dueDate)  : '';
  } else {
    document.getElementById('form-id').value = generateId();
    document.getElementById('form-status').value = 'available';
  }
  toggleBorrowerFields();
  document.getElementById('form-overlay').classList.add('open');
  setTimeout(() => document.getElementById('form-title').focus(), 100);
}

function closeBookForm() {
  document.getElementById('form-overlay').classList.remove('open');
}

function toggleBorrowerFields() {
  const status = document.getElementById('form-status').value;
  const show = status !== 'available';
  ['borrower-group','lend-date-group','due-date-group'].forEach(id => {
    document.getElementById(id).style.display = show ? '' : 'none';
  });
}

function submitBookForm(e) {
  e.preventDefault();
  const status = document.getElementById('form-status').value;
  const lendDateVal = document.getElementById('form-lend-date').value;
  const dueDateVal  = document.getElementById('form-due-date').value;
  const dueDate = dueDateVal ? new Date(dueDateVal) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  let computedStatus = status;
  if (status === 'lent' && dueDate) {
    const diff = Math.ceil((dueDate - today) / MS_PER_DAY);
    if (diff < 0) computedStatus = 'overdue';
    else if (diff <= 3) computedStatus = 'soon';
  }
  const book = {
    id:        document.getElementById('form-id').value.trim(),
    title:     document.getElementById('form-title').value.trim(),
    author:    document.getElementById('form-author').value.trim(),
    genre:     document.getElementById('form-genre').value.trim(),
    isbn:      document.getElementById('form-isbn').value.trim(),
    status:    computedStatus,
    borrower:  document.getElementById('form-borrower').value.trim(),
    lendDate:  lendDateVal ? new Date(lendDateVal) : null,
    dueDate,
    rawStatus: status,
  };
  if (_formState.editIdx !== null) {
    allBooks[_formState.editIdx] = book;
    showToast('書籍情報を更新しました', 'success');
  } else {
    allBooks.push(book);
    showToast(`「${book.title}」を追加しました`, 'success');
  }
  saveBooks();
  closeBookForm();
  applyFilters();
  updateDashboard();
  updateDataStatus(`${allBooks.length}件のデータ`);
}

// ===== 削除確認 =====
// 修正: _deleteIdx もオブジェクトで管理
const _deleteState = { idx: null };

function openDeleteConfirm(idx) {
  _deleteState.idx = idx;
  document.getElementById('delete-book-title').textContent = allBooks[idx]?.title || '';
  document.getElementById('delete-overlay').classList.add('open');
}

function closeDeleteConfirm() {
  document.getElementById('delete-overlay').classList.remove('open');
  _deleteState.idx = null;
}

function confirmDelete() {
  if (_deleteState.idx === null) return;
  const title = allBooks[_deleteState.idx]?.title;
  allBooks.splice(_deleteState.idx, 1);
  saveBooks();
  closeDeleteConfirm();
  applyFilters();
  updateDashboard();
  showToast(`「${title}」を削除しました`, 'info');
  updateDataStatus(`${allBooks.length}件のデータ`);
}

// ===== Excel エクスポート =====
function exportToExcel() {
  if (allBooks.length === 0) { showToast('エクスポートするデータがありません', 'info'); return; }
  const rows = [['管理番号','書名','著者名','ジャンル','ISBN','状態','借りた人','貸出日','返却期限']];
  allBooks.forEach(b => {
    const statusLabel = {available:'貸出可能',lent:'貸出中',soon:'貸出中',overdue:'返却期限超過'}[b.status] || '貸出中';
    rows.push([b.id, b.title, b.author||'', b.genre||'', b.isbn||'', statusLabel, b.borrower||'', formatDate(b.lendDate), formatDate(b.dueDate)]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [8,24,14,12,20,12,12,12,12].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws, '蔵書一覧');
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  XLSX.writeFile(wb, `図書管理_${stamp}.xlsx`);
  showToast('Excelファイルをエクスポートしました', 'success');
}

// ===== ヘルパー =====
function toInputDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function generateId() {
  const max = allBooks.reduce((m,b) => {
    const n = parseInt(b.id.replace(/\D/g,''));
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `B${String(max+1).padStart(3,'0')}`;
}

// ===== 起動時: localStorage から復元 =====
document.addEventListener('DOMContentLoaded', () => {
  if (loadBooks() && allBooks.length > 0) {
    updateDataStatus(`${allBooks.length}件のデータ（自動読込）`);
    applyFilters();
    updateDashboard();
    showToast(`前回のデータ ${allBooks.length} 件を復元しました`, 'info');
  }
  toggleBorrowerFields();
});

// Escape でモーダルを閉じる
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeBookForm();
    closeDeleteConfirm();
  }
});
