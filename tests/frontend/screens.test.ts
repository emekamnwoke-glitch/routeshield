import { describe, expect, it } from "vitest";
import { actionName, actorName, categoryOf, componentName, countByCategory, rowLabel, trailRows } from "../../frontend/src/audit/trail";
import { clock, countByStage, incidentRows, stageOf } from "../../frontend/src/incidents/incidents";
import { focusView, project, toScreen } from "../../frontend/src/map/projection";
import { SCREENS, homeScreen } from "../../frontend/src/shell/screens";
import type { DisruptionView, TrailEntry } from "../../frontend/src/workspace/service";

describe("screens per role (Figma frames A, D and E)", () => {
  it("lands each role on its own work", () => {
    expect(homeScreen("controller")).toBe("incidents");
    expect(homeScreen("duty-manager")).toBe("review");
    expect(homeScreen("administrator")).toBe("audit");
    expect(homeScreen("contingency-approver")).toBe("incidents");
  });

  it("gives every role the shared map, and the audit trail only to the administrator", () => {
    for (const screens of Object.values(SCREENS)) expect(screens).toContain("map");
    const withAudit = Object.entries(SCREENS).filter(([, s]) => s.includes("audit")).map(([p]) => p);
    expect(withAudit).toEqual(["administrator"]);
  });
});

function incident(id: string, over: Partial<DisruptionView> = {}): DisruptionView {
  return {
    id,
    status: "assessed",
    footprint: { lat: 53.35, lon: -6.26, radiusM: 150 },
    createdAt: "2026-11-25T08:00:00.000Z",
    impact: { blockedRoads: 2, blockedLines: [], affectedTrips: 30, patterns: [], vehicles: { approaching: 0, inside: 0, past: 0 } },
    recommendation: { id: `rec-${id}`, band: "A1", confidence: "medium", items: [{} as never] },
    proposal: null,
    decision: null,
    serviceStates: [],
    notices: [],
    ...over,
  };
}

describe("incident stages", () => {
  it("needs a proposal until one is made, and again after a denial", () => {
    expect(stageOf(incident("a"))).toBe("needs");
    const denied = { id: "p", verdict: "approve", status: "denied", proposedBy: "controller", reviewedBy: "duty-manager", reason: "x" } as const;
    expect(stageOf(incident("a", { proposal: denied }))).toBe("needs");
  });

  it("awaits review while a proposal is pending, and is decided once a person decides", () => {
    const pending = { id: "p", verdict: "approve", status: "pending", proposedBy: "controller", reviewedBy: null, reason: null } as const;
    expect(stageOf(incident("a", { proposal: pending }))).toBe("awaiting");
    expect(stageOf(incident("a", { decision: { verdict: "approve", decidedBy: "duty-manager", decidedAt: "" } }))).toBe("decided");
  });

  it("has nothing to decide when no route runs through the closure", () => {
    const empty = incident("a", { recommendation: { id: "r", band: "A0", confidence: "high", items: [] } });
    expect(stageOf(empty)).toBe("decided");
  });

  it("lists newest first and counts each stage for the filter chips", () => {
    const rows = incidentRows([incident("old"), incident("new")]);
    expect(rows.map((d) => d.id)).toEqual(["new", "old"]);
    expect(countByStage(rows)).toEqual({ needs: 2, awaiting: 0, decided: 0 });
    expect(clock("2026-11-25T08:00:42.000Z")).toBe("08:00");
    expect(clock("2026-11-25T08:00:42.000Z", true)).toBe("08:00:42");
  });
});

describe("audit trail rows", () => {
  const e = (seq: number, type: string, component: string, actor: string | null): TrailEntry => ({ seq, at: "2026-11-25T13:17:50Z", component, type, actor });
  // Newest first, as the core returns it.
  const trail = [
    e(5, "notice.issued", "AC-09", "AC-09"),
    e(4, "notice.issued", "AC-09", "AC-09"),
    e(3, "notice.issued", "AC-09", "AC-09"),
    e(2, "decision.made", "AC-07", "duty-manager"),
    e(1, "authority.granted", "AC-14", "AC-14"),
  ];

  it("collapses a run of the same event into one row, numbered first to last", () => {
    const rows = trailRows(trail);
    expect(rows.map(rowLabel)).toEqual(["3–5", "2", "1"]);
    expect(rows[0]?.count).toBe(3);
  });

  it("puts every event type in one filter and counts events, not rows", () => {
    expect(categoryOf("impact.assessed")).toBe("assessment");
    expect(categoryOf("proposal.approved")).toBe("decisions");
    expect(categoryOf("service_state.changed")).toBe("service");
    expect(categoryOf("authority.granted")).toBe("authority");
    expect(countByCategory(trailRows(trail))).toEqual({ all: 5, assessment: 0, decisions: 1, service: 3, authority: 1 });
  });

  it("names actions, components and actors in plain words", () => {
    expect(actionName("decision.made")).toBe("Decision made");
    expect(actionName("something.new")).toBe("something.new");
    expect(componentName("AC-07")).toBe("AC-07 Decision Manager");
    expect(actorName("duty-manager")).toBe("Duty manager");
    expect(actorName("AC-09")).toBe("System");
    expect(actorName(null)).toBe("System");
  });
});

describe("incident map focus", () => {
  it("centres the closure and shows about eight radii across the shorter side", () => {
    const f = { lat: 53.35, lon: -6.26, radiusM: 150 };
    const view = focusView(f, 400, 300);
    expect(toScreen(view, 400, 300, ...project(f.lat, f.lon))).toEqual([200, 150]);
    expect(f.radiusM * 8 * view.scale).toBeCloseTo(300);
  });
});
