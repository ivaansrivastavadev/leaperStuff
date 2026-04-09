/* Ultra Custom Visualizer (single-file) */

/* ====== Helpers & DOM refs ====== */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });
const sidebar = document.getElementById('sidebar');
const hamb = document.getElementById('hamb');
const openControls = document.getElementById('openControls');
const closeSidebar = document.getElementById('closeSidebar');
const audioEl = document.getElementById('audio');
const fileInput = document.getElementById('file-input');
const btnMic = document.getElementById('btn-mic');
const btnTab = document.getElementById('btn-tab');
const btnStop = document.getElementById('btn-stop');

const gainSlider = document.getElementById('gain');
const gainNum = document.getElementById('gainNum');

const fftSelect = document.getElementById('fft');
const barsSlider = document.getElementById('bars'), barsNum = document.getElementById('barsNum');
const smooth = document.getElementById('smooth'), smoothNum = document.getElementById('smoothNum');

const orient = document.getElementById('orient');
const spacing = document.getElementById('spacing'), spacingNum = document.getElementById('spacingNum');
const cap = document.getElementById('cap'), capNum = document.getElementById('capNum');
const radius = document.getElementById('radius'), radiusNum = document.getElementById('radiusNum');
const bgColor = document.getElementById('bgColor');
const g1 = document.getElementById('g1'), g2 = document.getElementById('g2');
const bgOpacity = document.getElementById('bgOpacity'), bgOpacityNum = document.getElementById('bgOpacityNum');
const scale = document.getElementById('scale'), scaleNum = document.getElementById('scaleNum');

const preset1 = document.getElementById('preset1'), preset2 = document.getElementById('preset2'), preset3 = document.getElementById('preset3');

/* ====== Audio setup ====== */
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let gainNode = null;
let dataArray = null;
let animationId = null;
let freqLen = 512;
let streamRef = null;

function ensureAudioCtx(){
  if(!audioCtx){
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = parseFloat(gainSlider.value);
    analyser.smoothingTimeConstant = parseFloat(smooth.value);
    analyser.fftSize = parseInt(fftSelect.value);
    // audio graph: source -> analyser -> gain -> destination
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }
}

/* Hook file input */
fileInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  stopStream();
  const url = URL.createObjectURL(f);
  audioEl.src = url;
  audioEl.crossOrigin = "anonymous";
  await audioEl.play().catch(()=>{ /* user may need interaction */ });
  connectAudioElement(audioEl);
});

/* Connect HTML audio element to audio graph */
function connectAudioElement(el){
  ensureAudioCtx();
  disconnectSource();
  try{
    sourceNode = audioCtx.createMediaElementSource(el);
    sourceNode.connect(analyser);
    startRender();
  }catch(e){
    console.warn('connectAudioElement error', e);
  }
}

/* Microphone */
btnMic.addEventListener('click', async ()=>{
  try{
    stopStream();
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video:false });
    streamRef = s;
    connectStream(s);
  }catch(err){
    alert('Microphone access denied or unavailable: ' + (err.message||err));
  }
});

/* Tab/System capture */
btnTab.addEventListener('click', async ()=>{
  try{
    stopStream();
    const s = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false }).catch(async ()=>{
      return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    });
    if(!s) throw new Error('No stream');
    streamRef = s;
    connectStream(s);
  }catch(err){
    alert('Tab/System audio capture failed: ' + (err.message||err));
  }
});

/* Stop */
btnStop.addEventListener('click', ()=>stopStream());

function stopStream(){
  if(animationId) cancelAnimationFrame(animationId);
  disconnectSource();
  if(streamRef){
    streamRef.getTracks().forEach(t=>t.stop());
    streamRef = null;
  }
  audioEl.pause(); audioEl.src = "";
  clearCanvas();
}

/* Connect generic MediaStream */
function connectStream(stream){
  ensureAudioCtx();
  disconnectSource();
  sourceNode = audioCtx.createMediaStreamSource(stream);
  sourceNode.connect(analyser);
  startRender();
}

/* Disconnect previous source if any */
function disconnectSource(){
  try{ if(sourceNode && sourceNode.disconnect) sourceNode.disconnect(); }catch(e){}
  sourceNode = null;
}

