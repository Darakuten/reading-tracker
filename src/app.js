// ===================== STATE =====================
let state = {
  books: [],
  selectedBookId: null,
  editingBookId: null,
  editingNoteId: null,
  selectedColor: '#7c6af7',
  selectedTag: null,
};

// ===================== UTILS =====================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getBook() {
  return state.books.find(b => b.id === state.selectedBookId);
}

// ===================== PERSIST =====================
async function persist() {
  await window.api.saveData({ books: state.books });
}

async function loadFromDisk() {
  const data = await window.api.loadData();
  state.books = data.books || [];
}

// ===================== RENDER: SIDEBAR =====================
function renderSidebar() {
  const list = document.getElementById('book-list');
  list.innerHTML = '';

  if (state.books.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:12px;text-align:center;">本がまだありません</p>';
    return;
  }

  state.books.forEach(book => {
    const pct = book.totalPages ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'book-item' + (book.id === state.selectedBookId ? ' active' : '');
    item.dataset.id = book.id;
    item.innerHTML = `
      <div class="book-item-cover" style="background:${book.color || '#7c6af7'}">📖</div>
      <div class="book-item-info">
        <div class="book-item-title">${escHtml(book.title)}</div>
        <div class="book-item-author">${escHtml(book.author || '著者不明')}</div>
        <div class="book-item-progress-bar">
          <div class="book-item-progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
    item.addEventListener('click', () => selectBook(book.id));
    list.appendChild(item);
  });
}

// ===================== RENDER: DETAIL =====================
function renderDetail() {
  const book = getBook();
  const emptyState = document.getElementById('empty-state');
  const detail = document.getElementById('book-detail');

  if (!book) {
    emptyState.classList.remove('hidden');
    detail.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  detail.classList.remove('hidden');

  // Header
  document.getElementById('detail-cover').style.background = book.color || '#7c6af7';
  document.getElementById('detail-cover').textContent = '📖';
  document.getElementById('detail-title').textContent = book.title;
  document.getElementById('detail-author').textContent = book.author || '著者不明';
  document.getElementById('detail-pages-stat').textContent = book.totalPages ? `全 ${book.totalPages} ページ` : '';

  const badge = document.getElementById('detail-status-badge');
  const statusMap = { unread: '未読', reading: '読書中', done: '読了' };
  badge.textContent = statusMap[book.status] || '';
  badge.className = `status-badge status-${book.status}`;

  // Progress
  const pct = book.totalPages ? Math.round((book.currentPage / book.totalPages) * 100) : 0;
  document.getElementById('current-page-input').value = book.currentPage || 0;
  document.getElementById('total-pages-label').textContent = book.totalPages ? `/ ${book.totalPages} ページ` : '';
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-percent').textContent = `${pct}%`;

  renderTimeline(book);
  renderNotes(book);
}

function renderTimeline(book) {
  const container = document.getElementById('timeline');
  const sessions = [...(book.sessions || [])].sort((a, b) => b.date.localeCompare(a.date));

  if (sessions.length === 0) {
    container.innerHTML = '<div class="timeline-empty">読書セッションがまだありません。<br/>「セッション追加」で記録を始めましょう。</div>';
    return;
  }

  container.innerHTML = sessions.map(s => `
    <div class="timeline-item">
      <div class="timeline-dot">📚</div>
      <div class="timeline-body">
        <div class="timeline-top">
          <span class="timeline-date">${formatDate(s.date)}</span>
          <div class="timeline-actions">
            <button class="btn-icon" data-del-session="${s.id}" title="削除">🗑</button>
          </div>
        </div>
        <div class="timeline-pages">
          ${s.startPage != null ? `p.${s.startPage}` : ''}
          ${s.startPage != null && s.endPage != null ? ' → ' : ''}
          ${s.endPage != null ? `p.${s.endPage}` : ''}
          ${s.endPage != null && s.startPage != null ? ` <span style="color:var(--text-muted);font-size:12px">(${s.endPage - s.startPage} ページ)</span>` : ''}
        </div>
        ${s.duration ? `<div class="timeline-duration">⏱ ${s.duration} 分</div>` : ''}
        ${s.memo ? `<div class="timeline-memo">${escHtml(s.memo)}</div>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-session]').forEach(btn => {
    btn.addEventListener('click', () => deleteSession(btn.dataset.delSession));
  });
}

function renderNotes(book) {
  const container = document.getElementById('notes-list');
  const notes = [...(book.notes || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (notes.length === 0) {
    container.innerHTML = '<div class="notes-empty">メモがまだありません。<br/>「メモ追加」で記録を始めましょう。</div>';
    return;
  }

  container.innerHTML = notes.map(n => `
    <div class="note-card" data-note-id="${n.id}">
      <div class="note-card-top">
        ${n.tag ? `<span class="note-tag tag-${n.tag}">${escHtml(n.tag)}</span>` : '<span></span>'}
        ${n.page != null ? `<span class="note-page">p.${n.page}</span>` : ''}
      </div>
      <div class="note-content">${escHtml(n.content)}</div>
      <div class="note-date">${formatDate(n.createdAt.slice(0, 10))}</div>
      <button class="note-delete-btn" data-del-note="${n.id}" title="削除">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-note]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteNote(btn.dataset.delNote);
    });
  });
}

