const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let pan = { x: 0, y: 0 };
let scale = 1;
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
  ipc && ipc.spawnView({ ...spawnPos, url });
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
}

let dragging = false, last = {x:0,y:0};

// ---------- smooth outbound transform ----------
let rafToken = null;
function scheduleTransformSend() {
  if (rafToken) return;              // already scheduled this frame
  rafToken = requestAnimationFrame(() => {
    rafToken = null;
    ipc && ipc.updateTransform(pan, scale);
  });
}
canvas.addEventListener('pointerdown', e => { dragging = true; last.x = e.clientX; last.y = e.clientY; });
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  pan.x += e.clientX - last.x; pan.y += e.clientY - last.y;
  last.x = e.clientX; last.y = e.clientY;
  scheduleTransformSend();
  draw();
});
window.addEventListener('pointerup', () => dragging = false);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const base   = 1.025;                             // 2.5 %
  const factor = e.deltaY < 0 ? base : 1 / base;    // trackpad gives many small events
  scale = Math.min(Math.max(scale * factor, 0.25), 6);
  draw();
  scheduleTransformSend();                          // always queue IPC
}, { passive:false });

canvas.addEventListener('dblclick', e => {
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - pan.x) / scale;
  const wy = (e.clientY - rect.top  - pan.y) / scale;
  showPrompt(wx, wy);
});
