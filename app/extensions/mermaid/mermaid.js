/**
 * Leaper Extension: Mermaid Diagram
 * Loaded on demand when /mermaid is invoked.
 * Registers with the Extensions system.
 *
 * Uses mermaid.js (loaded from CDN, deferred in index.html).
 */

Extensions.register({
  id:           'mermaid',
  slashCommand: 'mermaid',
  label:        'Mermaid Diagram',
  description:  'Insert a Mermaid diagram block',
  icon:         '📊',

  create() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'mermaid';

    const defaultSrc = `graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]`;

    function escHtml(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span>Mermaid Diagram</span>
        <div class="block-toolbar-actions">
          <button class="block-toolbar-btn mermaid-toggle-btn">Edit</button>
        </div>
      </div>
      <div class="mermaid-render" style="padding:16px;min-height:80px;display:flex;align-items:center;justify-content:center;background:var(--bg-s);"></div>
      <textarea class="mermaid-src" spellcheck="false"
        style="display:none;width:100%;background:var(--bg);color:var(--txt-2);border:none;outline:none;resize:vertical;min-height:100px;padding:12px 14px;font-family:var(--mono,monospace);font-size:12px;line-height:1.5;"
      >${escHtml(defaultSrc)}</textarea>
    `;

    const renderEl  = wrapper.querySelector('.mermaid-render');
    const srcEl     = wrapper.querySelector('.mermaid-src');
    const toggleBtn = wrapper.querySelector('.mermaid-toggle-btn');
    let srcVisible  = false;

    function doRender() {
      const src = srcEl.value.trim();
      renderEl.innerHTML = '';
      if (!src) return;

      if (!window.mermaid) {
        renderEl.innerHTML = '<span style="font-size:12px;color:var(--txt-3);">Mermaid loading…</span>';
        const wait = setInterval(() => {
          if (window.mermaid) { clearInterval(wait); doRender(); }
        }, 300);
        return;
      }

      try {
        const id  = 'mm_' + Date.now();
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.id = id;
        div.textContent = src;
        renderEl.appendChild(div);

        if (typeof mermaid.run === 'function') {
          mermaid.run({ nodes: [div] }).catch(e => {
            renderEl.innerHTML = `<pre style="font-size:11px;color:#F44336;">${escHtml(String(e))}</pre>`;
          });
        } else {
          mermaid.init(undefined, div);
        }
      } catch (e) {
        renderEl.innerHTML = `<pre style="font-size:11px;color:#F44336;">${escHtml(String(e))}</pre>`;
      }
    }

    toggleBtn.addEventListener('click', () => {
      srcVisible = !srcVisible;
      srcEl.style.display    = srcVisible ? 'block' : 'none';
      renderEl.style.display = srcVisible ? 'none'  : 'flex';
      toggleBtn.textContent  = srcVisible ? 'Preview' : 'Edit';
      if (!srcVisible) doRender();
    });

    let renderTimer = null;
    srcEl.addEventListener('input', () => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(doRender, 700);
    });

    // Initialise mermaid once and render
    const tryInit = () => {
      if (window.mermaid) {
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            darkMode: true,
          });
        } catch {}
        doRender();
      }
    };

    if (window.mermaid) {
      tryInit();
    } else {
      window.addEventListener('load', tryInit, { once: true });
    }

    return wrapper;
  },
});
