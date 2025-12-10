const VIEW_ZOOM_BASE = 800;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

export function computeViewZoom(width: number): number {
  const zoom = width / VIEW_ZOOM_BASE;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