// ===================== SELECT =====================
function selectBook(id) {
  state.selectedBookId = id;
  renderSidebar();
  renderDetail();
}

// ===================== BOOK CRUD =====================
function openAddBookModal() {
  state.editingBookId = null;
  state.selectedColor = '#7c6af7';
  document.getElementById('modal-title').textContent = '本を追加';
  document.getElementById('modal-book-title').value = '';
  document.getElementById('modal-book-author').value = '';
  document.getElementById('modal-book-pages').value = '';
  document.getElementById('modal-book-status').value = 'unread';
  document.getElementById('modal-book-start').value = '';
  document.getElementById('modal-book-goal').value = '';
  syncColorPicker('#7c6af7');
  showModal('book-modal');
}

function openEditBookModal() {
  const book = getBook();
  if (!book) return;
  state.editingBookId = book.id;
  state.selectedColor = book.color || '#7c6af7';
  document.getElementById('modal-title').textContent = '本を編集';
  document.getElementById('modal-book-title').value = book.title;
  document.getElementById('modal-book-author').value = book.author || '';
  document.getElementById('modal-book-pages').value = book.totalPages || '';
  document.getElementById('modal-book-status').value = book.status || 'unread';
  document.getElementById('modal-book-start').value = book.startDate || '';
  document.getElementById('modal-book-goal').value = book.goalDate || '';
  syncColorPicker(book.color || '#7c6af7');
  showModal('book-modal');
}

function saveBook() {
  const title = document.getElementById('modal-book-title').value.trim();
  if (!title) { alert('タイトルは必須です。'); return; }

  const bookData = {
    title,
    author: document.getElementById('modal-book-author').value.trim(),
    totalPages: parseInt(document.getElementById('modal-book-pages').value) || null,
    color: state.selectedColor,
    status: document.getElementById('modal-book-status').value,
    startDate: document.getElementById('modal-book-start').value || null,
    goalDate: document.getElementById('modal-book-goal').value || null,
  };

  if (state.editingBookId) {
    const idx = state.books.findIndex(b => b.id === state.editingBookId);
    if (idx >= 0) state.books[idx] = { ...state.books[idx], ...bookData };
  } else {
    const newBook = {
      id: genId(),
      currentPage: 0,
      sessions: [],
      notes: [],
      createdAt: new Date().toISOString(),
      ...bookData,
    };
    state.books.push(newBook);
    state.selectedBookId = newBook.id;
  }

  persist();
  hideModal('book-modal');
  renderSidebar();
  renderDetail();
}

async function deleteBook() {
  const book = getBook();
  if (!book) return;
  const ok = await window.api.showConfirm(`「${book.title}」を削除しますか？\nこの操作は取り消せません。`);
  if (!ok) return;
  state.books = state.books.filter(b => b.id !== book.id);
  state.selectedBookId = null;
  persist();
  renderSidebar();
  renderDetail();
}

// ===================== PROGRESS =====================
function updateProgress() {
  const book = getBook();
  if (!book) return;
  const val = parseInt(document.getElementById('current-page-input').value) || 0;
  book.currentPage = Math.max(0, book.totalPages ? Math.min(val, book.totalPages) : val);
  if (book.totalPages && book.currentPage >= book.totalPages) {
    book.status = 'done';
  } else if (book.currentPage > 0 && book.status === 'unread') {
    book.status = 'reading';
  }
  persist();
  renderSidebar();
  renderDetail();
}

// ===================== SESSIONS =====================
function openAddSessionModal() {
  document.getElementById('session-date').value = todayISO();
  document.getElementById('session-start-page').value = getBook()?.currentPage || '';
  document.getElementById('session-end-page').value = '';
  document.getElementById('session-duration').value = '';
  document.getElementById('session-memo').value = '';
  showModal('session-modal');
}

