// leprNotes by leaperStuff — notes.js
// Updated for Wafflent DS (class name changes only, logic untouched)

class LeprNotes {
  constructor() {
    this.notes            = [];
    this.currentNote      = null;
    this.currentMode      = 'editing';
    this.isSidebarCollapsed = false;
    this.autoSaveInterval = null;
    this.lastSaveTime     = null;
    this.navbarTimeout    = null;
    this.saveTimeout      = null;

    this.init();
  }

  init() {
    this.loadNotes();
    this.setupMarkdownParser();
    this.setupEventListeners();
    this.setupAutoSave();
    this.hideAllModals();

    if (this.notes.length > 0) {
      this.loadNote(this.notes[0].id);
    } else {
      this.createSampleNotes();
      this.loadNote(this.notes[0].id);
    }

    this.renderNotesList();
  }

  /* ─── Data ─── */
  loadNotes() {
    const stored = localStorage.getItem('leprNotes_v1_notes');
    if (stored) this.notes = JSON.parse(stored);
  }

  saveNotes() {
    try {
      localStorage.setItem('leprNotes_v1_notes', JSON.stringify(this.notes));
      this.updateSaveIndicator();
      return true;
    } catch {
      this.showError('Storage full. Export some notes to free space.');
      return false;
    }
  }

  /* ─── CRUD ─── */
  createNewNote() {
    const note = {
      id:        Date.now().toString(),
      title:     'Untitled',
      content:   '',
      tags:      [],
      folder:    null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions:  []
    };
    this.notes.unshift(note);
    this.saveNotes();
    this.loadNote(note.id);
    this.renderNotesList();
    return note;
  }

