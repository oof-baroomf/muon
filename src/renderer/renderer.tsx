import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { WindowData, addResizeHandle, addAddressBarDrag } from './windowManager';
import { DesktopState, loadState, saveState } from './state';

interface ZoomState {
  zoomed: boolean;
  origScale: number;
  origX: number;
  origY: number;
}

const zoomStateMap = new WeakMap<HTMLElement, ZoomState>();

interface Transform { scale: number; x: number; y: number }

const ZoomContext = React.createContext({
  scale: 1,
  x: 0,
  y: 0,
  setTransform: (_t: Transform) => {}
});

function zoomAndCenterWindow(el: HTMLElement, transform: Transform, setTransform: (t: Transform) => void) {
  let state = zoomStateMap.get(el);
  if (!state) {
    state = { zoomed: false, origScale: transform.scale, origX: transform.x, origY: transform.y };
    zoomStateMap.set(el, state);
  }
  if (state.zoomed) {
    const start = { ...transform };
    const target = { scale: state.origScale, x: state.origX, y: state.origY };
    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / 300);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setTransform({
        scale: start.scale + (target.scale - start.scale) * ease,
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease
      });
      if (t < 1) requestAnimationFrame(animate); else setTransform(target);
    };
    requestAnimationFrame(animate);
    state.zoomed = false;
    return;
  }
  state.origScale = transform.scale;
  state.origX = transform.x;
  state.origY = transform.y;
  const margin = 32;
  const winW = el.offsetWidth;
  const winH = el.offsetHeight;
  const winX = parseFloat(el.style.left);
  const winY = parseFloat(el.style.top);
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  const scaleX = (viewportW - 2 * margin) / winW;
  const scaleY = (viewportH - 2 * margin) / winH;
  const targetScale = Math.min(scaleX, scaleY, 4);
  const winCenterX = winX + winW / 2;
  const winCenterY = winY + winH / 2;
  const viewportCenterX = viewportW / 2;
  const viewportCenterY = viewportH / 2;
  const targetX = viewportCenterX - winCenterX * targetScale;
  const targetY = viewportCenterY - winCenterY * targetScale;
  const start = { ...transform };
  const target = { scale: targetScale, x: targetX, y: targetY };
  const startTime = performance.now();
  const animate = (now: number) => {
    const t = Math.min(1, (now - startTime) / 300);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    setTransform({
      scale: start.scale + (target.scale - start.scale) * ease,
      x: start.x + (target.x - start.x) * ease,
      y: start.y + (target.y - start.y) * ease
    });
    if (t < 1) requestAnimationFrame(animate); else setTransform(target);
  };
  requestAnimationFrame(animate);
  state.zoomed = true;
}

