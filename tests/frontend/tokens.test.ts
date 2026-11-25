import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the design tokens exported from Figma (frontend/src/tokens.css):
 * both themes define the same colour roles, every alias points at a real role,
 * and the pairs the design language relies on keep their WCAG contrast.
 */
const css = readFileSync(fileURLToPath(new URL("../../frontend/src/tokens.css", import.meta.url)), "utf8");

function block(selector: string): Map<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing block ${selector}`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars = new Map<string, string>();
  for (const m of body.matchAll(/--rs-([a-z0-9-]+):\s*([^;]+);/g)) vars.set(m[1] as string, (m[2] as string).trim());
  return vars;
}

const light = block(":root {");
const dark = block(':root[data-theme="dark"] {');
type Rgba = { r: number; g: number; b: number; a: number };

function hex(value: string | undefined): Rgba {
  if (!value || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)) throw new Error(`not a hex colour: ${value}`);
  const n = (i: number) => parseInt(value.slice(i, i + 2), 16) / 255;
  return { r: n(1), g: n(3), b: n(5), a: value.length === 9 ? n(7) : 1 };
}

const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (c: Rgba) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
const contrast = (a: Rgba, b: Rgba) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (top: Rgba, bottom: Rgba): Rgba => ({
  r: top.a * top.r + (1 - top.a) * bottom.r,
  g: top.a * top.g + (1 - top.a) * bottom.g,
  b: top.a * top.b + (1 - top.a) * bottom.b,
  a: 1,
});

const themes = [
  ["light", light],
  ["dark", dark],
] as const;
const role = (vars: Map<string, string>, name: string) => hex(vars.get(`color-${name}`));

describe("design tokens", () => {
  it("defines the same colour roles in light and dark", () => {
    const names = (m: Map<string, string>) => [...m.keys()].filter((k) => k.startsWith("color-")).sort();
    expect(names(dark)).toEqual(names(light));
    expect(names(light).length).toBeGreaterThanOrEqual(30);
  });

  it("points every semantic alias at a defined colour role", () => {
    const aliases = block("/* Semantic aliases");
    const targets = [...aliases.values()]
      .map((v) => /^var\(--rs-color-([a-z-]+)\)$/.exec(v)?.[1])
      .filter((t): t is string => !!t);
    expect(targets.length).toBeGreaterThanOrEqual(18);
    for (const t of targets) expect(light.has(`color-${t}`), t).toBe(true);
  });

  const textPairs: [string, string][] = [
    ["on-primary", "primary"],
    ["on-error", "error"],
    ["on-primary-container", "primary-container"],
    ["on-secondary-container", "secondary-container"],
    ["on-tertiary-container", "tertiary-container"],
    ["on-error-container", "error-container"],
    ["on-surface", "surface"],
    ["on-surface-variant", "surface-container-lowest"],
    ["on-surface-variant", "surface-container-highest"],
    ["inverse-on-surface", "inverse-surface"],
  ];
  for (const [name, vars] of themes) {
    it(`keeps text at 4.5:1 or more (${name})`, () => {
      for (const [fg, bg] of textPairs) {
        expect(contrast(role(vars, fg), role(vars, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`keeps map lines and markers at 3:1 or more on the map (${name})`, () => {
      const map = role(vars, "surface-container-high");
      for (const line of ["error", "tertiary", "secondary", "on-surface-variant"]) {
        expect(contrast(role(vars, line), map), line).toBeGreaterThanOrEqual(3);
      }
    });

    it(`keeps text on glass at 4.5:1 over every map colour (${name})`, () => {
      const glass = hex(vars.get("surface-glass-selection-fill"));
      for (const fg of ["on-surface", "on-surface-variant"]) {
        for (const under of ["surface-container-high", "outline-variant", "secondary", "tertiary", "error"]) {
          expect(contrast(role(vars, fg), over(glass, role(vars, under))), `${fg} on glass over ${under}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});
