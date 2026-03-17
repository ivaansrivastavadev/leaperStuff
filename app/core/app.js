/**
 * leaperStuff — Core App  (complete rewrite)
 *
 * Fixes & features in this version:
 *  1.  Arrow up/down navigate between lines reliably
 *  2.  Typing / opens slash menu immediately (on keyup)
 *  3.  Clicking filename in path-bar opens file-options dropdown
 *  4.  Mobile sidebar overlays correctly (not stuck at bottom)
 *  5.  Folders in sidebar (create, delete, open/close, assign pages)
 *  6.  Version history panel wired up
 *  7.  Powerful full-text search with highlighting
 *  8.  Hybrid mode removed; live-preview re-renders ALL non-active lines
 *  9.  Multiple workspaces via workspace switcher panel
 * 10.  Passcode + encryption panel wired up
 * 11.  Backup & restore panel wired up
 * 12.  Slash commands work (fixed slash detection on keyup)
 * 13.  AI actions via Puter.js
 * 14.  Enter creates next block-line (not a <br>); multiline paste keeps blocks
 *  +.  Sidebar collapsed by default on desktop
 *  +.  Side-by-side split mode works on desktop
 *  +.  GUN.js push/pull
 *  +.  CollabGun slash command (GUN-backed live collaborative block)
 *  +.  Extension Marketplace panel
 */

// ─────────────────────────────────────────────────────────────
//  MARKDOWN PARSER  (lightweight, no deps)
// ─────────────────────────────────────────────────────────────

const MD = (() => {

  function escHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlineToHtml(text) {
    let s = escHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;">');
    return s;
  }

  function renderLine(raw) {
    const t = raw;
    const hMatch = t.match(/^(#{1,6})\s+(.*)/);
    if (hMatch) return `<h${hMatch[1].length}>${inlineToHtml(hMatch[2])}</h${hMatch[1].length}>`;
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) return '<hr>';
    if (t.startsWith('> ')) return `<blockquote>${inlineToHtml(t.slice(2))}</blockquote>`;
    const taskMatch = t.match(/^[-*]\s+\[([xX ])\]\s+(.*)/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === 'x';
      return `<ul><li class="task-item"><input type="checkbox" class="task-cb"${checked?' checked':''}><span${checked?' class="task-done"':''}>${inlineToHtml(taskMatch[2])}</span></li></ul>`;
    }
    if (/^[-*+]\s+/.test(t)) return `<ul><li>${inlineToHtml(t.replace(/^[-*+]\s+/, ''))}</li></ul>`;
    const olMatch = t.match(/^\d+\.\s+(.*)/);
    if (olMatch) return `<ol><li>${inlineToHtml(olMatch[1])}</li></ol>`;
    if (t.startsWith('|') && t.endsWith('|')) {
      const cells = t.slice(1, -1).split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return '';
      return `<table><tr>${cells.map(c => `<td>${inlineToHtml(c)}</td>`).join('')}</tr></table>`;
    }
    if (t.trim() === '') return '<br>';
    return `<p>${inlineToHtml(t)}</p>`;
  }

  function renderDocument(text) {
    const lines = text.split('\n');
    const out   = [];
    let inCode = false, codeLang = '', codeBuf = [];
    for (const line of lines) {
      if (!inCode && /^```/.test(line)) { inCode = true; codeLang = line.slice(3).trim(); codeBuf = []; continue; }
      if (inCode) {
        if (/^```/.test(line)) {
          out.push(`<pre><code class="language-${escHtml(codeLang)}">${escHtml(codeBuf.join('\n'))}</code></pre>`);
          inCode = false; codeBuf = []; codeLang = '';
        } else { codeBuf.push(line); }
        continue;
      }
      out.push(renderLine(line));
    }
    if (inCode && codeBuf.length) out.push(`<pre><code>${escHtml(codeBuf.join('\n'))}</code></pre>`);
    return out.join('\n');
  }

  return { renderLine, renderDocument, inlineToHtml, escHtml };
})();


// ─────────────────────────────────────────────────────────────
//  APP STATE
// ─────────────────────────────────────────────────────────────

