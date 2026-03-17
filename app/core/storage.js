/**
 * LeaperStuff — Storage Module
 *
 * Schema (prefix "ls_"):
 *   ls_workspaces        → string[]           ordered workspace IDs
 *   ls_active_ws         → string             active workspace ID
 *   ls_ws_<id>           → { id, name }
 *   ls_pages_<wsid>      → string[]           ordered page IDs in workspace
 *   ls_folders_<wsid>    → Folder[]           folders in workspace
 *   ls_page_<id>         → { id, title, content, folderId|null, updatedAt }
 *   ls_versions_<id>     → Version[]          up to MAX_VERSIONS snapshots
 *   ls_passcode          → string | null      SHA-256 hex of passcode (or null)
 */

const Storage = (() => {
  const P           = 'ls_';
  const WS_LIST_KEY = P + 'workspaces';
  const ACTIVE_KEY  = P + 'active_ws';
  const MAX_VERS    = 30;

  /* ── raw helpers ──────────────────────────────────────── */

  function get(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e) { console.warn('[Storage] write failed', e); return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch {} }

  /* ── uid ──────────────────────────────────────────────── */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ── workspaces ───────────────────────────────────────── */

  function getWorkspaceIds() { return get(WS_LIST_KEY) || []; }
  function setWorkspaceIds(ids) { set(WS_LIST_KEY, ids); }

  function getWorkspace(id) { return get(P + 'ws_' + id); }
  function saveWorkspace(ws) { set(P + 'ws_' + ws.id, ws); }
  function deleteWorkspace(id) {
    remove(P + 'ws_' + id);
    let ids = getWorkspaceIds().filter(i => i !== id);
    setWorkspaceIds(ids);
    // Delete all pages in that workspace
    const pageIds = getPageIds(id);
    pageIds.forEach(pid => remove(P + 'page_' + pid));
    remove(P + 'pages_' + id);
    remove(P + 'folders_' + id);
  }

  function getActiveWorkspaceId() {
    const id = get(ACTIVE_KEY);
    const ids = getWorkspaceIds();
    if (id && ids.includes(id)) return id;
    return ids[0] || null;
  }
  function setActiveWorkspaceId(id) { set(ACTIVE_KEY, id); }

  function createWorkspace(name) {
    const id = uid();
    const ws = { id, name: name || 'Workspace' };
    saveWorkspace(ws);
    const ids = getWorkspaceIds();
    ids.push(id);
    setWorkspaceIds(ids);
    return ws;
  }

  function renameWorkspace(id, name) {
    const ws = getWorkspace(id);
    if (!ws) return;
    ws.name = name;
    saveWorkspace(ws);
  }

  function ensureDefaultWorkspace() {
    let ids = getWorkspaceIds();
    if (ids.length === 0) {
      const ws = createWorkspace('My Workspace');
      ids = [ws.id];
    }
    // Ensure active
    if (!getActiveWorkspaceId()) {
      setActiveWorkspaceId(ids[0]);
    }
  }

  /* ── pages ────────────────────────────────────────────── */

  function pageKey(id)    { return P + 'page_' + id; }
  function pagesKey(wsid) { return P + 'pages_' + wsid; }

  function getPageIds(wsid) {
    wsid = wsid || getActiveWorkspaceId();
    return get(pagesKey(wsid)) || [];
  }
  function setPageIds(ids, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    set(pagesKey(wsid), ids);
  }

  function getPage(id) { return get(pageKey(id)); }

  function savePage(page) {
    set(pageKey(page.id), page);
  }

  function deletePage(id, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    remove(pageKey(id));
    remove(P + 'versions_' + id);
    const ids = getPageIds(wsid).filter(i => i !== id);
    setPageIds(ids, wsid);
  }

  function createPage(title, folderId, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    const id   = uid();
    const page = { id, title: title || 'Untitled', content: '', folderId: folderId || null, updatedAt: Date.now() };
    savePage(page);
    const ids = getPageIds(wsid);
    ids.push(id);
    setPageIds(ids, wsid);
    return page;
  }

  /* ── folders ──────────────────────────────────────────── */

  function foldersKey(wsid) { return P + 'folders_' + wsid; }

  function getFolders(wsid) {
    wsid = wsid || getActiveWorkspaceId();
    return get(foldersKey(wsid)) || [];
  }
  function saveFolders(folders, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    set(foldersKey(wsid), folders);
  }
  function createFolder(name, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    const folders = getFolders(wsid);
    const folder  = { id: uid(), name: name || 'Folder', open: true };
    folders.push(folder);
    saveFolders(folders, wsid);
    return folder;
  }
  function deleteFolder(folderId, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    // Unassign pages in this folder
    const pageIds = getPageIds(wsid);
    pageIds.forEach(pid => {
      const p = getPage(pid);
      if (p && p.folderId === folderId) { p.folderId = null; savePage(p); }
    });
    const folders = getFolders(wsid).filter(f => f.id !== folderId);
    saveFolders(folders, wsid);
  }
  function renameFolder(folderId, name, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    const folders = getFolders(wsid);
    const f = folders.find(x => x.id === folderId);
    if (f) { f.name = name; saveFolders(folders, wsid); }
  }
  function toggleFolder(folderId, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    const folders = getFolders(wsid);
    const f = folders.find(x => x.id === folderId);
    if (f) { f.open = !f.open; saveFolders(folders, wsid); }
  }

  /* ── version history ──────────────────────────────────── */

  function versionsKey(pageId) { return P + 'versions_' + pageId; }

  function getVersions(pageId) {
    return get(versionsKey(pageId)) || [];
  }

  function pushVersion(pageId, content, title) {
    const versions = getVersions(pageId);
    versions.unshift({ ts: Date.now(), title, content });
    if (versions.length > MAX_VERS) versions.length = MAX_VERS;
    set(versionsKey(pageId), versions);
  }

  function restoreVersion(pageId, idx) {
    const versions = getVersions(pageId);
    const v = versions[idx];
    if (!v) return null;
    const page = getPage(pageId);
    if (!page) return null;
    // Save current as a version before restoring
    pushVersion(pageId, page.content, page.title);
    page.content   = v.content;
    page.updatedAt = Date.now();
    savePage(page);
    return page;
  }

  /* ── passcode ─────────────────────────────────────────── */

  const PASSCODE_KEY = P + 'passcode';

  async function hashPasscode(code) {
    const buf  = new TextEncoder().encode(code);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function setPasscode(code) {
    if (!code) { remove(PASSCODE_KEY); return; }
    const hash = await hashPasscode(code);
    set(PASSCODE_KEY, hash);
  }

  function hasPasscode() { return get(PASSCODE_KEY) !== null; }

  async function checkPasscode(code) {
    const stored = get(PASSCODE_KEY);
    if (!stored) return true; // no passcode set
    const hash = await hashPasscode(code);
    return hash === stored;
  }

  function removePasscode() { remove(PASSCODE_KEY); }

  /* ── bootstrap ────────────────────────────────────────── */

  function ensureDefaultPage(wsid) {
    wsid = wsid || getActiveWorkspaceId();
    let ids = getPageIds(wsid);
    if (ids.length === 0) {
      const page = {
        id:        uid(),
        title:     'Welcome to leaperStuff',
        content:   welcomeContent(),
        folderId:  null,
        updatedAt: Date.now(),
      };
      savePage(page);
      ids = [page.id];
      setPageIds(ids, wsid);
    }
    return ids;
  }

  /* ── export / import ──────────────────────────────────── */

  function exportAll() {
    const wsIds    = getWorkspaceIds();
    const workspaces = wsIds.map(id => getWorkspace(id)).filter(Boolean);
    const allPages = [];
    const allFolders = [];
    wsIds.forEach(wsid => {
      const pageIds = getPageIds(wsid);
      pageIds.forEach(pid => { const p = getPage(pid); if (p) allPages.push(p); });
      allFolders.push({ wsid, folders: getFolders(wsid) });
    });
    return {
      _v: 2,
      activeWs: getActiveWorkspaceId(),
      workspaceIds: wsIds,
      workspaces,
      allFolders,
      pages: allPages,
      pageIdsByWs: wsIds.reduce((acc, wsid) => { acc[wsid] = getPageIds(wsid); return acc; }, {}),
    };
  }

  function importAll(data) {
    if (!data || !data.pages) return false;
    if (data._v === 2) {
      (data.workspaceIds || []).forEach((id, i) => {
        const ws = (data.workspaces || [])[i];
        if (ws) saveWorkspace(ws);
      });
      setWorkspaceIds(data.workspaceIds || []);
      setActiveWorkspaceId(data.activeWs || (data.workspaceIds || [])[0]);
      Object.entries(data.pageIdsByWs || {}).forEach(([wsid, ids]) => setPageIds(ids, wsid));
      (data.allFolders || []).forEach(({ wsid, folders }) => saveFolders(folders, wsid));
    } else {
      // legacy v1 — single workspace
      ensureDefaultWorkspace();
      const wsid = getActiveWorkspaceId();
      setPageIds((data.pageIds || data.pages.map(p => p.id)), wsid);
    }
    data.pages.forEach(p => savePage(p));
    return true;
  }

  /* ── search ───────────────────────────────────────────── */

  function search(query, wsid) {
    wsid = wsid || getActiveWorkspaceId();
    if (!query || query.trim().length < 2) return [];
    const q   = query.toLowerCase();
    const ids = getPageIds(wsid);
    const results = [];
    for (const id of ids) {
      const page = getPage(id);
      if (!page) continue;
      const titleHit   = page.title.toLowerCase().includes(q);
      const contentHit = page.content.toLowerCase().includes(q);
      if (!titleHit && !contentHit) continue;
      // Extract snippet around first match
      let snippet = '';
      if (contentHit) {
        const idx = page.content.toLowerCase().indexOf(q);
        const start = Math.max(0, idx - 30);
        const end   = Math.min(page.content.length, idx + q.length + 60);
        snippet = page.content.slice(start, end).replace(/\n/g, ' ');
      }
      results.push({ id, title: page.title, snippet, query: q });
    }
    return results;
  }

  /* ── welcome content ──────────────────────────────────── */

  function welcomeContent() {
    return [
      'A fast, minimal, local-first notes app.',
      '',
      '## Getting started',
      '',
      '- Type freely — auto-saves every keystroke',
      '- Press `/` to open the slash command menu',
      '- Click a page name in the path bar for file options',
      '- Use the mode switcher at the bottom to change view',
      '',
      '## Slash commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/canvas` | Drawing canvas |',
      '| `/mermaid` | Mermaid diagram |',
      '| `/collabgun` | Live collaborative block (GUN) |',
      '| `/ai` | AI actions (Puter.js) |',
      '',
      '## Markdown',
      '',
      '**Bold**, _italic_, `code`, > blockquote, - lists, [links](url)',
      '',
      '```js',
      'const x = 42;',
      'console.log(x);',
      '```',
      '',
      '---',
      '',
      '*Fast writing first. Everything else is optional.*',
    ].join('\n');
  }

  /* ── public API ───────────────────────────────────────── */

  return {
    uid,
    // workspaces
    getWorkspaceIds, setWorkspaceIds, getWorkspace, saveWorkspace, deleteWorkspace,
    getActiveWorkspaceId, setActiveWorkspaceId,
    createWorkspace, renameWorkspace, ensureDefaultWorkspace,
    // pages
    getPageIds, setPageIds, getPage, savePage, deletePage, createPage, ensureDefaultPage,
    // folders
    getFolders, saveFolders, createFolder, deleteFolder, renameFolder, toggleFolder,
    // versions
    getVersions, pushVersion, restoreVersion,
    // passcode
    setPasscode, hasPasscode, checkPasscode, removePasscode,
    // search
    search,
    // export/import
    exportAll, importAll,
  };
})();
