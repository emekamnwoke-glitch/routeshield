import { describe, expect, it } from "vitest";
import { countByStatus, listJoin, moveSelection, proposalText, queueRows, routeCodes } from "../../frontend/src/review/queue";
import type { DisruptionView } from "../../frontend/src/workspace/service";

const pattern = (routeCode: string, i: number) => ({
  patternIndex: i,
  patternId: `${routeCode}-${i}`,
  routeCode,
  towards: "Somewhere",
  trips: 10,
  stopsInside: [],
  approaching: 1,
  inside: 0,
});

function disruption(
  id: string,
  status: "pending" | "approved" | "denied" | null,
  verdict: "approve" | "reject" = "approve",
  createdAt = "2026-11-25T08:00:00Z",
): DisruptionView {
  const patterns = [pattern("E1", 0), pattern("E2", 1), pattern("E1", 2)];
  return {
    id,
    place: null,
    description: null,
    status: status === "denied" ? "declined" : "assessed",
    footprint: { lat: 53.35, lon: -6.26, radiusM: 150 },
    createdAt,
    impact: { blockedRoads: 2, blockedLines: [], affectedTrips: 30, patterns, vehicles: { approaching: 3, inside: 0, past: 0 } },
    recommendation: {
      id: `rec-${id}`,
      band: "A1",
      confidence: "medium",
      items: patterns.map((p) => ({ ...p, kind: "reroute" as const, divertStop: "A", rejoinStop: "B", stopsLost: [], extraM: 100, detour: [] })),
    },
    proposal: status ? { id: `prop-${id}`, verdict, status, proposedBy: "controller", reviewedBy: null, reason: null } : null,
    decision: null,
    serviceStates: [],
    notices: [],
  } as DisruptionView;
}

const denied = disruption("gone", "denied", "approve", "2026-11-25T07:00:00Z");

describe("review queue rows", () => {
  it("lists every proposal, the newest incident first, declined ones included (prototype P10)", () => {
    const rows = queueRows(
      [disruption("a", "approved", "approve", "2026-11-25T08:00:00Z"), disruption("b", "pending", "approve", "2026-11-25T09:00:00Z"), disruption("c", null)],
      [denied],
    );
    expect(rows.map((r) => r.id)).toEqual(["prop-b", "prop-a", "prop-gone"]);
    expect(rows[2]?.status).toBe("denied");
    expect(rows[2]?.d.status).toBe("declined");
  });

  it("counts rows by status for the filter chips", () => {
    const rows = queueRows([disruption("a", "approved"), disruption("b", "pending")], [denied]);
    expect(countByStatus(rows)).toEqual({ pending: 1, approved: 1, denied: 1 });
  });
});

describe("queue keyboard", () => {
  it("moves with J and K and stops at the ends", () => {
    expect(moveSelection(0, "j", 3)).toBe(1);
    expect(moveSelection(2, "j", 3)).toBe(2);
    expect(moveSelection(0, "k", 3)).toBe(0);
    expect(moveSelection(1, "ArrowUp", 3)).toBe(0);
    expect(moveSelection(0, "x", 3)).toBe(0);
  });
});

describe("proposal wording", () => {
  it("lists routes once each, in order", () => {
    expect(routeCodes(disruption("a", "pending"))).toEqual(["E1", "E2"]);
    expect(listJoin(["E1", "E2", "F1"])).toBe("E1, E2 and F1");
    expect(listJoin(["E1"])).toBe("E1");
  });

  it("states the ask and the consequence of approving bypasses", () => {
    const t = proposalText(disruption("a", "pending"));
    expect(t.ask).toBe("Controller proposes: approve all 3 suggested bypasses.");
    expect(t.approve).toBe("Approve 3 changes");
    expect(t.consequence).toContain("E1 and E2");
    expect(t.consequence).toContain("audit trail");
    // The approve dialog (prototype P6).
    expect(t.confirmBody).toBe(
      "This diverts E1 and E2 and issues 3 passenger notices. The approval is recorded in the audit trail under your name.",
    );
  });

  it("says that approving a proposed rejection changes nothing", () => {
    const t = proposalText(disruption("a", "pending", "reject"));
    expect(t.approve).toBe("Approve rejection");
    expect(t.consequence).toContain("no route changes");
  });
});
