export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
