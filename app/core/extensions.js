/**
 * Leaper Notes — Extension Loader
 *
 * Extensions live in /app/extensions/<name>/
 * Each extension registers itself via Extensions.register().
 *
 * An extension object:
 * {
 *   id:          string       — unique id (e.g. "canvas")
 *   slashCommand: string      — the slash command keyword (e.g. "canvas")
 *   label:       string       — display name in slash menu
 *   description: string       — short description
 *   icon:        string       — emoji or SVG string
 *   // Called when the slash command is triggered.
 *   // Must return a DOM element to insert as a block.
 *   create:      () => HTMLElement
 *   // Called after the block is inserted into the DOM.
 *   mount?:      (el: HTMLElement) => void
 * }
 */

const Extensions = (() => {
  const _registry = new Map();

  /** Register an extension. Called by each extension's own script. */
  function register(ext) {
    if (!ext.id || !ext.slashCommand || typeof ext.create !== 'function') {
      console.warn('[Extensions] Invalid extension — skipped:', ext);
      return;
    }
    _registry.set(ext.slashCommand.toLowerCase(), ext);
  }

  /** Return all registered extensions as an array. */
  function getAll() {
    return Array.from(_registry.values());
  }

  /** Get extension by slash command keyword. */
  function get(keyword) {
    return _registry.get(keyword.toLowerCase()) || null;
  }

  /**
   * Dynamically load an extension script on demand.
   * Returns a promise that resolves when the script is loaded.
   */
  function load(path) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${path}"]`)) {
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = path;
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /**
   * Ensure an extension is loaded before using it.
   * Extensions are loaded from /app/extensions/<id>/<id>.js
   */
  async function ensureLoaded(keyword) {
    if (_registry.has(keyword.toLowerCase())) return true;
    try {
      await load(`/app/extensions/${keyword}/${keyword}.js`);
      return _registry.has(keyword.toLowerCase());
    } catch {
      console.warn('[Extensions] Failed to load extension:', keyword);
      return false;
    }
  }

  return { register, getAll, get, load, ensureLoaded };
})();
