const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let pan = { x: 0, y: 0 };
let scale = 1;
const ipc = window.electronAPI;          // may be undefined if preload fails

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
canvas.addEventListener('pointerdown', e => { dragging = true; last.x = e.clientX; last.y = e.clientY; });
window.addEventListener('pointermove', e => {
  if (!dragging) return;
  pan.x += e.clientX - last.x; pan.y += e.clientY - last.y;
  last.x = e.clientX; last.y = e.clientY;
  ipc && ipc.updateTransform(pan, scale);
  draw();
});
window.addEventListener('pointerup', () => dragging = false);

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  scale *= factor;
  window.electronAPI.updateTransform(pan, scale);
  draw();
}, { passive:false });

canvas.addEventListener('dblclick', e => {
  const input = prompt('URL to open?', 'https://example.com');
  if (!input) return;
  // prepend "https://" if the user forgot the scheme
  const url = /^[a-zA-Z][\w+.-]*:\/\//.test(input.trim())
              ? input.trim()
              : `https://${input.trim()}`;
  const rect = canvas.getBoundingClientRect();
  const wx = (e.clientX - rect.left - pan.x) / scale;
  const wy = (e.clientY - rect.top - pan.y) / scale;
  ipc && ipc.spawnView({ wx, wy, url });
});