function saveSession() {
  const date = document.getElementById('session-date').value;
  if (!date) { alert('日付は必須です。'); return; }

  const book = getBook();
  if (!book) return;

  const startPage = document.getElementById('session-start-page').value;
  const endPage = document.getElementById('session-end-page').value;

  const session = {
    id: genId(),
    date,
    startPage: startPage !== '' ? parseInt(startPage) : null,
    endPage: endPage !== '' ? parseInt(endPage) : null,
    duration: parseInt(document.getElementById('session-duration').value) || null,
    memo: document.getElementById('session-memo').value.trim(),
  };

  if (!book.sessions) book.sessions = [];
  book.sessions.push(session);

  // Auto-update current page
  if (session.endPage != null && (book.currentPage == null || session.endPage > book.currentPage)) {
    book.currentPage = session.endPage;
    if (book.totalPages && book.currentPage >= book.totalPages) book.status = 'done';
    else if (book.currentPage > 0 && book.status === 'unread') book.status = 'reading';
  }

  persist();
  hideModal('session-modal');
  renderSidebar();
  renderDetail();
}

async function deleteSession(sessionId) {
  const book = getBook();
  if (!book) return;
  const ok = await window.api.showConfirm('このセッションを削除しますか？');
  if (!ok) return;
  book.sessions = (book.sessions || []).filter(s => s.id !== sessionId);
  persist();
  renderDetail();
}

// ===================== NOTES =====================
function openAddNoteModal() {
  state.editingNoteId = null;
  state.selectedTag = null;
  document.getElementById('note-modal-title').textContent = 'メモを追加';
  document.getElementById('note-page').value = '';
  document.getElementById('note-content').value = '';
  syncTagPicker(null);
  showModal('note-modal');
}

function saveNote() {
  const content = document.getElementById('note-content').value.trim();
  if (!content) { alert('内容は必須です。'); return; }

  const book = getBook();
  if (!book) return;

  const pageVal = document.getElementById('note-page').value;

  const note = {
    id: genId(),
    page: pageVal !== '' ? parseInt(pageVal) : null,
    tag: state.selectedTag,
    content,
    createdAt: new Date().toISOString(),
  };

  if (!book.notes) book.notes = [];
  book.notes.push(note);

  persist();
  hideModal('note-modal');
  renderDetail();
}

async function deleteNote(noteId) {
  const book = getBook();
  if (!book) return;
  const ok = await window.api.showConfirm('このメモを削除しますか？');
  if (!ok) return;
  book.notes = (book.notes || []).filter(n => n.id !== noteId);
  persist();
  renderDetail();
}

// ===================== MODAL HELPERS =====================
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function syncColorPicker(selected) {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === selected);
  });
}

function syncTagPicker(selected) {
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.tag === selected);
  });
}

// ===================== ESCAPE HTML =====================
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ===================== EVENT LISTENERS =====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadFromDisk();
  renderSidebar();
  renderDetail();

  // Sidebar / add book
  document.getElementById('add-book-btn').addEventListener('click', openAddBookModal);

  // Book modal
  document.getElementById('book-modal-close').addEventListener('click', () => hideModal('book-modal'));
  document.getElementById('modal-cancel').addEventListener('click', () => hideModal('book-modal'));
  document.getElementById('modal-save').addEventListener('click', saveBook);

  // Color picker
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedColor = btn.dataset.color;
      syncColorPicker(btn.dataset.color);
    });
  });

  // Book detail actions
  document.getElementById('edit-book-btn').addEventListener('click', openEditBookModal);
  document.getElementById('delete-book-btn').addEventListener('click', deleteBook);
  document.getElementById('update-progress-btn').addEventListener('click', updateProgress);

  // Allow Enter key in progress input
  document.getElementById('current-page-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') updateProgress();
  });

  // Session modal
  document.getElementById('add-session-btn').addEventListener('click', openAddSessionModal);
  document.getElementById('session-modal-close').addEventListener('click', () => hideModal('session-modal'));
  document.getElementById('session-cancel').addEventListener('click', () => hideModal('session-modal'));
  document.getElementById('session-save').addEventListener('click', saveSession);

  // Note modal
  document.getElementById('add-note-btn').addEventListener('click', openAddNoteModal);
  document.getElementById('note-modal-close').addEventListener('click', () => hideModal('note-modal'));
  document.getElementById('note-cancel').addEventListener('click', () => hideModal('note-modal'));
  document.getElementById('note-save').addEventListener('click', saveNote);

  // Tag picker
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedTag = state.selectedTag === btn.dataset.tag ? null : btn.dataset.tag;
      syncTagPicker(state.selectedTag);
    });
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) hideModal(modal.id);
    });
  });

  // Keyboard shortcut: Escape to close modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => hideModal(m.id));
    }
  });
});
