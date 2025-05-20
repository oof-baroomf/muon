const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let pan = { x: 0, y: 0 };
let scale = 1;
const TITLE_H = 24;               // draggable bar height (world units)
const views = [];                 // metadata for hit-testing / drawing
const ipc = window.electronAPI;          // may be undefined if preload fails

// ---------- modal URL prompt ----------
const promptEl = document.getElementById('urlPrompt');
const inputEl  = document.getElementById('urlInput');
const okBtn    = document.getElementById('urlOk');
const cancelBtn= document.getElementById('urlCancel');
let spawnPos   = null;   // remembers where to place the page

function showPrompt(wx, wy) {
  spawnPos = { wx, wy };
  inputEl.value = 'https://';
  promptEl.style.display = 'flex';
  inputEl.focus();
}

function hidePrompt() { promptEl.style.display = 'none'; spawnPos = null; }

okBtn.addEventListener('click', () => {
  if (!spawnPos) return;
  const raw = inputEl.value.trim();
  if (!raw) { hidePrompt(); return; }
  const url = /^[a-zA-Z][\w.+-]*:\/\//.test(raw) ? raw : `https://${raw}`;
  ipc && ipc.spawnView({ ...spawnPos, url }).then(id => {
    views.push({ id, wx: spawnPos.wx, wy: spawnPos.wy, w: 1024, h: 768, url });
    draw();                              // show its title-bar immediately
  });
  hidePrompt();
});

cancelBtn.addEventListener('click', hidePrompt);
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') okBtn.click();
  else if (e.key === 'Escape') hidePrompt();
});
promptEl.addEventListener('click', e => { if (e.target === promptEl) hidePrompt(); });

const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; draw(); };
window.addEventListener('resize', resize); resize();

function draw () {
  ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);
  ctx.fillStyle = '#111'; ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
  ctx.strokeStyle = '#2d2d2d'; ctx.lineWidth = 1/scale;
  for (let i = -1e5; i < 1e5; i += 100) {
    ctx.beginPath(); ctx.moveTo(i, -1e5); ctx.lineTo(i, 1e5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1e5, i); ctx.lineTo(1e5, i); ctx.stroke();
  }

  // ───────── overlay view title-bars ─────────
  ctx.fillStyle = '#222';
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1 / scale;
  ctx.font = `${12 / scale}px sans-serif`;
  ctx.textBaseline = 'middle';

  for (const v of views) {
    ctx.fillRect(v.wx, v.wy, v.w, TITLE_H);
    ctx.strokeRect(v.wx, v.wy, v.w, TITLE_H);
    ctx.fillStyle = '#ddd';
    ctx.fillText(v.url, v.wx + 8 / scale, v.wy + TITLE_H / 2);
    ctx.fillStyle = '#222';
  }
}

let dragging   = false, last = {x:0,y:0};
let activeView = null, viewDragMode = null;   // 'move' | 'resize'

let zoomEndTimeout = null;
const ZOOM_END_DEBOUNCE_MS = 250; // Adjust as needed (milliseconds)

canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - pan.x) / scale;
  const wy = (e.clientY - rect.top  - pan.y) / scale;

  // try title-bars from topmost → back
  for (let i = views.length - 1; i >= 0; --i) {
    const v = views[i];
    if (wx >= v.wx && wx <= v.wx + v.w &&
        wy >= v.wy && wy <= v.wy + TITLE_H) {

      const nearRight = wx >= v.wx + v.w - (12 / scale);
      activeView   = v;
      viewDragMode = nearRight ? 'resize' : 'move';
      last.x = e.clientX; last.y = e.clientY;
      return;                           // handled
    }
  }

  // otherwise start panning the whole canvas
  dragging = true;
  last.x = e.clientX; last.y = e.clientY;
});
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  pan.x += e.clientX - last.x;
  pan.y += e.clientY - last.y;
  last.x = e.clientX;
  last.y = e.clientY;
  ipc && ipc.updateTransform(pan, scale);
  draw();
});
window.addEventListener('pointerup', () => {
  dragging = false;
  activeView = null;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  // very fine-grained: ≈ 0.1 % per deltaY pixel
  const factor = Math.pow(1.001, -e.deltaY);
  let nextScale = scale * factor;
  if (!Number.isFinite(nextScale)) return;       // ignore absurd deltas
  scale = Math.min(Math.max(nextScale, 0.15), 6);
  draw();
  // Send transform immediately for setBounds (view frame scaling)
  ipc && ipc.updateTransform(pan, scale);

  // Debounce sending the final scale for content zoom (setZoomFactor)
  clearTimeout(zoomEndTimeout);
  zoomEndTimeout = setTimeout(() => {
    ipc && ipc.updateViewsZoomFactor(scale);
  }, ZOOM_END_DEBOUNCE_MS);
}, { passive:false });

canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - pan.x) / scale;
  const wy = (e.clientY - rect.top  - pan.y) / scale;
  showPrompt(wx, wy);
});