const Window: React.FC<{
  data: WindowData;
  onUpdate: (w: WindowData) => void;
  onClose: (id: string) => void;
  onActivate: (id: string, el: HTMLElement) => void;
}> = ({ data, onUpdate, onClose, onActivate }) => {
  const contRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const transformCtx = React.useContext(ZoomContext);
  const { scale } = transformCtx;

  useEffect(() => {
    const cont = contRef.current!;
    const urlBar = urlRef.current!;
    const updateBounds = () => {
      const rect = cont.querySelector('.muon-view-container')!.getBoundingClientRect();
      window.electronAPI.send('view:set-bounds', data.id, {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    };

    addResizeHandle(cont, data, scale, [], () => onUpdate(data), updateBounds);
    addAddressBarDrag(urlBar, cont, data, scale, [], () => onUpdate(data), updateBounds);

    window.electronAPI.send('view:create', data.id, data.url || 'https://www.google.com/search');
    new ResizeObserver(updateBounds).observe(cont);
    new ResizeObserver(() => {
      const newZoom = scale * (cont.offsetWidth / 800);
      window.electronAPI.send('view:set-zoom-factor', data.id, newZoom);
    }).observe(cont);

    const nav = (ev: string) => window.electronAPI.send(ev, data.id);
    const handlers = [
      window.electronAPI.receive(`view:did-navigate:${data.id}`, (url: string) => { onUpdate({ ...data, url }); urlBar.value = url; }),
      window.electronAPI.receive(`view:did-navigate-in-page:${data.id}`, (url: string) => { onUpdate({ ...data, url }); urlBar.value = url; }),
      window.electronAPI.receive(`view:page-title-updated:${data.id}`, (title: string) => onUpdate({ ...data, title }))
    ];

    return () => { handlers.forEach(h => h()); window.electronAPI.send('view:destroy', data.id); };
  }, []);

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      let val = urlRef.current!.value.trim();
      if (!/^(https?:|file:)/i.test(val)) {
        val = /^[\w-]+\.[\w-]+/.test(val) ? 'https://' + val : 'https://www.google.com/search?q=' + encodeURIComponent(val);
      }
      onUpdate({ ...data, url: val });
      window.electronAPI.send('view:load-url', data.id, val);
    }
  };

  return (
    <div
      ref={contRef}
      className="muon-window absolute border rounded overflow-hidden shadow-lg"
      style={{ left: data.x, top: data.y, width: data.w, height: data.h }}
      data-id={data.id}
      onDoubleClick={() => zoomAndCenterWindow(contRef.current!, transformCtx, transformCtx.setTransform)}
      onMouseDown={() => onActivate(data.id, contRef.current!)}
    >
      <div className="muon-topbar-container">
        <div className="muon-nav-controls">
          <button className="muon-nav-btn" onClick={() => window.electronAPI.send('view:back', data.id)}>←</button>
          <button className="muon-nav-btn" onClick={() => window.electronAPI.send('view:forward', data.id)}>→</button>
          <button className="muon-nav-btn" onClick={() => window.electronAPI.send('view:reload', data.id)}>⟳</button>
          <button className="muon-nav-btn" onClick={() => window.electronAPI.send('view:stop', data.id)}>⨉</button>
        </div>
        <div className="muon-drag-area" />
        <button className="muon-remove" onClick={() => onClose(data.id)}>×</button>
      </div>
      <div className="muon-urlbar-container"><input ref={urlRef} className="muon-urlbar px-2 py-1 text-xs outline-none" defaultValue={data.url} onKeyDown={onEnter}/></div>
      <div className="muon-view-container absolute left-0" style={{ top: 48, width: '100%', height: `calc(100% - 48px)` }} />
    </div>
  );
};

