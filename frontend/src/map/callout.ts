/**
 * Where the glass callout goes for a pin at screen point (sx, sy) on a map of width x height:
 * centred under the pin, flipped above it near the bottom edge, and kept 8 px inside the map.
 */
export function placeCallout(sx: number, sy: number, width: number, height: number, w = 240, h = 76): [number, number] {
  const gap = 18;
  const margin = 8;
  const x = Math.min(Math.max(sx - w / 2, margin), Math.max(width - w - margin, margin));
  const below = sy + gap;
  const y = below + h > height - margin ? sy - gap - h : below;
  return [x, Math.max(y, margin)];
}
