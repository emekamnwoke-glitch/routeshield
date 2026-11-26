/** The part of the site network (data/fixtures/site/network.json) that names roads. */
export type RoadNames = {
  edges: number[][];
  roads: string[];
  edge_roads: number[];
};

const M_PER_DEG = 111_320;
const K_LON = Math.cos((53.35 * Math.PI) / 180);

/**
 * The named bus road nearest a point, to suggest where a reported closure is; null when none is within maxM.
 * Only roads a bus route runs along are in the site network, which are the ones a closure matters on.
 */
export function nearestRoad(net: RoadNames, lat: number, lon: number, maxM = 250): string | null {
  const px = lon * K_LON * M_PER_DEG;
  const py = lat * M_PER_DEG;
  let best = maxM;
  let name: string | null = null;
  net.edges.forEach((line, i) => {
    const road = net.roads[net.edge_roads[i] ?? -1];
    if (!road) return;
    for (let k = 2; k < line.length; k += 2) {
      const ax = (line[k - 1] ?? 0) * K_LON * M_PER_DEG;
      const ay = (line[k - 2] ?? 0) * M_PER_DEG;
      const bx = (line[k + 1] ?? 0) * K_LON * M_PER_DEG;
      const by = (line[k] ?? 0) * M_PER_DEG;
      const dx = bx - ax;
      const dy = by - ay;
      const span = dx * dx + dy * dy;
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < best) {
        best = d;
        name = road;
      }
    }
  });
  return name;
}
