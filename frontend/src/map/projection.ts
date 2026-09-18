/**
 * A local equirectangular projection for Dublin, the same one the pipeline
 * uses, with y flipped so north is up on screen.
 */
const M_PER_DEG = 111_320;
const K_LON = Math.cos((53.35 * Math.PI) / 180);

export type View = { cx: number; cy: number; scale: number };

export function project(lat: number, lon: number): [number, number] {
  return [lon * K_LON * M_PER_DEG, -lat * M_PER_DEG];
}

export function unproject(x: number, y: number): [number, number] {
  return [-y / M_PER_DEG, x / (K_LON * M_PER_DEG)];
}

/** The view that fits [south, west, north, east] into width x height, with a margin in pixels. */
export function fit(bounds: readonly [number, number, number, number], width: number, height: number, margin = 24): View {
  const [s, w, n, e] = bounds;
  const [x1, y1] = project(n, w);
  const [x2, y2] = project(s, e);
  const scale = Math.min((width - 2 * margin) / (x2 - x1), (height - 2 * margin) / (y2 - y1));
  return { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, scale };
}

export function toScreen(view: View, width: number, height: number, x: number, y: number): [number, number] {
  return [width / 2 + (x - view.cx) * view.scale, height / 2 + (y - view.cy) * view.scale];
}

export function toWorld(view: View, width: number, height: number, sx: number, sy: number): [number, number] {
  return [view.cx + (sx - width / 2) / view.scale, view.cy + (sy - height / 2) / view.scale];
}

/** Zooms by factor, keeping the world point under (sx, sy) where it is on screen. */
export function zoomAt(view: View, width: number, height: number, sx: number, sy: number, factor: number): View {
  const [x, y] = toWorld(view, width, height, sx, sy);
  const scale = view.scale * factor;
  return { scale, cx: x - (sx - width / 2) / scale, cy: y - (sy - height / 2) / scale };
}
