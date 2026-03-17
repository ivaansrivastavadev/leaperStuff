/**
 * Leaper Extension: AI (Puter.js)
 *
 * Runs in background only — NEVER blocks the editor.
 * Actions: summarize, expand, restructure selected text.
 *
 * Puter.js is loaded on demand the first time /ai is used.
 */

Extensions.register({
  id:           'ai',
  slashCommand: 'ai',
  label:        'AI Actions',
  description:  'Summarize, expand, or restructure with AI',
  icon:         '🤖',

  create() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'ai';

    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span>AI Actions</span>
        <div class="block-toolbar-actions">
          <button class="block-toolbar-btn ai-close-btn">&times; Remove</button>
        </div>
      </div>
      <div style="padding:16px;background:var(--bg-s);">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <button class="block-toolbar-btn ai-action-btn" data-action="summarize"
            style="padding:6px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;">
            Summarize page
          </button>
          <button class="block-toolbar-btn ai-action-btn" data-action="expand"
            style="padding:6px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;">
            Expand selection
          </button>
          <button class="block-toolbar-btn ai-action-btn" data-action="restructure"
            style="padding:6px 12px;font-size:12px;border:1px solid var(--border);border-radius:6px;">
            Restructure
          </button>
        </div>
        <div class="ai-output"
          style="font-size:13px;color:var(--txt-2);background:var(--bg);border-radius:6px;
                 padding:12px;min-height:60px;white-space:pre-wrap;line-height:1.6;
                 display:none;">
        </div>
        <p style="font-size:11px;color:var(--txt-3);margin-top:8px;">
          Powered by <a href="https://puter.com" target="_blank" rel="noopener"
            style="color:var(--accent);">Puter.js</a>.
          Your text is sent to the AI API.
        </p>
      </div>
    `;

    const outputEl = wrapper.querySelector('.ai-output');

    wrapper.querySelector('.ai-close-btn').addEventListener('click', () => {
      wrapper.closest('.editor-line')?.remove();
    });

    wrapper.querySelectorAll('.ai-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        await runAI(action, outputEl);
      });
    });

    return wrapper;
  },
});

/**
 * Run an AI action.
 * Loads puter.js on demand; never blocks UI.
 */
async function runAI(action, outputEl) {
  outputEl.style.display = 'block';
  outputEl.textContent   = 'Loading AI…';

  // Load Puter.js on demand
  if (!window.puter) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload  = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    }).catch(() => {
      outputEl.textContent = 'ERROR: Could not load Puter.js.';
      return;
    });
  }

  if (!window.puter) {
    outputEl.textContent = 'ERROR: Puter.js unavailable.';
    return;
  }

  // Get page content
  const pageTitle   = document.getElementById('page-title')?.value || '';
  const editorLines = [...document.querySelectorAll('.editor-line')]
    .map(el => el.textContent).join('\n');
  const fullText    = pageTitle + '\n\n' + editorLines;
  const selected    = window.getSelection()?.toString() || '';

  const prompts = {
    summarize:    `Summarize the following note in 3-5 bullet points:\n\n${fullText}`,
    expand:       `Expand on the following text with more detail and examples:\n\n${selected || fullText}`,
    restructure:  `Restructure the following note into a clean, well-organized format with headings:\n\n${fullText}`,
  };

  const prompt = prompts[action];
  if (!prompt) return;

  outputEl.textContent = 'Thinking…';

  try {
    const result = await puter.ai.chat(prompt, { model: 'gpt-4o-mini' });
    outputEl.textContent = result?.message?.content || result || '(No response)';
  } catch (e) {
    outputEl.textContent = 'ERROR: ' + (e.message || String(e));
  }
}
