import { describe, expect, it } from "vitest";
import { fit, project, toScreen, toWorld, unproject, zoomAt } from "../../frontend/src/map/projection";

const DUBLIN: [number, number, number, number] = [53.18, -6.45, 53.48, -6.1];

describe("map projection", () => {
  it("round-trips latitude and longitude", () => {
    const [lat, lon] = unproject(...project(53.3498, -6.2603));
    expect(lat).toBeCloseTo(53.3498, 9);
    expect(lon).toBeCloseTo(-6.2603, 9);
  });

  it("puts north up", () => {
    expect(project(53.4, -6.26)[1]).toBeLessThan(project(53.3, -6.26)[1]);
  });

  it("fits the bounds inside the margin", () => {
    const view = fit(DUBLIN, 800, 600, 20);
    const [x1, y1] = toScreen(view, 800, 600, ...project(53.48, -6.45));
    const [x2, y2] = toScreen(view, 800, 600, ...project(53.18, -6.1));
    for (const v of [x1, x2]) expect(v).toBeGreaterThanOrEqual(19.999);
    for (const v of [x1, x2]) expect(v).toBeLessThanOrEqual(780.001);
    for (const v of [y1, y2]) expect(v).toBeGreaterThanOrEqual(19.999);
    for (const v of [y1, y2]) expect(v).toBeLessThanOrEqual(580.001);
  });

  it("zooms about the pointer", () => {
    const view = fit(DUBLIN, 800, 600);
    const before = toWorld(view, 800, 600, 200, 150);
    const zoomed = zoomAt(view, 800, 600, 200, 150, 2);
    const after = toWorld(zoomed, 800, 600, 200, 150);
    expect(zoomed.scale).toBeCloseTo(view.scale * 2);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });
});