/* Gain control */
gainSlider.addEventListener('input', ()=>{
  gainNum.value = gainSlider.value;
  if(gainNode) gainNode.gain.value = parseFloat(gainSlider.value);
});
gainNum.addEventListener('change', ()=>{
  gainSlider.value = gainNum.value;
  if(gainNode) gainNode.gain.value = parseFloat(gainNum.value);
});

/* Synchronize range/number helpers */
function syncRangeWithNum(range, num){
  range.addEventListener('input', ()=>{ num.value = range.value; });
  num.addEventListener('change', ()=>{ range.value = num.value; range.dispatchEvent(new Event('input')); });
}
syncRangeWithNum(barsSlider, barsNum);
syncRangeWithNum(smooth, smoothNum);
syncRangeWithNum(spacing, spacingNum);
syncRangeWithNum(cap, capNum);
syncRangeWithNum(radius, radiusNum);
syncRangeWithNum(bgOpacity, bgOpacityNum);
syncRangeWithNum(scale, scaleNum);

/* FFT change */
fftSelect.addEventListener('change', ()=>{
  if(!analyser) return;
  analyser.fftSize = parseInt(fftSelect.value);
  setupDataArray();
});

/* Bars change -> update data array */
barsSlider.addEventListener('input', setupDataArray);
barsNum.addEventListener('change', ()=>{
  barsSlider.value = barsNum.value;
  setupDataArray();
});

/* Smoothing change */
smooth.addEventListener('input', ()=>{ if(analyser) analyser.smoothingTimeConstant = parseFloat(smooth.value); });

function setupDataArray(){
  if(!analyser) return;
  const count = parseInt(barsSlider.value);
  const bufferLength = analyser.frequencyBinCount;
  freqLen = bufferLength;
  dataArray = new Uint8Array(bufferLength);
}

/* ====== Canvas resizing & drawing ====== */
function resize(){
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

/* Clear */
function clearCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.globalAlpha = parseFloat(bgOpacity.value || 1);
  ctx.fillStyle = bgColor.value || '#0b0b12';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();
}

/* Rendering loop */
function startRender(){
  if(!analyser) return;
  setupDataArray();
  if(animationId) cancelAnimationFrame(animationId);

  const draw = ()=>{
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    const barCount = parseInt(barsSlider.value);
    const spacingVal = parseFloat(spacing.value);
    const capH = parseFloat(cap.value);
    const radiusVal = parseFloat(radius.value);
    const orientation = orient.value;
    const sc = parseFloat(scale.value);
    const gstart = g1.value, gend = g2.value;
    const bgOp = parseFloat(bgOpacity.value);

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.globalAlpha = bgOp;
    ctx.fillStyle = bgColor.value;
    const W = canvas.width / (window.devicePixelRatio || 1);
    const H = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();

    // map freq bins to bar index (log mapping)
    function getBarValue(i){
      const fbinCount = dataArray.length;
      const fracStart = i / barCount;
      const fracEnd = (i+1) / barCount;
      const binStart = Math.floor(Math.pow(2, fracStart * Math.log2(Math.max(2, fbinCount))));
      const binEnd = Math.floor(Math.pow(2, fracEnd * Math.log2(Math.max(2, fbinCount))));
      let sum = 0, cnt = 0;
      for(let b = Math.max(0, binStart); b < Math.min(fbinCount, Math.max(binStart, binEnd+1)); b++){
        sum += dataArray[b];
        cnt++;
      }
      return cnt ? (sum / cnt) : 0;
    }

    if(orientation === 'vertical'){
      const totalSpacing = spacingVal * (barCount - 1);
      const barW = Math.max(1, (W - totalSpacing) / barCount);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, gstart);
      grad.addColorStop(1, gend);
      ctx.fillStyle = grad;

      for(let i=0;i<barCount;i++){
        const v = getBarValue(i) / 255 * sc;
        const h = Math.max(0, Math.min(H, v * H));
        const x = i * (barW + spacingVal);
        const y = H - h;
        roundRect(ctx, x, y, barW, h, radiusVal);
        ctx.fill();
        if(capH>0){
          ctx.fillRect(x, Math.max(0, y - capH), barW, capH);
        }
      }
    } else if(orientation === 'horizontal'){
      const totalSpacing = spacingVal * (barCount - 1);
      const barH = Math.max(1, (H - totalSpacing) / barCount);
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, gstart);
      grad.addColorStop(1, gend);
      ctx.fillStyle = grad;

      for(let i=0;i<barCount;i++){
        const v = getBarValue(i) / 255 * sc;
        const w = Math.max(0, Math.min(W, v * W));
        const y = i * (barH + spacingVal);
        roundRect(ctx, 0, y, w, barH, radiusVal);
        ctx.fill();
        if(capH>0){
          ctx.fillRect(Math.max(0, w - capH), y, capH, barH);
        }
      }
    } else if(orientation === 'radial'){
      const cx = W/2, cy = H/2;
      const radiusBase = Math.min(W,H) * 0.12;
      const maxLen = Math.min(W,H) * 0.38;
      const grad = ctx.createLinearGradient(0,0,W,H);
      grad.addColorStop(0, gstart);
      grad.addColorStop(1, gend);
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      for(let i=0;i<barCount;i++){
        const angle = (i / barCount) * Math.PI * 2;
        const v = getBarValue(i) / 255 * sc;
        const len = radiusBase + v * maxLen;
        const x1 = cx + Math.cos(angle) * radiusBase;
        const y1 = cy + Math.sin(angle) * radiusBase;
        const x2 = cx + Math.cos(angle) * len;
        const y2 = cy + Math.sin(angle) * len;
        ctx.lineWidth = Math.max(2, (W+H)/400);
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
      }
    }
  };

  draw();
}

