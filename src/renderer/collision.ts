export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Basic range overlap check used for axis clamping
export function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && a2 > b1;
}

// Check if two rectangles overlap
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Test a rect against all windows except optional ignoreId
import { WindowData } from './windowManager';
export function collides(rect: Rect, windows: WindowData[], ignoreId?: string): boolean {
  for (const w of windows) {
    if (w.id === ignoreId) continue;
    if (rectsOverlap(rect, w)) return true;
  }
  return false;
}

// Clamp a moving rectangle so it cannot overlap existing windows
export function clampMove(rect: Rect, prev: Rect, windows: WindowData[], ignoreId?: string): Rect {
  let { x, y } = rect;
  for (const w of windows) {
    if (w.id === ignoreId) continue;
    if (rectsOverlap({ x, y, w: rect.w, h: rect.h }, w)) {
      if (prev.x + prev.w <= w.x) x = Math.min(x, w.x - rect.w);
      else if (prev.x >= w.x + w.w) x = Math.max(x, w.x + w.w);
      if (prev.y + prev.h <= w.y) y = Math.min(y, w.y - rect.h);
      else if (prev.y >= w.y + w.h) y = Math.max(y, w.y + w.h);
    }
  }
  return { ...rect, x, y };
}

// Clamp a resized rectangle similarly
export function clampResize(rect: Rect, prev: Rect, windows: WindowData[], ignoreId?: string): Rect {
  let { x, y, w: width, h: height } = rect;
  for (const win of windows) {
    if (win.id === ignoreId) continue;
    if (rectsOverlap({ x, y, w: width, h: height }, win)) {
      if (prev.x + prev.w <= win.x && x + width > win.x) {
        width = win.x - x;
      } else if (prev.x >= win.x + win.w && x < win.x + win.w) {
        const newX = win.x + win.w;
        width -= newX - x;
        x = newX;
      }
      if (prev.y + prev.h <= win.y && y + height > win.y) {
        height = win.y - y;
      } else if (prev.y >= win.y + win.h && y < win.y + win.h) {
        const newY = win.y + win.h;
        height -= newY - y;
        y = newY;
      }
    }
  }
  return { x, y, w: width, h: height };
}

// Clamp a creation drag rectangle so it never crosses other windows
export function clampDrag(sx: number, sy: number, cx: number, cy: number, windows: WindowData[]): Rect {
  let x1 = Math.min(sx, cx);
  let x2 = Math.max(sx, cx);
  let y1 = Math.min(sy, cy);
  let y2 = Math.max(sy, cy);

  for (const w of windows) {
    if (rangesOverlap(y1, y2, w.y, w.y + w.h)) {
      if (cx >= sx && x2 > w.x && sx < w.x) x2 = Math.min(x2, w.x);
      else if (cx <= sx && x1 < w.x + w.w && sx > w.x + w.w) x1 = Math.max(x1, w.x + w.w);
    }
    if (rangesOverlap(x1, x2, w.x, w.x + w.w)) {
      if (cy >= sy && y2 > w.y && sy < w.y) y2 = Math.min(y2, w.y);
      else if (cy <= sy && y1 < w.y + w.h && sy > w.y + w.h) y1 = Math.max(y1, w.y + w.h);
    }
  }

  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}