  loadNote(noteId) {
    this.saveCurrentNote();
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      this.currentNote = note;
      this.updateEditorContent();
      this.updateNoteTitle();
      this.updateTagsDisplay();
      this.renderPreview();
      this.renderNotesList();
    }
  }

  saveCurrentNote() {
    if (!this.currentNote) return;
    const content = this.getEditorContent();
    if (content !== this.currentNote.content) {
      this.currentNote.content   = content;
      this.currentNote.updatedAt = new Date().toISOString();
      this.currentNote.versions.unshift({ timestamp: new Date().toISOString(), content });
      if (this.currentNote.versions.length > 50)
        this.currentNote.versions = this.currentNote.versions.slice(0, 50);
      this.saveNotes();
      this.renderNotesList();
    }
  }

  duplicateNote() {
    if (!this.currentNote) return;
    const dup = {
      ...this.currentNote,
      id:        Date.now().toString(),
      title:     `${this.currentNote.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions:  []
    };
    this.notes.unshift(dup);
    this.saveNotes();
    this.loadNote(dup.id);
    this.renderNotesList();
    this.closeDropdown();
  }

  deleteNote() {
    if (!this.currentNote) return;
    const idx = this.notes.findIndex(n => n.id === this.currentNote.id);
    if (idx !== -1) {
      const deleted = this.notes.splice(idx, 1)[0];
      this.saveNotes();
      localStorage.setItem('leprNotes_v1_lastDeleted', JSON.stringify(deleted));
      if (this.notes.length > 0) this.loadNote(this.notes[0].id);
      else this.createNewNote();
      this.renderNotesList();
      this.showToast('Note deleted. <button id="undoDelete">Undo</button>', 5000);
      setTimeout(() => {
        const btn = document.getElementById('undoDelete');
        if (btn) btn.onclick = () => this.undoDelete();
      }, 100);
    }
  }

  undoDelete() {
    const raw = localStorage.getItem('leprNotes_v1_lastDeleted');
    if (raw) {
      const note = JSON.parse(raw);
      this.notes.unshift(note);
      this.saveNotes();
      this.loadNote(note.id);
      this.renderNotesList();
      this.hideToast();
    }
  }

  /* ─── Editor ─── */
  getEditorContent() {
    switch (this.currentMode) {
      case 'editing': return document.getElementById('editor')?.value     || '';
      case 'both':    return document.getElementById('editorBoth')?.value || '';
      default:        return this.currentNote?.content || '';
    }
  }

  updateEditorContent() {
    if (!this.currentNote) return;
    const c = this.currentNote.content;
    const ed     = document.getElementById('editor');
    const edBoth = document.getElementById('editorBoth');
    if (ed)     ed.value     = c;
    if (edBoth) edBoth.value = c;
  }

  updateNoteTitle() {
    if (!this.currentNote) return;
    document.querySelectorAll('.note-title').forEach(el => {
      if (!el.classList.contains('editable') || el.getAttribute('contenteditable') === 'false')
        el.textContent = this.currentNote.title;
    });
  }

  updateTagsDisplay() {
    if (!this.currentNote) return;
    document.querySelectorAll('.note-tags').forEach(container => {
      container.innerHTML = '';
      this.currentNote.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className   = 'tag';
        span.textContent = tag;
        container.appendChild(span);
      });
    });
  }

  /* ─── Markdown ─── */
  setupMarkdownParser() {
    const self = this;

    const underlineExt = {
      name: 'underline', level: 'inline',
      start(src) { const i = src.indexOf('__'); return i === -1 ? undefined : i; },
      tokenizer(src) {
        const m = /^__([^\n_]+?)__/.exec(src);
        if (m) return { type: 'underline', raw: m[0], text: m[1] };
      },
      renderer(token) { return `<u>${token.text}</u>`; }
    };

    const renderer = new marked.Renderer();
    renderer.code = function(code, lang) {
      lang = (lang || '').trim();
      if (lang === 'mermaid')
        return `<div class="mermaid">${self.escapeHtml(code)}</div>`;
      const cls = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${cls}>${self.escapeHtml(code)}</code></pre>`;
    };

    marked.use({ extensions: [underlineExt] });
    marked.setOptions({ renderer, breaks: true, gfm: true });
  }

  renderPreview() {
    if (!this.currentNote) return;
    const html = (() => {
      try   { return marked.parse(this.currentNote.content); }
      catch { return '<p>Error rendering markdown</p>'; }
    })();
    const p  = document.getElementById('preview');
    const pb = document.getElementById('previewBoth');
    if (p)  p.innerHTML  = html;
    if (pb) pb.innerHTML = html;
    this.postRender();
  }

  postRender() {
    if (window.mermaid) {
      try { mermaid.init(undefined, document.querySelectorAll('.mermaid')); }
      catch(e) { console.warn('mermaid error', e); }
    }
  }

  /* ─── Mode switching ─── */
  switchMode(mode) {
    this.saveCurrentNote();
    this.currentMode = mode;
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
    switch (mode) {
      case 'editing': document.getElementById('editingMode').classList.remove('hidden'); break;
      case 'preview': document.getElementById('previewMode').classList.remove('hidden'); this.renderPreview(); break;
      case 'both':    document.getElementById('bothMode').classList.remove('hidden');    this.renderPreview(); break;
    }
    document.getElementById('modeSelect').value = mode;
  }

  /* ─── Notes list ─── */
  renderNotesList() {
    const container = document.getElementById('notesList');
    container.innerHTML = '';
    [...this.notes]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .forEach(note => {
        const el = document.createElement('div');
        el.className = `note-item${note.id === this.currentNote?.id ? ' active' : ''}`;
        el.innerHTML = `
          <div class="note-item-header">
            <span class="note-item-title">${this.escapeHtml(note.title)}</span>
            <button class="note-actions-btn" title="Note options">⋯</button>
          </div>
          <div class="note-item-tags">${note.tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}</div>
          <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()}</div>
        `;
        el.addEventListener('click', e => {
          if (!e.target.classList.contains('note-actions-btn')) this.loadNote(note.id);
        });
        el.querySelector('.note-actions-btn').addEventListener('click', e => {
          e.stopPropagation();
          this.loadNote(note.id);
          document.getElementById('fileActionsBtn').click();
        });
        container.appendChild(el);
      });
  }

  /* ─── Version history ─── */
  showVersionHistory() {
    if (!this.currentNote) return;
    const versionList = document.getElementById('versionList');
    versionList.innerHTML = '';

    const versions = [
      { timestamp: new Date().toISOString(), content: this.currentNote.content },
      ...(this.currentNote.versions || [])
    ];

    versionList.innerHTML = `<strong style="color:var(--text-primary);">Version Preview</strong>`;

    const range = document.createElement('input');
    range.type = 'range'; range.id = 'versionRange';
    range.min = 0; range.max = Math.max(0, versions.length - 1); range.value = 0;
    versionList.appendChild(range);

    const meta = document.createElement('div');
    meta.id = 'versionMeta';
    versionList.appendChild(meta);

    const previewBox = document.createElement('div');
    previewBox.id = 'versionPreview';
    previewBox.className = 'preview';
    versionList.appendChild(previewBox);

    const restoreBtn = document.createElement('button');
    restoreBtn.className   = 'wf-btn wf-btn-filled';
    restoreBtn.textContent = 'Restore This Version';
    restoreBtn.style.marginTop = '14px';
    versionList.appendChild(restoreBtn);

    const renderVer = idx => {
      const v = versions[idx];
      meta.textContent = `Version ${idx} — ${new Date(v.timestamp).toLocaleString()}`;
      try { previewBox.innerHTML = marked.parse(v.content); this.postRender(); }
      catch { previewBox.innerHTML = '<p>Error rendering preview</p>'; }
    };

    range.addEventListener('input', e => renderVer(parseInt(e.target.value)));
    restoreBtn.addEventListener('click', () => {
      this.restoreVersion(versions[parseInt(range.value)].content);
    });

    renderVer(0);
    this.showModal('versionModal');
  }

  restoreVersion(content) {
    if (!this.currentNote) return;
    this.currentNote.content   = content;
    this.currentNote.updatedAt = new Date().toISOString();
    this.updateEditorContent();
    this.renderPreview();
    this.saveNotes();
    this.hideModal('versionModal');
    this.showToast('Version restored');
  }

  /* ─── Tag modal ─── */
  showTagModal() {
    if (!this.currentNote) return;
    const container = document.getElementById('tagInputs');
    container.innerHTML = '';

    const existing = [...this.currentNote.tags];
    existing.push(''); // empty slot for new tag

    existing.forEach((tag, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';
      row.innerHTML = `
        <input class="wf-input" value="${this.escapeHtml(tag)}" placeholder="Tag name" style="flex:1;">
        <button class="wf-btn wf-btn-ghost wf-btn-sm" style="color:var(--error);">✕</button>
      `;
      row.querySelector('button').addEventListener('click', () => row.remove());
      container.appendChild(row);
    });

    // Add tag button
    const addBtn = document.createElement('button');
    addBtn.className   = 'wf-btn wf-btn-outlined wf-btn-sm';
    addBtn.style.marginTop = '4px';
    addBtn.innerHTML   = '<i class="fas fa-plus"></i> Add tag';
    addBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:8px; margin-bottom:8px;';
      row.innerHTML = `
        <input class="wf-input" placeholder="Tag name" style="flex:1;">
        <button class="wf-btn wf-btn-ghost wf-btn-sm" style="color:var(--error);">✕</button>
      `;
      row.querySelector('button').addEventListener('click', () => row.remove());
      container.insertBefore(row, addBtn);
    });
    container.appendChild(addBtn);

    this.showModal('tagModal');
    this.closeDropdown();
  }

  saveTags() {
    if (!this.currentNote) return;
    const inputs = document.querySelectorAll('#tagInputs input');
    this.currentNote.tags = [...inputs]
      .map(i => i.value.trim())
      .filter(Boolean);
    this.currentNote.updatedAt = new Date().toISOString();
    this.saveNotes();
    this.updateTagsDisplay();
    this.renderNotesList();
    this.hideModal('tagModal');
  }

  /* ─── Event listeners ─── */
  setupEventListeners() {
    document.getElementById('modeSelect').addEventListener('change', e => this.switchMode(e.target.value));

    // Editor input
    document.getElementById('editor').addEventListener('input', e => {
      if (this.currentNote) {
        this.currentNote.content   = e.target.value;
        this.currentNote.updatedAt = new Date().toISOString();
      }
      this.scheduleAutoSave();
    });
    document.getElementById('editorBoth').addEventListener('input', e => {
      if (this.currentNote) {
        this.currentNote.content   = e.target.value;
        this.currentNote.updatedAt = new Date().toISOString();
      }
      this.scheduleAutoSave();
      this.renderPreview();
    });

    // Toolbar actions
    document.getElementById('renameBtn').addEventListener('click',         () => { this.renameNote();        this.closeDropdown(); });
    document.getElementById('duplicateBtn').addEventListener('click',      () => this.duplicateNote());
    document.getElementById('versionHistoryBtn').addEventListener('click', () => { this.showVersionHistory(); this.closeDropdown(); });
    document.getElementById('deleteBtn').addEventListener('click',         () => { this.showModal('deleteModal'); this.closeDropdown(); });
    document.getElementById('exportMDBtn').addEventListener('click',       () => { this.exportAsMD();        this.closeDropdown(); });
    document.getElementById('exportJSONBtn').addEventListener('click',     () => { this.exportAsJSON();      this.closeDropdown(); });

    // Confirm delete
    document.getElementById('confirmDelete').addEventListener('click', () => { this.deleteNote(); this.hideModal('deleteModal'); });
    document.getElementById('cancelDelete').addEventListener('click',  () => this.hideModal('deleteModal'));

    // Tag modal
    document.getElementById('newTagBtn').addEventListener('click', () => this.showTagModal());
    document.getElementById('saveTags').addEventListener('click',   () => this.saveTags());
    document.getElementById('cancelTags').addEventListener('click', () => this.hideModal('tagModal'));

    // Version modal
    document.getElementById('closeVersionModal').addEventListener('click', () => this.hideModal('versionModal'));

    // New note
    document.getElementById('newNoteBtn').addEventListener('click', () => this.createNewNote());

    // Search
    document.getElementById('searchNotes').addEventListener('input', e => this.filterNotes(e.target.value));

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());

    // Title editing
    document.querySelectorAll('.note-title.editable').forEach(title => {
      title.addEventListener('click', () => {
        if (title.getAttribute('contenteditable') === 'false') {
          title.setAttribute('contenteditable', 'true');
          title.focus();
          const range = document.createRange();
          range.selectNodeContents(title);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
      title.addEventListener('blur', () => {
        title.setAttribute('contenteditable', 'false');
        if (this.currentNote && title.textContent !== this.currentNote.title) {
          this.currentNote.title     = title.textContent;
          this.currentNote.updatedAt = new Date().toISOString();
          this.saveNotes();
          this.renderNotesList();
        }
      });
      title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
    });

    // Dropdown toggle (Wafflent: .ln-dropdown-menu)
    document.getElementById('fileActionsBtn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('fileActionsMenu').classList.toggle('show');
    });
    document.addEventListener('click', () => this.closeDropdown());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 's') { e.preventDefault(); this.saveCurrentNote(); }
        if (e.key === 'f') { e.preventDefault(); document.getElementById('searchNotes').focus(); }
        if (e.key === 'k') { e.preventDefault(); this.insertLinkSyntax(); }
        if (e.key === '/') { e.preventDefault(); this.togglePreview(); }
      }
      if (e.key === 'Escape') {
        this.hideAllModals();
        this.closeDropdown();
        document.querySelectorAll('.note-title[contenteditable="true"]').forEach(el => el.blur());
      }
    });

    // Navbar auto-hide
    document.addEventListener('mousemove',  () => this.showNavbar());
    document.addEventListener('touchstart', () => this.showNavbar());
    document.addEventListener('focusin', e => {
      if (this.isMobile() && (e.target.tagName === 'TEXTAREA' || e.target.getAttribute('contenteditable') === 'true'))
        this.hideNavbar();
    });

    window.addEventListener('resize', () => {
      // nothing layout-specific needed — Wafflent handles it via CSS
    });
  }

  /* ─── Navbar auto-hide ─── */
  showNavbar() {
    const nav = document.getElementById('navbar');
    nav.classList.remove('hidden');
    clearTimeout(this.navbarTimeout);
    if (!this.isMobile()) {
      this.navbarTimeout = setTimeout(() => nav.classList.add('hidden'), 2500);
    }
  }

  hideNavbar() {
    if (this.isMobile()) document.getElementById('navbar').classList.add('hidden');
  }

  isMobile() { return window.innerWidth < 768; }

  /* ─── UI helpers ─── */
  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    document.getElementById('sidebar').classList.toggle('collapsed');
  }

  closeDropdown() {
    document.getElementById('fileActionsMenu')?.classList.remove('show');
  }

  showModal(id)    { document.getElementById(id).classList.remove('hidden'); }
  hideModal(id)    { document.getElementById(id).classList.add('hidden'); }
  hideAllModals()  { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

  showToast(message, duration = 3000) {
    const t = document.getElementById('toast');
    t.innerHTML = message;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.hideToast(), duration);
  }
  hideToast() { document.getElementById('toast').classList.add('hidden'); }

  updateSaveIndicator() {
    const ind = document.getElementById('saveIndicator');
    this.lastSaveTime  = new Date();
    ind.className      = 'save-indicator saved';
    ind.textContent    = `Saved ${this.lastSaveTime.toLocaleTimeString()}`;
    setTimeout(() => { ind.className = 'save-indicator'; }, 2000);
  }

  /* ─── Auto-save ─── */
  setupAutoSave() {
    this.autoSaveInterval = setInterval(() => this.saveCurrentNote(), 60000);
  }

  scheduleAutoSave() {
    clearTimeout(this.saveTimeout);
    const ind = document.getElementById('saveIndicator');
    ind.className   = 'save-indicator saving';
    ind.textContent = 'Saving…';
    this.saveTimeout = setTimeout(() => this.saveCurrentNote(), 1000);
  }

  /* ─── Export ─── */
  exportAsMD() {
    if (!this.currentNote) return;
    this.downloadFile(`${this.currentNote.title}.md`, `# ${this.currentNote.title}\n\n${this.currentNote.content}`, 'text/markdown');
  }

  exportAsJSON() {
    this.downloadFile('leprNotes_export.json', JSON.stringify({ exportedAt: new Date().toISOString(), notes: this.notes }, null, 2), 'application/json');
  }

  downloadFile(filename, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ─── Extra features ─── */
  renameNote() {
    const title = document.querySelector('.note-title.editable');
    if (!title) return;
    title.setAttribute('contenteditable', 'true');
    title.focus();
    const range = document.createRange();
    range.selectNodeContents(title);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  insertLinkSyntax() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    const s = editor.selectionStart, e = editor.selectionEnd;
    const txt = editor.value.substring(s, e) || 'link text';
    editor.setRangeText(`[${txt}](url)`, s, e, 'select');
    editor.focus();
  }

  togglePreview() {
    this.switchMode(this.currentMode === 'editing' ? 'preview' : 'editing');
  }

  filterNotes(query) {
    document.querySelectorAll('.note-item').forEach(el => {
      const title = el.querySelector('.note-item-title').textContent.toLowerCase();
      const tags  = [...el.querySelectorAll('.tag')].map(t => t.textContent.toLowerCase());
      const match = title.includes(query.toLowerCase()) || tags.some(t => t.includes(query.toLowerCase()));
      el.style.display = match ? '' : 'none';
    });
  }

  escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  showError(msg) { alert(`Error: ${msg}`); }

  /* ─── Sample data ─── */
  createSampleNotes() {
    this.notes = [
      {
        id: 'sample1', title: 'Welcome to leprNotes',
        content: `# Welcome to leprNotes!\n\nA **Wafflent DS** markdown note app.\n\n## Features\n- __Underline__ with double underscores\n- *Italic* and **bold**\n- \`inline code\`\n- Tables, code blocks, mermaid diagrams\n\n\`\`\`javascript\nfunction hello() {\n  console.log("Hello, leprNotes!");\n}\n\`\`\`\n\n> Enjoy using leprNotes!`,
        tags: ['welcome'], folder: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), versions: []
      },
      {
        id: 'sample2', title: 'Markdown Cheatsheet',
        content: `# Markdown Cheatsheet\n\n## Formatting\n- **Bold**: \`**text**\`\n- *Italic*: \`*text*\`\n- __Underline__: \`__text__\` (custom)\n- ~~Strike~~: \`~~text~~\`\n\n## Other\n> Blockquote\n\n\`\`\`\ncode block\n\`\`\`\n\n[Link](url)\n\n---\n\nHorizontal rule`,
        tags: ['reference', 'markdown'], folder: null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), versions: []
      }
    ];
    this.saveNotes();
  }
}

document.addEventListener('DOMContentLoaded', () => { window.leprNotes = new LeprNotes(); });