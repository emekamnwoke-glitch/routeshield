import { describe, expect, it } from "vitest";
import { PERSONAS } from "../../src/core/modules/ac-14-access-control/contract";
import { AUTHORITY, ROLE_ORDER, moveFocus, roleName } from "../../frontend/src/shell/roles";

describe("role menu", () => {
  it("lists every persona exactly once", () => {
    expect([...ROLE_ORDER].sort()).toEqual(PERSONAS.map((p) => p.id).sort());
  });

  it("explains the authority of every persona", () => {
    for (const p of PERSONAS) expect(AUTHORITY[p.id]).toMatch(/\.$/);
  });

  it("says plainly which personas cannot decide", () => {
    expect(AUTHORITY.controller).toContain("Cannot decide");
    expect(AUTHORITY.administrator).toContain("Cannot decide");
    expect(AUTHORITY["contingency-approver"]).toContain("No decision authority");
  });

  it("names personas as the core does", () => {
    for (const p of PERSONAS) expect(roleName(p.id)).toBe(p.name);
  });
});

describe("menu keyboard focus", () => {
  it("moves down and up, wrapping at both ends", () => {
    expect(moveFocus(0, "ArrowDown", 5)).toBe(1);
    expect(moveFocus(4, "ArrowDown", 5)).toBe(0);
    expect(moveFocus(0, "ArrowUp", 5)).toBe(4);
  });

  it("jumps to the first and last item", () => {
    expect(moveFocus(2, "Home", 5)).toBe(0);
    expect(moveFocus(2, "End", 5)).toBe(4);
  });

  it("ignores other keys and empty menus", () => {
    expect(moveFocus(2, "a", 5)).toBe(2);
    expect(moveFocus(0, "ArrowDown", 0)).toBe(-1);
  });
});
