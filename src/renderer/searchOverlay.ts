import { WindowData } from './windowManager';
import { zoomAndCenterWindow, TransformState } from './desktopTransform';

interface Deps {
  root: HTMLElement;
  getWindows: () => WindowData[];
  windowElements: Map<string, HTMLElement>;
  setActiveWindow: (el: HTMLElement) => void;
  transform: TransformState;
  applyTransform: () => void;
}

let deps: Deps;
let overlay: HTMLElement | null = null;
let inputEl: HTMLInputElement | null = null;
let listEl: HTMLElement | null = null;
let results: { win: WindowData; element: HTMLElement }[] = [];
let index = -1;

export function initSearchOverlay(d: Deps) {
  deps = d;
}

function fuzzyMatch(text: string, query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  text = text.toLowerCase();
  return tokens.every(t => text.includes(t));
}

export function showSearch() {
  if (overlay) return;
  window.electronAPI.send('views:set-visible', false);
  overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 bg-black/60 flex items-start justify-center pt-24';
  overlay.style.zIndex = '50';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideSearch();
  });

  const box = document.createElement('div');
  box.className = 'bg-zinc-800 border border-zinc-600 rounded-lg w-96 overflow-hidden';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search windows...';
  input.className = 'w-full bg-transparent px-3 py-2 border-b border-zinc-600 outline-none text-zinc-200';

  const list = document.createElement('div');
  list.className = 'max-h-72 overflow-y-auto';

  box.appendChild(input);
  box.appendChild(list);
  overlay.appendChild(box);
  deps.root.appendChild(overlay);

  inputEl = input;
  listEl = list;
  index = -1;
  updateResults();

  setTimeout(() => input.focus(), 0);
  input.addEventListener('input', () => { index = 0; updateResults(); });
}

export function hideSearch() {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  window.electronAPI.send('views:set-visible', true);
  inputEl = null;
  listEl = null;
  results = [];
  index = -1;
}

export function isSearchVisible() {
  return !!overlay;
}

function updateResults() {
  if (!listEl || !inputEl) return;
  const query = inputEl.value;
  results = deps.getWindows()
    .map(w => ({ win: w, element: deps.windowElements.get(w.id) as HTMLElement }))
    .filter(r => r.element && fuzzyMatch(r.win.title || r.win.url, query));

  listEl.innerHTML = '';
  results.forEach((r, idx) => {
    const item = document.createElement('div');
    item.textContent = r.win.title || r.win.url;
    item.className = 'px-3 py-2 text-sm cursor-pointer hover:bg-zinc-700';
    item.addEventListener('mouseenter', () => { index = idx; refreshHighlight(); });
    item.addEventListener('click', () => selectResult(idx));
    listEl!.appendChild(item);
  });
  refreshHighlight();
}

function refreshHighlight() {
  if (!listEl) return;
  Array.from(listEl.children).forEach((el, i) => {
    (el as HTMLElement).style.background = i === index ? '#333' : 'transparent';
  });
}

function selectResult(i: number) {
  const res = results[i];
  if (!res) return;
  deps.setActiveWindow(res.element);
  hideSearch();
  zoomAndCenterWindow(res.element, deps.root, deps.transform, deps.applyTransform);
}
