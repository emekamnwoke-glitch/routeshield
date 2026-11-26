/**
 * The Figma scenario: the incident frames A, D and E show, reported to the real core over the real sample
 * network. If the network or the core's rules change, this says which of the frame's numbers moved.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RoadNames } from "../../frontend/src/map/roads";
import { nearestRoad } from "../../frontend/src/map/roads";
import { countByCategory, eventDetail, rowLabel, trailRows } from "../../frontend/src/audit/trail";
import { bypassName } from "../../frontend/src/incidents/incidents";
import { proposalText } from "../../frontend/src/review/queue";
import type { DisruptionView } from "../../frontend/src/workspace/service";
import { FIGMA_INCIDENT, handle, readState } from "../../frontend/src/workspace/service";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";
import { dublin } from "../core/network-fixture";

describe("the Figma scenario (frame D)", () => {
  it("finds what the frame shows", async () => {
    const core = await createCore({
      store: await SqliteStore.inMemory(),
      clock: new ManualClock(),
      ...dublin(),
    });
    const res = await handle(core, "memory", {
      persona: "controller",
      kind: "report",
      incident: FIGMA_INCIDENT,
    });
    if (!res.ok) throw new Error(res.error);
    const [d] = res.state.disruptions;
    expect(d?.place).toBe("O'Connell St Upper");
    expect(d?.footprint.radiusM).toBe(150);
    expect(d?.impact?.patterns).toHaveLength(13);
    expect(d?.impact?.affectedTrips).toBe(848);
    expect(d?.impact?.vehicles).toMatchObject({ approaching: 59, inside: 3 });
    expect([...new Set(d?.impact?.patterns.map((p) => p.routeCode))]).toEqual(["E1", "E2", "F1", "F2"]);
    expect(d?.recommendation).toMatchObject({
      band: "A1",
      confidence: "medium",
    });

    // The bypass table, row by row: pattern, stop missed, approaching and inside, extra metres.
    const rows = (d?.recommendation?.items ?? []).map((it) => {
      const p = d?.impact?.patterns.find((x) => x.patternIndex === it.patternIndex);
      const bypass = bypassName(it.divertStop ?? "?", it.rejoinStop ?? "?");
      return [it.patternId, p?.towards, it.stopsLost[0], p?.approaching, p?.inside, bypass, it.extraM];
    });
    const east = "Parnell Sq E → D'Olier St";
    const west = "Westmoreland → Parnell Sq W";
    expect(rows).toEqual([
      ["E1-0-18", "Southern Cross", "The Spire of Dublin", 5, 0, east, 1008],
      ["E1-0-19", "Southern Cross", "The Spire of Dublin", 0, 0, east, 1008],
      ["E1-1-20", "Northwood", "O'Connell St Upper", 11, 0, west, 494],
      ["E1-1-21", "Parnell Square West", "O'Connell St Upper", 7, 0, west, 494],
      ["E1-1-22", "Parnell Square West", "O'Connell St Upper", 1, 0, west, 494],
      ["E2-0-23", "Dun Laoghaire Stn", "The Spire of Dublin", 7, 1, east, 1008],
      ["E2-1-24", "Harristown Depot", "O'Connell St Upper", 9, 0, west, 494],
      ["F1-0-25", "Tallaght Square", "O'Connell St Upr", 3, 0, east, 1009],
      ["F1-0-26", "Mt Drummond Ave", "O'Connell St Upr", 4, 0, east, 1009],
      ["F1-1-27", "IKEA Ballymun", "O'Connell St Upr", 7, 0, west, 494],
      ["F1-1-28", "IKEA Ballymun", "O'Connell St Upr", 0, 0, west, 494],
      ["F2-0-29", "Orwell Park Grn", "O'Connell St Upr", 2, 1, east, 1009],
      ["F2-1-30", "Lanesborough Pk", "O'Connell St Upr", 3, 1, west, 494],
    ]);
  });
});

describe("the Figma scenario (frames A and E)", () => {
  it("names the proposal by its place, and leaves the audit trail frame E counts", async () => {
    const core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
    const reported = await handle(core, "memory", { persona: "controller", kind: "report", incident: FIGMA_INCIDENT });
    if (!reported.ok) throw new Error(reported.error);
    const recommendationId = reported.state.disruptions[0]?.recommendation?.id ?? "";
    const proposed = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId, verdict: "approve" });
    if (!proposed.ok) throw new Error(proposed.error);
    expect(proposed.state.noticeboard[0]?.text).toBe(
      "Proposed to approve all for O'Connell St Upper. Pending the Duty manager's approval.",
    );

    // Frame A: the duty manager's footer.
    expect(proposalText(proposed.state.disruptions[0] as DisruptionView).consequence).toBe(
      "Approving diverts E1, E2, F1 and F2 and issues 13 passenger notices. It is recorded in the audit trail.",
    );

    const proposalId = proposed.state.disruptions[0]?.proposal?.id ?? "";
    const approved = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId,
      outcome: "approve",
      reason: "",
    });
    if (!approved.ok) throw new Error(approved.error);
    const admin = await readState(core, "memory", "administrator");
    const audit = admin.audit;
    expect(audit?.chain.ok).toBe(true);
    const rows = trailRows(audit?.trail ?? []);
    expect(countByCategory(rows)).toEqual({
      all: 39,
      assessment: 5,
      decisions: 3,
      service: 26,
      authority: 5,
    });

    // Frame E: the rows, newest first, and event #12's panel.
    expect(rows.map(rowLabel)).toEqual(["27–39", "14–26", "13", "12", "11", "10", "9", "8", "7", "6", "1–5"]);
    const decision = rows.find((r) => r.type === "decision.made");
    if (!decision) throw new Error("no decision.made event");
    expect(decision.first).toBe(12);
    const detail = eventDetail(decision, rows, admin.disruptions);
    expect(detail.title).toBe("Decision made: approve");
    expect(detail.facts).toEqual([
      ["Incident", "O'Connell St Upper, 150 m closure"],
      ["Verdict", "Approve"],
      ["Bypasses", "13 route patterns on E1, E2, F1 and F2"],
      ["Reason recorded", "Approved the controller's proposal (event #11)"],
    ]);
    expect(detail.related.map((r) => [rowLabel(r), r.type])).toEqual([
      ["11", "proposal.submitted"],
      ["13", "proposal.approved"],
      ["14–26", "service_state.changed"],
      ["27–39", "notice.issued"],
    ]);
    expect(detail.incidentId).toBe(admin.disruptions[0]?.id);
  });
});

describe("suggesting a place for a closure", () => {
  const site = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../data/fixtures/site/network.json", import.meta.url)), "utf-8"),
  ) as RoadNames;

  it("names the nearest bus road", () => {
    // Crofton Avenue, Dún Laoghaire: the E2 runs along Crofton Road beside it.
    expect(nearestRoad(site, 53.2957927315715, -6.13820878983198)).toBe("Crofton Road");
    expect(nearestRoad(site, 53.3515, -6.261)).toBe("O'Connell Street Upper");
  });

  it("suggests nothing far from any bus road", () => {
    expect(nearestRoad(site, 53.3559, -6.3298)).toBeNull(); // Phoenix Park
  });
});