/* Rounded rect helper */
function roundRect(ctx,x,y,w,h,r){
  const radius = Math.min(r, Math.min(w,h)/2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/* UI toggles */
hamb.addEventListener('click', ()=> sidebar.classList.toggle('hidden'));
openControls.addEventListener('click', ()=> sidebar.classList.toggle('hidden'));
closeSidebar.addEventListener('click', ()=> sidebar.classList.add('hidden'));
window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') sidebar.classList.add('hidden'); });

/* Presets */
preset1.addEventListener('click', ()=>{
  g1.value = '#ff3366'; g2.value = '#ffd166';
  spacing.value = 1; spacing.dispatchEvent(new Event('input'));
  barsSlider.value = 96; barsSlider.dispatchEvent(new Event('input'));
  smooth.value = 0.6; smooth.dispatchEvent(new Event('input'));
  cap.value = 6; cap.dispatchEvent(new Event('input'));
  orient.value = 'vertical';
});
preset2.addEventListener('click', ()=>{
  g1.value = '#6de7ff'; g2.value = '#9dffca';
  spacing.value = 4; spacing.dispatchEvent(new Event('input'));
  barsSlider.value = 48; barsSlider.dispatchEvent(new Event('input'));
  smooth.value = 0.92; smooth.dispatchEvent(new Event('input'));
  cap.value = 2; cap.dispatchEvent(new Event('input'));
  orient.value = 'vertical';
});
preset3.addEventListener('click', ()=>{
  g1.value = '#b28cff'; g2.value = '#ff9a9e';
  orient.value = 'radial';
  barsSlider.value = 128; barsSlider.dispatchEvent(new Event('input'));
  smooth.value = 0.5; smooth.dispatchEvent(new Event('input'));
});

/* initialize UI numbers */
[barsSlider, smooth, spacing, cap, radius, bgOpacity, scale].forEach(r => r.dispatchEvent(new Event('input')));

/* Start audio context on user gesture for autoplay restrictions */
window.addEventListener('click', async function initOnce(){
  if(!audioCtx){
    try{
      ensureAudioCtx();
      if(audioCtx.state === 'suspended') await audioCtx.resume();
    }catch(e){}
  }
  window.removeEventListener('click', initOnce);
});

/* handle audio element playing via file UI */
audioEl.addEventListener('play', ()=>{ if(audioEl.src) connectAudioElement(audioEl); });

/* Ensure analyzer config updated when gain exists */
gainSlider.addEventListener('input', ()=>{ if(gainNode) gainNode.gain.value = parseFloat(gainSlider.value); });

/* Quick safety: fill canvas initially */
clearCanvas();