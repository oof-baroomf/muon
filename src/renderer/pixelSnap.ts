export function snapToScale(value: number, scale: number): number {
  const safeScale = Math.max(scale, 0.0001);
  const step = 1 / safeScale;
  return Math.round(value / step) * step;
}

export interface SnapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function snapRect(rect: SnapRect, scale: number): SnapRect {
  const x = snapToScale(rect.x, scale);
  const y = snapToScale(rect.y, scale);
  const w = snapToScale(rect.w, scale);
  const h = snapToScale(rect.h, scale);
  return { x, y, w, h };
}

export function snapRectToGrid(rect: SnapRect, grid: number): SnapRect {
  const gridSize = grid > 0 ? grid : 0;
  if (!gridSize) return rect;
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;
  return { ...rect, x: snap(rect.x), y: snap(rect.y) };
}
