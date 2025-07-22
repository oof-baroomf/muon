export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

export function collides(rect: Rect, excludeId: string): boolean {
  const els = document.querySelectorAll<HTMLElement>('.muon-window');
  for (const el of Array.from(els)) {
    if (el.dataset.id === excludeId) continue;
    const r: Rect = {
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      w: parseFloat(el.style.width),
      h: parseFloat(el.style.height)
    };
    if (overlaps(rect, r)) return true;
  }
  return false;
}