const App = (() => {

  let _currentPageId = null;
  let _currentMode   = 'livepreview';
  let _activeLine    = null;
  let _slashState    = null;
  let _slashSelected = 0;

  // DOM refs
  let $app, $editor, $pageTitle, $slashMenu,
      $pathPage, $pathSep, $saveDot, $saveLabel, $wordCount,
      $previewContent, $previewTitle, $fileOptionsMenu;

  // ── helpers ───────────────────────────────────────────────

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────

  function init() {
    $app            = document.getElementById('app');
    $editor         = document.getElementById('editor');
    $pageTitle      = document.getElementById('page-title');
    $slashMenu      = document.getElementById('slash-menu');
    $pathPage       = document.getElementById('crumb-page');
    $pathSep        = document.getElementById('crumb-sep');
    $saveDot        = document.getElementById('save-dot');
    $saveLabel      = document.getElementById('save-label');
    $wordCount      = document.getElementById('word-count');
    $previewContent = document.getElementById('preview-content');
    $previewTitle   = document.getElementById('preview-title');
    $fileOptionsMenu= document.getElementById('file-options-menu');

    // Boot storage
    Storage.ensureDefaultWorkspace();
    Storage.ensureDefaultPage();

    // Show lock screen if passcode set
    if (Storage.hasPasscode()) {
      showLockScreen();
    } else {
      showApp();
    }
  }

  function showLockScreen() {
    document.getElementById('passcode-lock-screen').classList.add('visible');
    const inp = document.getElementById('lock-input');
    const btn = document.getElementById('lock-btn');
    const err = document.getElementById('lock-error');
    const unlock = async () => {
      const ok = await Storage.checkPasscode(inp.value);
      if (ok) {
        document.getElementById('passcode-lock-screen').classList.remove('visible');
        showApp();
      } else {
        err.textContent = 'Wrong passcode.';
        inp.value = '';
        inp.focus();
      }
    };
    btn.addEventListener('click', unlock);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });
    inp.focus();
  }

  function showApp() {
    $app.style.display = '';

    // Sidebar: collapsed by default on desktop
    if (window.innerWidth > 700) {
      $app.classList.add('sidebar-collapsed');
    }

    // Sync ws name display
    const wsid = Storage.getActiveWorkspaceId();
    const ws   = Storage.getWorkspace(wsid);
    document.getElementById('ws-name').textContent = ws ? ws.name : 'Workspace';

    renderPageTree();

    const ids = Storage.getPageIds();
    if (ids.length) openPage(ids[0]);

    bindEditorEvents();
    bindSidebarEvents();
    bindTopbarEvents();
    bindStatusbarEvents();
    bindSlashMenuEvents();
    bindPanelEvents();
    bindSearchEvents();

    // Desktop sidebar toggle btn visibility
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    toggleBtn.style.display = 'flex';
  }


  // ─────────────────────────────────────────────────────────
  //  PAGE TREE (folders + pages)
  // ─────────────────────────────────────────────────────────

  function renderPageTree() {
    const tree    = document.getElementById('page-tree');
    tree.innerHTML = '';
    const wsid    = Storage.getActiveWorkspaceId();
    const folders = Storage.getFolders(wsid);
    const ids     = Storage.getPageIds(wsid);

    // Build folder items
    folders.forEach(folder => {
      const folderEl = document.createElement('div');
      folderEl.className = 'folder-item' + (folder.open !== false ? ' open' : '');
      folderEl.dataset.fid = folder.id;

      const header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = `
        <svg class="folder-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 4l2 2 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="folder-name">${escHtml(folder.name)}</span>
        <button class="folder-del" data-fdel="${folder.id}" title="Delete folder">&times;</button>
      `;
      header.addEventListener('click', e => {
        if (e.target.dataset.fdel) { e.stopPropagation(); deleteFolder(folder.id); return; }
        Storage.toggleFolder(folder.id, wsid);
        folderEl.classList.toggle('open');
      });

      const children = document.createElement('div');
      children.className = 'folder-children';

      // Pages in this folder
      ids.forEach(id => {
        const page = Storage.getPage(id);
        if (!page || page.folderId !== folder.id) return;
        children.appendChild(makePageItem(id, page));
      });

      folderEl.appendChild(header);
      folderEl.appendChild(children);
      tree.appendChild(folderEl);
    });

    // Pages without a folder
    ids.forEach(id => {
      const page = Storage.getPage(id);
      if (!page || page.folderId) return;
      tree.appendChild(makePageItem(id, page));
    });
  }

  function makePageItem(id, page) {
    const item = document.createElement('div');
    item.className = 'page-item' + (id === _currentPageId ? ' active' : '');
    item.dataset.id = id;
    item.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
        <line x1="3" y1="4" x2="9" y2="4" stroke="currentColor" stroke-width="1"/>
        <line x1="3" y1="6" x2="9" y2="6" stroke="currentColor" stroke-width="1"/>
        <line x1="3" y1="8" x2="7" y2="8" stroke="currentColor" stroke-width="1"/>
      </svg>
      <span class="page-item-name">${escHtml(page.title || 'Untitled')}</span>
      <button class="page-item-del" data-del="${id}" title="Delete page">&times;</button>
    `;
    item.addEventListener('click', e => {
      if (e.target.dataset.del) { e.stopPropagation(); deletePage(e.target.dataset.del); return; }
      openPage(id);
      // Close sidebar on mobile after navigating
      if (window.innerWidth <= 700) $app.classList.remove('sidebar-open');
    });
    return item;
  }

  function deleteFolder(fid) {
    if (!confirm('Delete folder? Pages inside will be moved to root.')) return;
    Storage.deleteFolder(fid);
    renderPageTree();
  }

  // ─────────────────────────────────────────────────────────
  //  OPEN / CREATE / DELETE PAGE
  // ─────────────────────────────────────────────────────────

  function openPage(id) {
    if (_currentPageId) flushPage(_currentPageId);
    _currentPageId = id;
    const page = Storage.getPage(id);
    if (!page) return;

    $pageTitle.value = page.title || '';
    buildEditor(page.content || '');

    $pathPage.textContent = page.title || 'Untitled';
    $pathPage.style.display = '';
    $pathSep.style.display  = '';

    document.querySelectorAll('.page-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    setSaved();
    syncPreview();
    updateWordCount();
  }

  function createPage(folderId) {
    const wsid = Storage.getActiveWorkspaceId();
    const page = Storage.createPage('Untitled', folderId || null, wsid);
    renderPageTree();
    openPage(page.id);
    setTimeout(() => { $pageTitle.focus(); $pageTitle.select(); }, 50);
  }

  function deletePage(id) {
    const wsid = Storage.getActiveWorkspaceId();
    const ids  = Storage.getPageIds(wsid);
    if (ids.length <= 1) { alert('Cannot delete the last page.'); return; }
    if (!confirm('Delete this page?')) return;
    // Save version before delete
    const page = Storage.getPage(id);
    if (page) Storage.pushVersion(id, page.content, page.title);
    Storage.deletePage(id, wsid);
    renderPageTree();
    const newIds = Storage.getPageIds(wsid);
    if (newIds.length) openPage(newIds[0]);
  }


  // ─────────────────────────────────────────────────────────
  //  EDITOR: BUILD FROM CONTENT
  // ─────────────────────────────────────────────────────────

  function buildEditor(content) {
    $editor.innerHTML = '';
    _activeLine = null;

    const lines  = content.split('\n');
    const groups = groupLines(lines);

    groups.forEach(group => {
      if (group.blockType !== undefined) {
        const lineEl = restoreBlockLine(group.blockType, group.blockData);
        if (lineEl) { $editor.appendChild(lineEl); return; }
        $editor.appendChild(createLineEl('', false));
        return;
      }
      $editor.appendChild(createLineEl(group.raw, false));
    });

    if ($editor.children.length === 0) {
      $editor.appendChild(createLineEl('', false));
    }
  }

  function groupLines(lines) {
    const groups  = [];
    let inFence   = false;
    let buf       = [];
    const BLOCK_RE = /^<!-- block:(\w+)\s+(\{.*\})\s*-->$/;

    for (const line of lines) {
      if (!inFence) {
        const bm = line.match(BLOCK_RE);
        if (bm) {
          let data = {};
          try { data = JSON.parse(bm[2]); } catch {}
          groups.push({ blockType: bm[1], blockData: data });
          continue;
        }
      }
      if (!inFence && /^```/.test(line)) {
        inFence = true; buf = [line];
      } else if (inFence) {
        buf.push(line);
        if (/^```\s*$/.test(line)) {
          groups.push({ raw: buf.join('\n') });
          buf = []; inFence = false;
        }
      } else {
        groups.push({ raw: line });
      }
    }
    if (buf.length) groups.push({ raw: buf.join('\n') });
    return groups;
  }

  function createLineEl(rawText, active) {
    const el = document.createElement('div');
    el.className = 'editor-line';
    el.dataset.raw = rawText;
    if (active) renderRaw(el, rawText);
    else        renderPreview(el, rawText);
    return el;
  }

  function renderRaw(el, text) {
    el.className = 'editor-line raw';
    el.contentEditable = 'true';
    el.spellcheck = true;
    el.dataset.raw = text;
    el.textContent = text;
  }

  function renderPreview(el, text) {
    if (el.querySelector('.block-wrapper')) {
      el.className = 'editor-line rendered';
      el.contentEditable = 'false';
      return;
    }
    el.dataset.raw = text;

    // Multi-line fenced code blocks need special render
    if (text.startsWith('```')) {
      const lines = text.split('\n');
      const lang  = lines[0].slice(3).trim();
      const code  = lines.slice(1, lines.length - 1).join('\n');
      el.className = 'editor-line rendered';
      el.contentEditable = 'false';
      el.innerHTML = `<pre><code class="language-${escHtml(lang)}">${escHtml(code)}</code></pre>`;
      return;
    }

    el.className = 'editor-line rendered';
    el.contentEditable = 'false';
    el.innerHTML = MD.renderLine(text);
  }

  function escHtml(s) { return MD.escHtml(s); }


  // ─────────────────────────────────────────────────────────
  //  EDITOR EVENTS
  // ─────────────────────────────────────────────────────────

  function bindEditorEvents() {
    $pageTitle.addEventListener('input', () => {
      if (!_currentPageId) return;
      const page = Storage.getPage(_currentPageId);
      if (!page) return;
      page.title = $pageTitle.value;
      page.updatedAt = Date.now();
      $pathPage.textContent = page.title || 'Untitled';
      Storage.savePage(page);
      setSaving();
      scheduleSave();
      updateWordCount();
      renderPageTree();
    });

    $pageTitle.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = $editor.firstElementChild;
        if (first) focusLine(first, 0); else $editor.focus();
      }
    });

    $editor.addEventListener('click', e => {
      closeSlashMenu();
      closeFileOptionsMenu();
      const line = e.target.closest('.editor-line');
      if (!line) return;
      if (line.contentEditable !== 'true') activateLine(line);
    });

    $editor.addEventListener('focusin', e => {
      const line = e.target.closest('.editor-line');
      if (line && line !== _activeLine) setActiveLine(line);
    });

    $editor.addEventListener('focusout', e => {
      setTimeout(() => {
        const focused = document.activeElement;
        if (!$editor.contains(focused) || focused === $editor) {
          if (_activeLine) deactivateLine(_activeLine);
        }
      }, 80);
    });

    $editor.addEventListener('input', e => {
      const line = e.target.closest('.editor-line.raw');
      if (!line) return;
      line.dataset.raw = line.textContent || '';
      scheduleSave();
      updateWordCount();
      syncPreview();
      // Live preview: re-render other lines
      if (_currentMode === 'livepreview') schedulePassiveRender();
    });

    // keyup for slash detection (fires AFTER character is inserted)
    $editor.addEventListener('keyup', e => {
      const line = e.target.closest('.editor-line.raw');
      if (!line) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Enter' && e.key !== 'Escape') {
        updateSlashState(line);
      }
    });

    $editor.addEventListener('keydown', e => {
      handleEditorKeydown(e);
    });

    // Handle paste to keep plain text
    $editor.addEventListener('paste', e => {
      const line = e.target.closest('.editor-line.raw');
      if (!line) return;
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!text) return;
      const pasteLines = text.split('\n');
      if (pasteLines.length === 1) {
        document.execCommand('insertText', false, text);
        return;
      }
      // Multi-line paste: insert each as a new line
      const pos    = getCursorOffset(line);
      const raw    = getRawText(line);
      const before = raw.slice(0, pos);
      const after  = raw.slice(pos);

      setLineText(line, before + pasteLines[0]);
      deactivateLine(line);

      let lastLine = line;
      for (let i = 1; i < pasteLines.length; i++) {
        const isLast = i === pasteLines.length - 1;
        const newLine = createLineEl(pasteLines[i] + (isLast ? after : ''), isLast);
        lastLine.after(newLine);
        lastLine = newLine;
      }
      if (lastLine.contentEditable !== 'true') activateLine(lastLine);
      focusLine(lastLine, (pasteLines[pasteLines.length - 1]).length);
      setActiveLine(lastLine);
      scheduleSave();
      syncPreview();
    });
  }

  function handleEditorKeydown(e) {
    if (_slashState && isSlashMenuVisible()) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSlashSelection(1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); moveSlashSelection(-1); return; }
      if (e.key === 'Enter')     { e.preventDefault(); confirmSlashSelection(); return; }
      if (e.key === 'Escape')    { e.preventDefault(); closeSlashMenu(); return; }
      if (e.key === 'Tab')       { e.preventDefault(); confirmSlashSelection(); return; }
    }

    const line = e.target.closest('.editor-line');
    if (!line) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEnter(line);
    } else if (e.key === 'Backspace') {
      handleBackspace(e, line);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      insertTextAtCursor(e.shiftKey ? '' : '  ');
    } else if (e.key === 'ArrowUp') {
      handleArrowUp(e, line);
    } else if (e.key === 'ArrowDown') {
      handleArrowDown(e, line);
    }
  }

  function handleEnter(line) {
    closeSlashMenu();
    const raw = getRawText(line);
    const pos = getCursorOffset(line);
    const before = raw.slice(0, pos);
    const after  = raw.slice(pos);

    let newLinePrefix = '';
    const listMatch = before.match(/^([ \t]*)([-*+]|\d+\.)\s/);
    if (listMatch) {
      if (before.trim() === listMatch[2] || before.trim() === listMatch[2] + ' ') {
        setLineText(line, '');
        deactivateLine(line);
        const newLine = createLineEl('', true);
        line.after(newLine);
        focusLine(newLine, 0);
        setActiveLine(newLine);
        scheduleSave();
        return;
      }
      const isOrdered = /^\d+\./.test(listMatch[2]);
      newLinePrefix   = listMatch[1] + (isOrdered ? '1. ' : listMatch[2] + ' ');
    }

    setLineText(line, before);
    deactivateLine(line);

    const newLine = createLineEl(newLinePrefix + after, true);
    line.after(newLine);
    focusLine(newLine, newLinePrefix.length);
    setActiveLine(newLine);

    scheduleSave();
    updateWordCount();
    syncPreview();
  }

  function handleBackspace(e, line) {
    const pos = getCursorOffset(line);
    if (pos === 0) {
      const prev = line.previousElementSibling;
      if (!prev) return;
      e.preventDefault();
      const prevRaw = getRawText(prev);
      const thisRaw = getRawText(line);
      const mergedAt = prevRaw.length;
      setLineText(prev, prevRaw + thisRaw);
      activateLine(prev);
      focusLine(prev, mergedAt);
      line.remove();
      scheduleSave();
      updateWordCount();
      syncPreview();
    }
  }

  function handleArrowUp(e, line) {
    // Always move to previous line when at start OR when at any position
    // We rely on browser default within a line, override only at line boundaries
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    // Check if cursor is on the first visible text row of the element
    const lineRect = line.getBoundingClientRect();
    const rangeRect = range.getBoundingClientRect();
    const atFirstRow = rangeRect.top <= lineRect.top + 4;

    if (atFirstRow) {
      const prev = line.previousElementSibling;
      if (prev) {
        e.preventDefault();
        if (prev.contentEditable !== 'true') activateLine(prev);
        // Place cursor at end of previous line
        focusLine(prev, getRawText(prev).length);
      }
    }
  }

  function handleArrowDown(e, line) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const lineRect = line.getBoundingClientRect();
    const rangeRect = range.getBoundingClientRect();
    const atLastRow = rangeRect.bottom >= lineRect.bottom - 4;

    if (atLastRow) {
      const next = line.nextElementSibling;
      if (next) {
        e.preventDefault();
        if (next.contentEditable !== 'true') activateLine(next);
        focusLine(next, 0);
      }
    }
  }


  // ─────────────────────────────────────────────────────────
  //  LINE HELPERS
  // ─────────────────────────────────────────────────────────

  function activateLine(el) {
    if (_activeLine && _activeLine !== el) deactivateLine(_activeLine);
    setActiveLine(el);
    const text = getRawText(el);
    renderRaw(el, text);
    el.focus();
  }

  function deactivateLine(el) {
    if (!el) return;
    const text = el.classList.contains('raw') ? (el.textContent || '') : (el.dataset.raw || '');
    if (el.querySelector('.block-wrapper')) {
      el.className = 'editor-line rendered';
      el.contentEditable = 'false';
    } else {
      renderPreview(el, text);
    }
    if (_activeLine === el) _activeLine = null;
  }

  function setActiveLine(el) {
    if (_activeLine && _activeLine !== el) deactivateLine(_activeLine);
    _activeLine = el;
  }

  function setLineText(el, text) {
    el.dataset.raw = text;
    el.textContent = text;
  }

  function getRawText(el) {
    if (el.classList.contains('raw')) return el.textContent || '';
    return el.dataset.raw !== undefined ? el.dataset.raw : el.textContent || '';
  }

  function focusLine(el, offset) {
    if (!el) return;
    if (el.contentEditable !== 'true') {
      activateLine(el);
      // After activating, re-call focus with offset
      setTimeout(() => focusLineAt(el, offset), 0);
      return;
    }
    focusLineAt(el, offset);
  }

  function focusLineAt(el, offset) {
    el.focus();
    try {
      const range = document.createRange();
      const sel   = window.getSelection();
      const node  = el.childNodes[0] || el;
      const len   = node.textContent ? node.textContent.length : 0;
      range.setStart(node, Math.min(offset, len));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  }

  function getCursorOffset(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const pre   = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  function insertTextAtCursor(text) {
    document.execCommand('insertText', false, text);
  }


  // ─────────────────────────────────────────────────────────
  //  PASSIVE RENDER (live preview — re-render all non-active)
  // ─────────────────────────────────────────────────────────

  let _passiveRenderTimer = null;

  function schedulePassiveRender() {
    clearTimeout(_passiveRenderTimer);
    _passiveRenderTimer = setTimeout(passiveRender, 150);
  }

  function passiveRender() {
    if (_currentMode === 'editing') return;
    $editor.querySelectorAll('.editor-line').forEach(el => {
      if (el !== _activeLine && !el.querySelector('.block-wrapper')) {
        const text = getRawText(el);
        renderPreview(el, text);
      }
    });
  }


  // ─────────────────────────────────────────────────────────
  //  SLASH COMMAND SYSTEM
  // ─────────────────────────────────────────────────────────

  const BUILTIN_COMMANDS = [
    { id:'h1',         slashCommand:'h1',         label:'Heading 1',        description:'Large heading',              icon:'H1', create: () => insertRawLine('# ') },
    { id:'h2',         slashCommand:'h2',         label:'Heading 2',        description:'Medium heading',             icon:'H2', create: () => insertRawLine('## ') },
    { id:'h3',         slashCommand:'h3',         label:'Heading 3',        description:'Small heading',              icon:'H3', create: () => insertRawLine('### ') },
    { id:'bullet',     slashCommand:'bullet',     label:'Bullet list',      description:'Unordered list item',        icon:'•',  create: () => insertRawLine('- ') },
    { id:'numbered',   slashCommand:'numbered',   label:'Numbered list',    description:'Ordered list item',          icon:'1.', create: () => insertRawLine('1. ') },
    { id:'todo',       slashCommand:'todo',       label:'To-do item',       description:'Checkbox task',              icon:'☑', create: () => insertRawLine('- [ ] ') },
    { id:'quote',      slashCommand:'quote',      label:'Quote',            description:'Blockquote',                 icon:'❝',  create: () => insertRawLine('> ') },
    { id:'hr',         slashCommand:'hr',         label:'Divider',          description:'Horizontal rule',            icon:'—',  create: () => insertRawLine('---') },
    { id:'code',       slashCommand:'code',       label:'Code block',       description:'Fenced code block',          icon:'<>', create: () => insertRawLine('```\n\n```') },
    { id:'canvas',     slashCommand:'canvas',     label:'Drawing Canvas',   description:'Insert a drawing canvas',    icon:'✏️', create: () => createCanvasBlock() },
    { id:'mermaid',    slashCommand:'mermaid',    label:'Mermaid Diagram',  description:'Insert a Mermaid diagram',   icon:'📊', create: () => createMermaidBlock() },
    { id:'collabgun',  slashCommand:'collabgun',  label:'CollabGun Block',  description:'Live GUN.js collab block',   icon:'🔫', create: () => createCollabGunBlock() },
  ];

  BUILTIN_COMMANDS.forEach(cmd => {
    if (typeof cmd.create === 'function') Extensions.register(cmd);
  });

  // insertRawLine is a special creator that returns null but modifies current line
  function insertRawLine(prefix) {
    // Will be handled in confirmSlashSelection
    return { _insertPrefix: prefix };
  }

  function getSlashCommands(query) {
    const q = (query || '').toLowerCase();
    const all = [
      ...BUILTIN_COMMANDS,
      ...Extensions.getAll().filter(e => !BUILTIN_COMMANDS.find(b => b.id === e.id)),
    ];
    return all.filter(c =>
      c.slashCommand.toLowerCase().startsWith(q) ||
      c.label.toLowerCase().includes(q)
    );
  }

  function updateSlashState(lineEl) {
    const text   = lineEl.textContent || '';
    const pos    = getCursorOffset(lineEl);
    const before = text.slice(0, pos);
    // Slash at start of line or after whitespace
    const match  = before.match(/(^|[\s])\/([\w]*)$/);
    if (match) {
      _slashState = { lineEl, startOffset: before.lastIndexOf('/'), query: match[2] };
      showSlashMenu(match[2], lineEl);
    } else {
      _slashState = null;
      closeSlashMenu();
    }
  }

  function showSlashMenu(query, lineEl) {
    const cmds = getSlashCommands(query);
    if (cmds.length === 0) { closeSlashMenu(); return; }

    $slashMenu.innerHTML = '';
    _slashSelected = 0;

    cmds.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'slash-item' + (i === 0 ? ' selected' : '');
      item.dataset.cmd = cmd.slashCommand;
      item.innerHTML = `
        <span class="slash-icon">${cmd.icon || '⚡'}</span>
        <div class="slash-info">
          <span class="slash-name">${escHtml(cmd.label)}</span>
          <span class="slash-desc">${escHtml(cmd.description)}</span>
        </div>
      `;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        _slashSelected = i;
        confirmSlashSelection();
      });
      $slashMenu.appendChild(item);
    });

    // Position: anchor below caret, keep on screen
    const rect = lineEl.getBoundingClientRect();
    const menuH = Math.min(cmds.length * 46 + 10, 280);
    let top = rect.bottom + 4;
    // If would go off bottom, show above
    if (top + menuH > window.innerHeight - 20) top = rect.top - menuH - 4;
    let left = rect.left;
    if (left + 250 > window.innerWidth) left = window.innerWidth - 260;
    $slashMenu.style.top  = top + 'px';
    $slashMenu.style.left = Math.max(4, left) + 'px';
    $slashMenu.classList.add('visible');
  }

  function closeSlashMenu() {
    $slashMenu.classList.remove('visible');
    _slashState = null;
  }

  function isSlashMenuVisible() {
    return $slashMenu.classList.contains('visible');
  }

  function moveSlashSelection(delta) {
    const items = $slashMenu.querySelectorAll('.slash-item');
    if (!items.length) return;
    items[_slashSelected].classList.remove('selected');
    _slashSelected = (_slashSelected + delta + items.length) % items.length;
    items[_slashSelected].classList.add('selected');
    items[_slashSelected].scrollIntoView({ block: 'nearest' });
  }

  async function confirmSlashSelection() {
    const items = $slashMenu.querySelectorAll('.slash-item');
    if (!items.length || !_slashState) { closeSlashMenu(); return; }

    const keyword = items[_slashSelected]?.dataset.cmd;
    const state   = _slashState;
    closeSlashMenu();
    if (!keyword) return;

    const { lineEl, startOffset } = state;
    const curPos = getCursorOffset(lineEl);
    const raw    = lineEl.textContent || '';
    const before = raw.slice(0, startOffset);
    const after  = raw.slice(curPos);

    // Try extension (load on demand)
    let ext = Extensions.get(keyword);
    if (!ext) {
      await Extensions.ensureLoaded(keyword);
      ext = Extensions.get(keyword);
    }

    if (!ext || !ext.create) return;

    // Run create
    const result = ext.create();

    // Handle prefix-only inserts (headings, lists, etc.)
    if (result && result._insertPrefix !== undefined) {
      setLineText(lineEl, result._insertPrefix + (before + after).trimStart());
      activateLine(lineEl);
      focusLine(lineEl, result._insertPrefix.length);
      scheduleSave();
      return;
    }

    // Clear slash+query from line
    setLineText(lineEl, before + after);

    if (!result) return; // No block to insert

    const wrapper = document.createElement('div');
    wrapper.className = 'editor-line rendered';
    wrapper.contentEditable = 'false';
    wrapper.appendChild(result);

    if ((before + after).trim() === '') {
      lineEl.replaceWith(wrapper);
    } else {
      deactivateLine(lineEl);
      lineEl.after(wrapper);
    }

    if (typeof ext.mount === 'function') ext.mount(wrapper);

    const nextLine = createLineEl('', true);
    wrapper.after(nextLine);
    focusLine(nextLine, 0);
    setActiveLine(nextLine);
    scheduleSave();
  }

  function bindSlashMenuEvents() {
    document.addEventListener('mousedown', e => {
      if (!$slashMenu.contains(e.target)) closeSlashMenu();
    });
  }


  // ─────────────────────────────────────────────────────────
  //  CANVAS BLOCK
  // ─────────────────────────────────────────────────────────

  function createCanvasBlock() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'canvas';

    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span>Drawing Canvas</span>
        <div class="block-toolbar-actions">
          <button class="block-toolbar-btn" data-action="clear">Clear</button>
          <button class="block-toolbar-btn" data-action="download">Save PNG</button>
        </div>
      </div>
    `;

    const canvas = document.createElement('canvas');
    canvas.className = 'canvas-block';
    canvas.width  = 800;
    canvas.height = 320;
    canvas.style.width  = '100%';
    canvas.style.height = '320px';
    wrapper.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#F5A623';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    let drawing = false, lastX = 0, lastY = 0;

    function getPos(e) {
      const r = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return [(clientX - r.left) * scaleX, (clientY - r.top) * scaleY];
    }

    canvas.addEventListener('pointerdown', e => { drawing = true; [lastX, lastY] = getPos(e); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const [x, y] = getPos(e);
      ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
      [lastX, lastY] = [x, y];
    });
    canvas.addEventListener('pointerup',    () => { drawing = false; });
    canvas.addEventListener('pointerleave', () => { drawing = false; });

    wrapper.querySelector('[data-action="clear"]').addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    wrapper.querySelector('[data-action="download"]').addEventListener('click', () => { const a = document.createElement('a'); a.download = 'canvas.png'; a.href = canvas.toDataURL(); a.click(); });

    wrapper.getData = () => ({ data: canvas.toDataURL() });
    wrapper.setData = ({ data } = {}) => { if (!data) return; const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = data; };

    return wrapper;
  }


  // ─────────────────────────────────────────────────────────
  //  MERMAID BLOCK
  // ─────────────────────────────────────────────────────────

  function createMermaidBlock() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'mermaid';

    const defaultSrc = `graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Action]\n  B -->|No| D[End]`;
    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span>Mermaid Diagram</span>
        <div class="block-toolbar-actions">
          <button class="block-toolbar-btn" data-action="toggle-src">Edit</button>
        </div>
      </div>
      <div class="mermaid-render"></div>
      <textarea class="mermaid-src" style="display:none;" spellcheck="false">${escHtml(defaultSrc)}</textarea>
    `;

    const renderEl  = wrapper.querySelector('.mermaid-render');
    const srcEl     = wrapper.querySelector('.mermaid-src');
    const toggleBtn = wrapper.querySelector('[data-action="toggle-src"]');
    let srcVisible  = false;

    function renderMermaid() {
      const src = srcEl.value.trim();
      renderEl.innerHTML = '';
      try {
        if (window.mermaid) {
          const id = 'mm_' + Date.now();
          renderEl.innerHTML = `<div class="mermaid" id="${id}">${escHtml(src)}</div>`;
          mermaid.init(undefined, renderEl.querySelector('.mermaid'));
        } else {
          renderEl.innerHTML = `<pre style="font-size:12px;color:var(--txt-3);">Mermaid loading…</pre>`;
        }
      } catch(e) {
        renderEl.innerHTML = `<pre style="font-size:12px;color:#F44336;">${escHtml(String(e))}</pre>`;
      }
    }

    toggleBtn.addEventListener('click', () => {
      srcVisible = !srcVisible;
      srcEl.style.display = srcVisible ? 'block' : 'none';
      toggleBtn.textContent = srcVisible ? 'Preview' : 'Edit';
      if (!srcVisible) renderMermaid();
    });
    srcEl.addEventListener('input', () => { clearTimeout(srcEl._t); srcEl._t = setTimeout(renderMermaid, 600); });

    if (window.mermaid) { mermaid.initialize({ startOnLoad: false, theme: 'dark' }); renderMermaid(); }
    else { window.addEventListener('load', () => { if (window.mermaid) { mermaid.initialize({ startOnLoad: false, theme: 'dark' }); renderMermaid(); } }); }

    wrapper.getData = () => ({ src: srcEl.value });
    wrapper.setData = ({ src } = {}) => { if (src !== undefined) { srcEl.value = src; renderMermaid(); } };

    return wrapper;
  }


  // ─────────────────────────────────────────────────────────
  //  COLLABGUN BLOCK
  // ─────────────────────────────────────────────────────────

  function createCollabGunBlock() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'collabgun';

    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span>CollabGun Block</span>
        <span class="collabgun-status" id="cg-status-${Date.now()}"></span>
        <div class="block-toolbar-actions">
          <input class="panel-input" style="width:130px;padding:2px 8px;font-size:11px;" placeholder="Room name" data-cg="room">
          <input class="panel-input" style="width:110px;padding:2px 8px;font-size:11px;" type="password" placeholder="Passcode" data-cg="pass">
          <button class="block-toolbar-btn" data-cg="connect">Connect</button>
        </div>
      </div>
      <div class="collabgun-content" contenteditable="false" data-cg="content">Enter room and passcode to connect…</div>
    `;

    const statusEl  = wrapper.querySelector('[id^="cg-status"]');
    const contentEl = wrapper.querySelector('[data-cg="content"]');
    const roomInput = wrapper.querySelector('[data-cg="room"]');
    const passInput = wrapper.querySelector('[data-cg="pass"]');
    const connectBtn = wrapper.querySelector('[data-cg="connect"]');

    let gunRef   = null;
    let connected= false;
    let _room    = '';
    let _pass    = '';

    async function deriveKey(pass) {
      const buf  = new TextEncoder().encode(pass);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
    }
    async function xorEncrypt(text, pass) {
      const k = await deriveKey(pass);
      const out = [];
      for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i) ^ k.charCodeAt(i % k.length));
      return btoa(String.fromCharCode(...out));
    }
    async function xorDecrypt(b64, pass) {
      try {
        const k = await deriveKey(pass);
        const bytes = atob(b64).split('').map(c => c.charCodeAt(0));
        return bytes.map((b, i) => String.fromCharCode(b ^ k.charCodeAt(i % k.length))).join('');
      } catch { return null; }
    }

    async function connect() {
      _room = roomInput.value.trim();
      _pass = passInput.value.trim();
      if (!_room || !_pass) { statusEl.textContent = 'Room + passcode required'; statusEl.className = 'collabgun-status error'; return; }

      statusEl.textContent = 'Connecting…'; statusEl.className = 'collabgun-status';
      await ensureGun();
      if (!window.Gun) { statusEl.textContent = 'GUN load failed'; statusEl.className = 'collabgun-status error'; return; }

      gunRef = Gun(['https://gun-manhattan.herokuapp.com/gun']);
      connected = true;
      statusEl.textContent = 'Live'; statusEl.className = 'collabgun-status live';

      // Subscribe to updates
      gunRef.get('leaper-collab').get(_room).on(async (node) => {
        if (!node || !node.data) return;
        const decrypted = await xorDecrypt(node.data, _pass);
        if (decrypted === null) {
          statusEl.textContent = 'Wrong passcode'; statusEl.className = 'collabgun-status error';
          contentEl.contentEditable = 'false';
          contentEl.textContent = 'Wrong passcode — read-only.';
          return;
        }
        // First line must be [GUN] — enforce
        const lines = decrypted.split('\n');
        if (!lines[0] || lines[0].trim() !== '[GUN]') {
          contentEl.contentEditable = 'false';
          contentEl.textContent = 'Wrong passcode — first line must be [GUN].';
          statusEl.textContent = 'Locked'; statusEl.className = 'collabgun-status error';
          return;
        }
        contentEl.contentEditable = 'true';
        if (contentEl.textContent !== decrypted) contentEl.textContent = decrypted;
        statusEl.textContent = 'Live'; statusEl.className = 'collabgun-status live';
      });

      // Initial content
      contentEl.contentEditable = 'true';
      if (!contentEl.textContent || contentEl.textContent === 'Enter room and passcode to connect…') {
        contentEl.textContent = '[GUN]\n';
      }
    }

    connectBtn.addEventListener('click', connect);

    // Push on edit
    let _pushTimer = null;
    contentEl.addEventListener('input', async () => {
      if (!connected) return;
      const text = contentEl.textContent || '';
      const lines = text.split('\n');
      if (!lines[0] || lines[0].trim() !== '[GUN]') {
        contentEl.style.outline = '1px solid #F44336';
        return;
      }
      contentEl.style.outline = '';
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(async () => {
        const enc = await xorEncrypt(text, _pass);
        gunRef.get('leaper-collab').get(_room).put({ data: enc, ts: Date.now() });
      }, 500);
    });

    wrapper.getData = () => ({ room: _room, content: contentEl.textContent });
    wrapper.setData = ({ room, content } = {}) => {
      if (room) roomInput.value = room;
      if (content) contentEl.textContent = content;
    };

    return wrapper;
  }


  // ─────────────────────────────────────────────────────────
  //  BLOCK RESTORE
  // ─────────────────────────────────────────────────────────

  function restoreBlockLine(type, data) {
    let blockWrapper = null;
    if (type === 'canvas') {
      blockWrapper = createCanvasBlock();
      if (data && blockWrapper.setData) requestAnimationFrame(() => blockWrapper.setData(data));
    } else if (type === 'mermaid') {
      blockWrapper = createMermaidBlock();
      if (data && blockWrapper.setData) blockWrapper.setData(data);
    } else if (type === 'collabgun') {
      blockWrapper = createCollabGunBlock();
      if (data && blockWrapper.setData) blockWrapper.setData(data);
    } else {
      return null;
    }
    const lineEl = document.createElement('div');
    lineEl.className = 'editor-line rendered';
    lineEl.contentEditable = 'false';
    lineEl.appendChild(blockWrapper);
    return lineEl;
  }


  // ─────────────────────────────────────────────────────────
  //  SAVE HELPERS
  // ─────────────────────────────────────────────────────────

  let _saveTimer = null;

  function scheduleSave() {
    setSaving();
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(flushCurrentPage, 600);
  }

  function flushCurrentPage() {
    if (_currentPageId) flushPage(_currentPageId);
  }

  function flushPage(id) {
    const page = Storage.getPage(id);
    if (!page) return;
    // Save version snapshot every 2 minutes of inactivity
    const now = Date.now();
    const versions = Storage.getVersions(id);
    if (!versions.length || now - versions[0].ts > 2 * 60 * 1000) {
      Storage.pushVersion(id, page.content, page.title);
    }
    page.content   = serializeEditor();
    page.title     = $pageTitle.value;
    page.updatedAt = now;
    Storage.savePage(page);
    setSaved();
  }

  function serializeEditor() {
    const parts = [];
    $editor.querySelectorAll('.editor-line').forEach(el => {
      const bw = el.querySelector('.block-wrapper');
      if (bw) {
        const bt   = bw.dataset.blockType || '';
        const data = typeof bw.getData === 'function' ? bw.getData() : {};
        try { parts.push(`<!-- block:${bt} ${JSON.stringify(data)} -->`); }
        catch { parts.push(`<!-- block:${bt} {} -->`); }
        return;
      }
      parts.push(getRawText(el));
    });
    return parts.join('\n');
  }

  function setSaving() { $saveDot.className = 'save-dot saving'; $saveLabel.textContent = 'Saving…'; }
  function setSaved()  { $saveDot.className = 'save-dot saved';  $saveLabel.textContent = 'Saved'; }

  function updateWordCount() {
    const text  = $pageTitle.value + ' ' + serializeEditor();
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    $wordCount.textContent = words + ' word' + (words !== 1 ? 's' : '');
  }


  // ─────────────────────────────────────────────────────────
  //  PREVIEW (side-by-side / preview-only)
  // ─────────────────────────────────────────────────────────

  let _previewTimer = null;

  function syncPreview() {
    if (_currentMode !== 'sidebyside' && _currentMode !== 'previewonly') return;
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => {
      $previewTitle.textContent = $pageTitle.value || 'Untitled';
      $previewContent.innerHTML = MD.renderDocument(serializeEditor());
    }, 150);
  }


  // ─────────────────────────────────────────────────────────
  //  VIEW MODES  (removed hybrid)
  // ─────────────────────────────────────────────────────────

  function setMode(mode) {
    // Guard: no hybrid
    if (mode === 'hybrid') mode = 'livepreview';
    _currentMode = mode;

    $app.className = $app.className.replace(/\bmode-\w+/g, '').trim();
    $app.classList.add('mode-' + mode);

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'editing') {
      makeAllRaw();
    } else {
      passiveRender();
    }

    if (mode === 'previewonly' || mode === 'sidebyside') syncPreview();
  }

  function makeAllRaw() {
    $editor.querySelectorAll('.editor-line').forEach(el => {
      if (!el.querySelector('.block-wrapper')) renderRaw(el, getRawText(el));
    });
  }


  // ─────────────────────────────────────────────────────────
  //  SIDEBAR EVENTS
  // ─────────────────────────────────────────────────────────

  function bindSidebarEvents() {
    // New page
    document.getElementById('btn-new-page').addEventListener('click', () => createPage());

    // New folder
    document.getElementById('btn-new-folder').addEventListener('click', () => {
      const name = prompt('Folder name:');
      if (!name) return;
      Storage.createFolder(name.trim());
      renderPageTree();
    });

    // Workspace switcher
    document.getElementById('ws-switcher').addEventListener('click', () => {
      openPanel('ws-panel');
      renderWsList();
    });

    // Version history
    document.getElementById('btn-history').addEventListener('click', () => {
      openPanel('history-panel');
      renderVersionList();
    });

    // Backup
    document.getElementById('btn-backup').addEventListener('click', () => openPanel('backup-panel'));

    // Passcode
    document.getElementById('btn-passcode').addEventListener('click', () => {
      openPanel('passcode-panel');
      updatePasscodePanel();
    });

    // Marketplace (Extensions)
    document.getElementById('btn-marketplace').addEventListener('click', () => {
      openPanel('marketplace-panel');
      renderMarketplace();
    });
  }


  // ─────────────────────────────────────────────────────────
  //  TOPBAR EVENTS
  // ─────────────────────────────────────────────────────────

  function bindTopbarEvents() {
    // Sidebar toggle (works on both mobile and desktop)
    document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
      if (window.innerWidth <= 700) {
        $app.classList.toggle('sidebar-open');
      } else {
        $app.classList.toggle('sidebar-collapsed');
      }
    });

    // Mobile: tap backdrop to close sidebar
    document.getElementById('sidebar-backdrop').addEventListener('click', () => {
      $app.classList.remove('sidebar-open');
    });

    // File options on crumb-page click
    document.getElementById('crumb-page').addEventListener('click', e => {
      e.stopPropagation();
      showFileOptionsMenu(e.currentTarget);
    });

    // Workspace crumb in topbar also opens workspace panel
    document.getElementById('crumb-workspace').addEventListener('click', () => {
      openPanel('ws-panel');
      renderWsList();
    });

    // Close menus on outside click
    document.addEventListener('click', () => {
      closeFileOptionsMenu();
    });
  }


  // ─────────────────────────────────────────────────────────
  //  FILE OPTIONS DROPDOWN
  // ─────────────────────────────────────────────────────────

  function showFileOptionsMenu(anchorEl) {
    if (!_currentPageId) return;
    const page = Storage.getPage(_currentPageId);
    if (!page) return;

    const wsid    = Storage.getActiveWorkspaceId();
    const folders = Storage.getFolders(wsid);

    $fileOptionsMenu.innerHTML = `
      <div class="foption" data-fo="rename">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 10h3l6-6-3-3-6 6v3z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
        Rename page
      </div>
      <div class="foption" data-fo="move">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 3.5h4l1 1.5h5v6h-10z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
        Move to folder
      </div>
      <div class="foption" data-fo="duplicate">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4 2h7v7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        Duplicate
      </div>
      <div class="foption" data-fo="export-md">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 9v2h9V9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M6.5 2v6M4 5.5l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        Export as Markdown
      </div>
      <div class="foption-sep"></div>
      <div class="foption" data-fo="ai-actions">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6.5h4M6.5 4.5v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        AI Actions
      </div>
      <div class="foption" data-fo="sync">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M11 6.5C11 9.038 8.985 11 6.5 11S2 9.038 2 6.5 4.015 2 6.5 2c1.3 0 2.47.528 3.325 1.383" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 2L9.5 4L7.5 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        GUN Sync
      </div>
      <div class="foption-sep"></div>
      <div class="foption danger" data-fo="delete">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 4h9M5 4V2.5h3V4M10 4l-.7 7H3.7L3 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        Delete page
      </div>
    `;

    // Position below anchor
    const rect = anchorEl.getBoundingClientRect();
    let top  = rect.bottom + 4;
    let left = rect.left;
    if (left + 200 > window.innerWidth) left = window.innerWidth - 205;
    $fileOptionsMenu.style.top  = top + 'px';
    $fileOptionsMenu.style.left = Math.max(4, left) + 'px';
    $fileOptionsMenu.classList.add('visible');

    // Bind actions
    $fileOptionsMenu.addEventListener('click', e => {
      const fo = e.target.closest('[data-fo]')?.dataset.fo;
      if (!fo) return;
      closeFileOptionsMenu();
      handleFileOption(fo, page, wsid, folders);
    }, { once: true });
  }

  function handleFileOption(action, page, wsid, folders) {
    if (action === 'rename') {
      const name = prompt('Page name:', page.title);
      if (name === null) return;
      page.title = name.trim() || page.title;
      page.updatedAt = Date.now();
      Storage.savePage(page);
      $pageTitle.value = page.title;
      $pathPage.textContent = page.title;
      renderPageTree();

    } else if (action === 'move') {
      if (!folders.length) { alert('No folders exist. Create one first.'); return; }
      const names = folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
      const idx   = parseInt(prompt('Move to folder (enter number, 0 for root):\n' + names)) - 1;
      if (isNaN(idx)) return;
      page.folderId = idx < 0 ? null : (folders[idx] ? folders[idx].id : null);
      page.updatedAt = Date.now();
      Storage.savePage(page);
      renderPageTree();

    } else if (action === 'duplicate') {
      const newPage = Storage.createPage(page.title + ' (copy)', page.folderId, wsid);
      newPage.content = page.content;
      Storage.savePage(newPage);
      renderPageTree();
      openPage(newPage.id);

    } else if (action === 'export-md') {
      const blob = new Blob([page.content], { type: 'text/markdown' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = (page.title || 'untitled').replace(/[^a-z0-9]/gi, '_') + '.md';
      a.click();

    } else if (action === 'delete') {
      deletePage(page.id);

    } else if (action === 'ai-actions') {
      openPanel('ai-panel');

    } else if (action === 'sync') {
      openPanel('sync-panel');
    }
  }

  function closeFileOptionsMenu() {
    $fileOptionsMenu.classList.remove('visible');
  }


  // ─────────────────────────────────────────────────────────
  //  STATUS BAR EVENTS
  // ─────────────────────────────────────────────────────────

  function bindStatusbarEvents() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });
  }


  // ─────────────────────────────────────────────────────────
  //  PANELS (shared open/close)
  // ─────────────────────────────────────────────────────────

  function openPanel(id) {
    closeAllPanels();
    document.getElementById(id).classList.add('visible');
    document.getElementById('panel-backdrop').classList.add('visible');
  }

  function closeAllPanels() {
    document.querySelectorAll('.panel.visible').forEach(p => p.classList.remove('visible'));
    document.getElementById('panel-backdrop').classList.remove('visible');
  }

  function bindPanelEvents() {
    document.getElementById('panel-backdrop').addEventListener('click', closeAllPanels);

    // Generic close buttons
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', closeAllPanels);
    });

    // Sync panel
    document.getElementById('btn-push').addEventListener('click', syncPush);
    document.getElementById('btn-pull').addEventListener('click', syncPull);

    // Workspace panel
    document.getElementById('ws-create-btn').addEventListener('click', () => {
      const name = document.getElementById('ws-new-name').value.trim();
      if (!name) return;
      Storage.createWorkspace(name);
      document.getElementById('ws-new-name').value = '';
      renderWsList();
    });

    // Version history: rendered on open

    // Backup panel
    document.getElementById('btn-export-json').addEventListener('click', exportAllJson);
    document.getElementById('btn-export-md').addEventListener('click', exportCurrentMd);
    document.getElementById('btn-import-json').addEventListener('click', importJson);

    // Passcode panel
    document.getElementById('passcode-set-btn').addEventListener('click', setPasscode);
    document.getElementById('passcode-remove-btn').addEventListener('click', removePasscode);

    // AI panel
    document.querySelectorAll('.ai-btn').forEach(btn => {
      btn.addEventListener('click', () => runAiAction(btn.dataset.ai));
    });
    document.getElementById('ai-insert-btn').addEventListener('click', insertAiResult);
    document.getElementById('ai-copy-btn').addEventListener('click', copyAiResult);
  }


  // ─────────────────────────────────────────────────────────
  //  WORKSPACE PANEL
  // ─────────────────────────────────────────────────────────

  function renderWsList() {
    const list  = document.getElementById('ws-list');
    const ids   = Storage.getWorkspaceIds();
    const active= Storage.getActiveWorkspaceId();
    list.innerHTML = '';
    ids.forEach(id => {
      const ws = Storage.getWorkspace(id);
      if (!ws) return;
      const item = document.createElement('div');
      item.className = 'ws-item' + (id === active ? ' active' : '');
      item.innerHTML = `
        <span class="ws-item-name">${escHtml(ws.name)}</span>
        ${ids.length > 1 ? `<button class="ws-item-del" data-wdel="${id}">&times;</button>` : ''}
      `;
      item.addEventListener('click', e => {
        if (e.target.dataset.wdel) {
          e.stopPropagation();
          if (!confirm('Delete workspace and all its pages?')) return;
          Storage.deleteWorkspace(e.target.dataset.wdel);
          if (active === e.target.dataset.wdel) {
            const newIds = Storage.getWorkspaceIds();
            if (newIds.length) switchWorkspace(newIds[0]);
          }
          renderWsList();
          return;
        }
        switchWorkspace(id);
        closeAllPanels();
      });
      list.appendChild(item);
    });
  }

  function switchWorkspace(id) {
    if (_currentPageId) flushPage(_currentPageId);
    _currentPageId = null;
    Storage.setActiveWorkspaceId(id);
    Storage.ensureDefaultPage(id);
    const ws = Storage.getWorkspace(id);
    document.getElementById('ws-name').textContent = ws ? ws.name : 'Workspace';
    renderPageTree();
    const ids = Storage.getPageIds(id);
    if (ids.length) openPage(ids[0]);
  }


  // ─────────────────────────────────────────────────────────
  //  VERSION HISTORY PANEL
  // ─────────────────────────────────────────────────────────

  function renderVersionList() {
    if (!_currentPageId) return;
    const page     = Storage.getPage(_currentPageId);
    const versions = Storage.getVersions(_currentPageId);
    const nameEl   = document.getElementById('history-page-name');
    const listEl   = document.getElementById('version-list');

    nameEl.textContent = `Page: ${page ? page.title : '—'}`;
    listEl.innerHTML   = '';

    if (!versions.length) {
      listEl.innerHTML = '<div style="color:var(--txt-3);font-size:12px;padding:8px 0;">No versions yet. Versions are saved automatically every 2 minutes.</div>';
      return;
    }

    versions.forEach((v, i) => {
      const d    = new Date(v.ts);
      const item = document.createElement('div');
      item.className = 'version-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:500;color:var(--txt)">${escHtml(v.title || 'Untitled')}</div>
          <div class="version-time">${d.toLocaleString()}</div>
        </div>
        <button class="version-restore" data-vi="${i}">Restore</button>
      `;
      item.querySelector('.version-restore').addEventListener('click', () => {
        if (!confirm('Restore this version? Current content will be saved as a new version.')) return;
        const restoredPage = Storage.restoreVersion(_currentPageId, i);
        if (restoredPage) {
          buildEditor(restoredPage.content);
          $pageTitle.value = restoredPage.title;
          setSaved();
          renderVersionList();
        }
      });
      listEl.appendChild(item);
    });
  }


  // ─────────────────────────────────────────────────────────
  //  BACKUP & RESTORE
  // ─────────────────────────────────────────────────────────

  function backupLog(msg) {
    const log = document.getElementById('backup-log');
    log.style.display = 'block';
    log.textContent += msg + '\n';
  }

  function exportAllJson() {
    const data = JSON.stringify(Storage.exportAll(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'leaperstuff-backup-' + Date.now() + '.json';
    a.click();
    backupLog('Exported all pages as JSON.');
  }

  function exportCurrentMd() {
    if (!_currentPageId) return;
    const page = Storage.getPage(_currentPageId);
    if (!page) return;
    const blob = new Blob([page.content], { type: 'text/markdown' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = (page.title || 'untitled').replace(/[^a-z0-9]/gi, '_') + '.md';
    a.click();
    backupLog('Exported current page as Markdown.');
  }

  function importJson() {
    const fileInput = document.getElementById('backup-file-input');
    const file      = fileInput.files[0];
    if (!file) { backupLog('No file selected.'); return; }
    const reader    = new FileReader();
    reader.onload   = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const ok     = Storage.importAll(parsed);
        if (ok) {
          backupLog('Import successful! Reloading…');
          document.getElementById('ws-name').textContent = Storage.getWorkspace(Storage.getActiveWorkspaceId())?.name || 'Workspace';
          renderPageTree();
          const ids = Storage.getPageIds();
          if (ids.length) openPage(ids[0]);
        } else {
          backupLog('ERROR: Invalid backup format.');
        }
      } catch(ex) {
        backupLog('ERROR: ' + ex.message);
      }
    };
    reader.readAsText(file);
  }


  // ─────────────────────────────────────────────────────────
  //  PASSCODE PANEL
  // ─────────────────────────────────────────────────────────

  function updatePasscodePanel() {
    const has    = Storage.hasPasscode();
    const label  = document.getElementById('passcode-status-label');
    const title  = document.getElementById('passcode-action-title');
    const remRow = document.getElementById('passcode-remove-row');
    label.textContent = has ? 'Passcode is set. Data is encrypted.' : 'No passcode set. Data is unencrypted.';
    title.textContent = has ? 'Change passcode' : 'Set passcode';
    remRow.style.display = has ? '' : 'none';
  }

  async function setPasscode() {
    const code = document.getElementById('passcode-input').value;
    if (!code) return;
    await Storage.setPasscode(code);
    document.getElementById('passcode-input').value = '';
    document.getElementById('passcode-log').style.display = 'block';
    document.getElementById('passcode-log').textContent = 'Passcode set successfully.';
    updatePasscodePanel();
  }

  async function removePasscode() {
    if (!confirm('Remove passcode? Data will be unencrypted.')) return;
    Storage.removePasscode();
    document.getElementById('passcode-log').style.display = 'block';
    document.getElementById('passcode-log').textContent = 'Passcode removed.';
    updatePasscodePanel();
  }


  // ─────────────────────────────────────────────────────────
  //  AI ACTIONS (Puter.js)
  // ─────────────────────────────────────────────────────────

  let _aiResult = '';

  async function ensurePuter() {
    if (window.puter) return true;
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload  = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function runAiAction(action) {
    const resultEl = document.getElementById('ai-result');
    const insertBtn = document.getElementById('ai-insert-btn');
    const copyBtn   = document.getElementById('ai-copy-btn');

    resultEl.classList.add('visible');
    resultEl.textContent = 'Running AI action…';
    insertBtn.style.display = 'none';
    copyBtn.style.display   = 'none';

    const ok = await ensurePuter();
    if (!ok) { resultEl.textContent = 'ERROR: Could not load Puter.js.'; return; }

    const pageContent = $pageTitle.value + '\n\n' + serializeEditor();

    const prompts = {
      summarize:    `Summarize the following notes in 3-5 sentences:\n\n${pageContent}`,
      expand:       `Expand and elaborate on the following notes, adding detail and depth:\n\n${pageContent}`,
      bullets:      `Convert the following into a clean bullet-point list:\n\n${pageContent}`,
      restructure:  `Restructure and improve the organization of the following notes:\n\n${pageContent}`,
      tldr:         `Give a TL;DR (one sentence) of:\n\n${pageContent}`,
      improve:      `Improve the writing quality of the following while keeping the meaning:\n\n${pageContent}`,
    };

    const prompt = prompts[action] || prompts.summarize;

    try {
      const response = await puter.ai.chat(prompt);
      _aiResult = typeof response === 'string' ? response : (response?.message?.content?.[0]?.text || String(response));
      resultEl.textContent = _aiResult;
      insertBtn.style.display = '';
      copyBtn.style.display   = '';
    } catch(e) {
      resultEl.textContent = 'ERROR: ' + (e.message || String(e));
    }
  }

  function insertAiResult() {
    if (!_aiResult) return;
    // Insert at end of editor
    const newLine = createLineEl(_aiResult, false);
    $editor.appendChild(newLine);
    scheduleSave();
    closeAllPanels();
  }

  function copyAiResult() {
    if (!_aiResult) return;
    navigator.clipboard.writeText(_aiResult).catch(() => {});
  }


  // ─────────────────────────────────────────────────────────
  //  EXTENSION MARKETPLACE
  // ─────────────────────────────────────────────────────────

  const MARKETPLACE_EXTENSIONS = [
    { id: 'canvas',    name: 'Drawing Canvas',   desc: 'Built-in drawing block (installed)',   icon: '✏️',  builtin: true },
    { id: 'mermaid',   name: 'Mermaid Diagrams',  desc: 'Built-in diagram block (installed)',  icon: '📊',  builtin: true },
    { id: 'collabgun', name: 'CollabGun',         desc: 'Built-in live collab block (installed)', icon: '🔫', builtin: true },
    { id: 'ocr',       name: 'OCR / Image Text',  desc: 'Extract text from images',            icon: '🔍',  builtin: false },
    { id: 'ai',        name: 'AI Block',          desc: 'Inline AI suggestions',               icon: '🤖',  builtin: false },
    { id: 'chatgun',   name: 'ChatGun',           desc: 'GUN-powered real-time chat block',    icon: '💬',  builtin: false },
    { id: 'table',     name: 'Table Editor',      desc: 'Rich editable table block',           icon: '📋',  builtin: false },
    { id: 'math',      name: 'Math (LaTeX)',       desc: 'Render LaTeX math equations',         icon: '∑',   builtin: false },
  ];

  function renderMarketplace() {
    const list = document.getElementById('marketplace-list');
    list.innerHTML = '';
    MARKETPLACE_EXTENSIONS.forEach(ext => {
      const installed = ext.builtin || Extensions.get(ext.id) !== null;
      const item = document.createElement('div');
      item.className = 'mkt-item';
      item.innerHTML = `
        <div class="mkt-icon">${ext.icon}</div>
        <div class="mkt-info">
          <div class="mkt-name">${escHtml(ext.name)}</div>
          <div class="mkt-desc">${escHtml(ext.desc)}</div>
        </div>
        <button class="mkt-install${installed ? ' installed' : ''}" data-extid="${ext.id}">
          ${installed ? 'Installed' : 'Install'}
        </button>
      `;
      if (!installed) {
        item.querySelector('.mkt-install').addEventListener('click', async () => {
          const btn = item.querySelector('.mkt-install');
          btn.textContent = 'Loading…';
          const ok = await Extensions.ensureLoaded(ext.id);
          btn.textContent  = ok ? 'Installed' : 'Failed';
          btn.classList.toggle('installed', ok);
          if (ok) btn.disabled = true;
        });
      } else {
        item.querySelector('.mkt-install').disabled = true;
      }
      list.appendChild(item);
    });
  }


  // ─────────────────────────────────────────────────────────
  //  SEARCH
  // ─────────────────────────────────────────────────────────

  function bindSearchEvents() {
    const input   = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2) { results.classList.remove('visible'); results.innerHTML = ''; return; }

      const found = Storage.search(q);
      results.innerHTML = '';

      if (!found.length) {
        results.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:var(--txt-3);">No results</div>';
        results.classList.add('visible');
        return;
      }

      found.forEach(r => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        const snippet = r.snippet
          ? r.snippet.replace(new RegExp(`(${r.query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark>$1</mark>')
          : '';
        item.innerHTML = `
          <div class="search-result-title">${escHtml(r.title)}</div>
          ${snippet ? `<div class="search-result-snippet">${snippet}</div>` : ''}
        `;
        item.addEventListener('click', () => {
          openPage(r.id);
          input.value = '';
          results.classList.remove('visible');
          results.innerHTML = '';
          // Close mobile sidebar
          if (window.innerWidth <= 700) $app.classList.remove('sidebar-open');
        });
        results.appendChild(item);
      });

      results.classList.add('visible');
    });

    // Clear on blur after short delay
    input.addEventListener('blur', () => {
      setTimeout(() => { results.classList.remove('visible'); }, 200);
    });
    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 2) results.classList.add('visible');
    });
  }


  // ─────────────────────────────────────────────────────────
  //  GUN.js SYNC
  // ─────────────────────────────────────────────────────────

  function syncLog(msg) {
    const log = document.getElementById('sync-log');
    log.textContent += '\n' + msg;
    log.scrollTop = log.scrollHeight;
  }

  async function ensureGun() {
    if (window.Gun) return true;
    syncLog('Loading GUN.js…');
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/gun/gun.js';
      s.onload  = () => { syncLog('GUN.js loaded.'); resolve(true); };
      s.onerror = () => { syncLog('ERROR: Failed to load GUN.js.'); resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function deriveKeySync(passphrase) {
    const enc  = new TextEncoder().encode(passphrase);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function encrypt(text, key) {
    const k = await deriveKeySync(key);
    const out = [];
    for (let i = 0; i < text.length; i++) out.push(text.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return btoa(String.fromCharCode(...out));
  }

  async function decrypt(b64, key) {
    try {
      const k = await deriveKeySync(key);
      const bytes = atob(b64).split('').map(c => c.charCodeAt(0));
      return bytes.map((b, i) => String.fromCharCode(b ^ k.charCodeAt(i % k.length))).join('');
    } catch { return null; }
  }

  async function syncPush() {
    const passphrase = document.getElementById('sync-key').value.trim();
    const room       = document.getElementById('sync-room').value.trim() || 'leaper-default';
    if (!passphrase) { syncLog('ERROR: Enter an encryption key.'); return; }
    if (!await ensureGun()) return;
    syncLog('Encrypting & pushing…');
    const data      = JSON.stringify(Storage.exportAll());
    const encrypted = await encrypt(data, passphrase);
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    gun.get('leaper').get(room).put({ data: encrypted, ts: Date.now() }, ack => {
      if (ack.err) syncLog('Push error: ' + ack.err);
      else         syncLog('Pushed successfully to room: ' + room);
    });
  }

  async function syncPull() {
    const passphrase = document.getElementById('sync-key').value.trim();
    const room       = document.getElementById('sync-room').value.trim() || 'leaper-default';
    if (!passphrase) { syncLog('ERROR: Enter an encryption key.'); return; }
    if (!await ensureGun()) return;
    syncLog('Pulling from room: ' + room + '…');
    const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);
    gun.get('leaper').get(room).once(async node => {
      if (!node || !node.data) { syncLog('No data found in room.'); return; }
      const decrypted = await decrypt(node.data, passphrase);
      if (!decrypted) { syncLog('ERROR: Decryption failed. Wrong key?'); return; }
      try {
        const parsed = JSON.parse(decrypted);
        const ok     = Storage.importAll(parsed);
        if (ok) {
          syncLog('Pull successful. Reloading pages…');
          document.getElementById('ws-name').textContent = Storage.getWorkspace(Storage.getActiveWorkspaceId())?.name || 'Workspace';
          renderPageTree();
          const ids = Storage.getPageIds();
          if (ids.length) openPage(ids[0]);
        } else { syncLog('ERROR: Invalid data format.'); }
      } catch(e) { syncLog('ERROR: ' + e.message); }
    });
  }


  // ─────────────────────────────────────────────────────────
  //  PUBLIC
  // ─────────────────────────────────────────────────────────

  return { init };

})();


// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
