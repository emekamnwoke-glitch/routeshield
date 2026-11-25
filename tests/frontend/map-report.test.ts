import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { placeCallout } from "../../frontend/src/map/callout";

describe("glass callout placement", () => {
  it("sits centred below the pin", () => {
    expect(placeCallout(400, 100, 800, 600)).toEqual([280, 118]);
  });

  it("flips above the pin near the bottom edge", () => {
    const [, y] = placeCallout(400, 560, 800, 600);
    expect(y).toBe(560 - 18 - 76);
  });

  it("stays inside the left and right edges", () => {
    expect(placeCallout(10, 100, 800, 600)[0]).toBe(8);
    expect(placeCallout(795, 100, 800, 600)[0]).toBe(800 - 240 - 8);
  });

  it("stays inside a map narrower than the callout", () => {
    const [x, y] = placeCallout(50, 20, 200, 60);
    expect(x).toBe(8);
    expect(y).toBeGreaterThanOrEqual(8);
  });
});

/**
 * ADR-0021: glass is allowed on three surfaces only (the map callout, the command palette and the
 * selection bar). Only the map callout exists so far, so only the map may use the glass class.
 */
describe("ADR-0021 glass rule", () => {
  const ALLOWED = new Set(["map/NetworkMap.tsx"]);
  const root = join(__dirname, "../../frontend/src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : [],
    );

  it("uses glass only where the ADR allows it", () => {
    const users = files(root)
      .filter((f) => /className=["{`][^"]*\bglass\b/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length + 1).replaceAll("\\", "/"));
    expect(users.filter((u) => !ALLOWED.has(u))).toEqual([]);
  });

  it("keeps the review drawer and the report sheet opaque", () => {
    for (const f of ["review/ReviewDrawer.tsx", "map/ReportSheet.tsx"]) {
      expect(readFileSync(join(root, f), "utf8")).not.toMatch(/className=["{`][^"]*\bglass\b/);
    }
  });
});