const SearchOverlay: React.FC<{
  windows: WindowData[];
  active: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}> = ({ windows, active, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const list = windows.filter(w => (w.title || w.url).toLowerCase().includes(query.toLowerCase()));
  if (!active) return null;
  return (
    <div className="absolute inset-0 bg-black/60 flex items-start justify-center pt-24" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 50 }}>
      <div className="bg-zinc-800 border border-zinc-600 rounded-lg w-96 overflow-hidden">
        <input autoFocus className="w-full bg-transparent px-3 py-2 border-b border-zinc-600 outline-none text-zinc-200" placeholder="Search windows..." value={query} onChange={e => setQuery(e.target.value)} />
        <div className="max-h-72 overflow-y-auto">
          {list.map(w => (
            <div key={w.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-zinc-700" onClick={() => onSelect(w.id)}>{w.title || w.url}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [windows, setWindows] = useState<WindowData[]>([]);
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [search, setSearch] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const deskRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadState().then(s => { setWindows(s.windows); setTransform(s.transform); }); }, []);
  useEffect(() => { saveState(windows, transform); }, [windows, transform]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(s => !s); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveState(windows, transform); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && activeId) {
        const el = document.querySelector(`[data-id="${activeId}"]`) as HTMLElement;
        if (el) zoomAndCenterWindow(el, transform, setTransform);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [windows, transform, activeId]);

  const wheel = (e: WheelEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLElement).matches(':focus')) return;
    e.preventDefault();
    if (e.metaKey || e.ctrlKey) {
      const mx = e.clientX - deskRef.current!.getBoundingClientRect().left;
      const my = e.clientY - deskRef.current!.getBoundingClientRect().top;
      const wx = (mx - transform.x) / transform.scale;
      const wy = (my - transform.y) / transform.scale;
      const newScale = Math.min(Math.max(0.25, transform.scale * (1 - e.deltaY * 0.001)), 4);
      setTransform({
        scale: newScale,
        x: mx - wx * newScale,
        y: my - wy * newScale
      });
    } else {
      setTransform(t => ({ ...t, x: t.x - e.deltaX / t.scale, y: t.y - e.deltaY / t.scale }));
    }
  };

  useEffect(() => {
    const desk = deskRef.current!;
    desk.addEventListener('wheel', wheel, { passive: false });
    return () => desk.removeEventListener('wheel', wheel);
  }, [transform]);

  const addWindow = (w: WindowData) => setWindows(ws => [...ws, w]);
  const updateWindow = (w: WindowData) => setWindows(ws => ws.map(x => x.id === w.id ? w : x));
  const removeWindow = (id: string) => setWindows(ws => ws.filter(w => w.id !== id));
  const activateWindow = (id: string, el: HTMLElement) => { setActiveId(id); el.style.zIndex = '10'; windows.filter(w => w.id !== id).forEach(other => {
    const el2 = document.querySelector(`[data-id="${other.id}"]`) as HTMLElement; if (el2) el2.style.zIndex = '1'; }); };

  const onNewWindow = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.muon-urlbar') || (e.target as HTMLElement).closest('.muon-resize-handle')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const ghost = document.createElement('div');
    ghost.className = 'absolute border border-gray-500 bg-gray-500/10';
    deskRef.current!.appendChild(ghost);
    const move = (ev: MouseEvent) => {
      const gx = Math.min(startX, ev.clientX);
      const gy = Math.min(startY, ev.clientY);
      const gw = Math.abs(ev.clientX - startX);
      const gh = Math.abs(ev.clientY - startY);
      ghost.style.left = ((gx - deskRef.current!.getBoundingClientRect().left - transform.x) / transform.scale) + 'px';
      ghost.style.top = ((gy - deskRef.current!.getBoundingClientRect().top - transform.y) / transform.scale) + 'px';
      ghost.style.width = gw / transform.scale + 'px';
      ghost.style.height = gh / transform.scale + 'px';
    };
    const up = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      move(ev);
      const gw = parseFloat(ghost.style.width);
      const gh = parseFloat(ghost.style.height);
      if (gw > 32 && gh > 32) {
        const w = { id: crypto.randomUUID(), x: parseFloat(ghost.style.left), y: parseFloat(ghost.style.top), w: gw, h: gh, url: 'https://www.google.com/search' } as WindowData;
        addWindow(w); setActiveId(w.id);
      }
      ghost.remove();
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const transformStyle = { transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})` };

  return (
    <ZoomContext.Provider value={{ ...transform, setTransform }}>
      <div ref={deskRef} id="muon-desktop" className="absolute inset-0 origin-top-left will-change-transform" style={transformStyle} onDoubleClick={() => setSearch(false)} onMouseDown={onNewWindow}>
        {windows.map(w => (
          <Window key={w.id} data={w} onUpdate={updateWindow} onClose={removeWindow} onActivate={activateWindow} />
        ))}
        <SearchOverlay windows={windows} active={search} onSelect={id => { const el = document.querySelector(`[data-id="${id}"]`) as HTMLElement; if (el) { activateWindow(id, el); zoomAndCenterWindow(el, transform, setTransform); } setSearch(false); }} onClose={() => setSearch(false)} />
      </div>
    </ZoomContext.Provider>
  );
};

createRoot(document.getElementById('root')!).render(<App />);

