/**
 * Leaper Extension: Canvas
 * Loaded on demand when /canvas is invoked.
 * Registers with the Extensions system.
 *
 * This is a lightweight pointer-based drawing canvas.
 * No external libraries. Minimal DOM impact.
 */

Extensions.register({
  id:           'canvas',
  slashCommand: 'canvas',
  label:        'Drawing Canvas',
  description:  'Insert a lightweight drawing canvas block',
  icon:         '✏️',

  create() {
    const wrapper = document.createElement('div');
    wrapper.className = 'block-wrapper';
    wrapper.dataset.blockType = 'canvas';

    wrapper.innerHTML = `
      <div class="block-toolbar">
        <span style="display:flex;align-items:center;gap:8px;">
          Drawing Canvas
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--txt-3);cursor:pointer;">
            Color
            <input type="color" id="canvas-color-${Date.now()}" value="#F5A623"
              style="width:22px;height:22px;border:none;background:none;cursor:pointer;padding:0;">
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--txt-3);">
            Size
            <input type="range" min="1" max="20" value="2"
              style="width:60px;" class="canvas-size-slider">
          </label>
        </span>
        <div class="block-toolbar-actions">
          <button class="block-toolbar-btn canvas-eraser-btn">Eraser</button>
          <button class="block-toolbar-btn" data-action="clear">Clear</button>
          <button class="block-toolbar-btn" data-action="download">Save PNG</button>
        </div>
      </div>
    `;

    const canvas   = document.createElement('canvas');
    canvas.className = 'canvas-block';
    canvas.width   = 1200;
    canvas.height  = 400;
    canvas.style.cssText = 'width:100%;height:260px;display:block;background:var(--bg);';
    wrapper.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#F5A623';

    let drawing  = false;
    let lastX = 0, lastY = 0;
    let erasing  = false;

    const colorInput  = wrapper.querySelector('input[type="color"]');
    const sizeSlider  = wrapper.querySelector('.canvas-size-slider');
    const eraserBtn   = wrapper.querySelector('.canvas-eraser-btn');

    colorInput.addEventListener('input', () => {
      erasing = false;
      eraserBtn.textContent = 'Eraser';
      ctx.strokeStyle = colorInput.value;
      ctx.globalCompositeOperation = 'source-over';
    });

    sizeSlider.addEventListener('input', () => {
      ctx.lineWidth = parseInt(sizeSlider.value, 10);
    });

    eraserBtn.addEventListener('click', () => {
      erasing = !erasing;
      eraserBtn.textContent = erasing ? 'Draw' : 'Eraser';
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    });

    function getPos(e) {
      const r      = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / r.width;
      const scaleY = canvas.height / r.height;
      const src    = e.touches ? e.touches[0] : e;
      return [
        (src.clientX - r.left) * scaleX,
        (src.clientY - r.top)  * scaleY,
      ];
    }

    canvas.addEventListener('pointerdown', e => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      [lastX, lastY] = getPos(e);
      // Draw a dot
      ctx.beginPath();
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = erasing ? 'rgba(0,0,0,1)' : ctx.strokeStyle;
      if (erasing) ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    });

    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      const [x, y] = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      [lastX, lastY] = [x, y];
    });

    canvas.addEventListener('pointerup',    () => { drawing = false; });
    canvas.addEventListener('pointercancel',() => { drawing = false; });

    wrapper.querySelector('[data-action="clear"]').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    wrapper.querySelector('[data-action="download"]').addEventListener('click', () => {
      // Compose with background for PNG
      const tmp = document.createElement('canvas');
      tmp.width  = canvas.width;
      tmp.height = canvas.height;
      const tc   = tmp.getContext('2d');
      tc.fillStyle = '#1A1814';
      tc.fillRect(0, 0, tmp.width, tmp.height);
      tc.drawImage(canvas, 0, 0);
      const a = document.createElement('a');
      a.download = 'leaper-canvas.png';
      a.href = tmp.toDataURL('image/png');
      a.click();
    });

    return wrapper;
  },
});
