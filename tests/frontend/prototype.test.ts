/**
 * The Round 3 prototype, played through the real core over the real sample network: flow 1 (report, propose,
 * approve) and flow 2 (deny with a reason). If the network or the core's rules change, this says which of the
 * prototype's words or figures moved.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countByCategory, eventDetail, rowLabel, rowTitle, trailRows } from "../../frontend/src/audit/trail";
import {
  bypassName,
  countByStage,
  decidedText,
  incidentTitle,
  landingStage,
  proposalLines,
  serviceNow,
  stageChip,
  stageEyebrow,
} from "../../frontend/src/incidents/incidents";
import type { RoadNames } from "../../frontend/src/map/roads";
import { nearestRoad, placeAt, withPlaces } from "../../frontend/src/map/roads";
import { proposalText, queueRows } from "../../frontend/src/review/queue";
import type { DisruptionView, WorkspaceState } from "../../frontend/src/workspace/service";
import { DEFAULT_INCIDENT, handle, readState } from "../../frontend/src/workspace/service";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";
import { dublin } from "../core/network-fixture";

const site = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../data/fixtures/site/network.json", import.meta.url)), "utf-8"),
) as RoadNames;

/** The state as the site shows it: incidents named by the street they are on. */
const named = (s: WorkspaceState) => ({
  open: withPlaces(site, s.disruptions),
  declined: withPlaces(site, s.declined),
});

async function reported() {
  const core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
  const res = await handle(core, "memory", { persona: "controller", kind: "report", incident: DEFAULT_INCIDENT });
  if (!res.ok) throw new Error(res.error);
  return { core, state: res.state };
}

async function proposed() {
  const { core, state } = await reported();
  const recommendationId = state.disruptions[0]?.recommendation?.id ?? "";
  const res = await handle(core, "memory", {
    persona: "controller",
    kind: "propose",
    recommendationId,
    verdict: "approve",
  });
  if (!res.ok) throw new Error(res.error);
  return { core, state: res.state, notice: res.notice, proposalId: res.state.disruptions[0]?.proposal?.id ?? "" };
}

describe("flow 1: report, propose, approve", () => {
  it("P2: the report starts on O'Connell St Upper", () => {
    expect([
      DEFAULT_INCIDENT.lat,
      DEFAULT_INCIDENT.lon,
      DEFAULT_INCIDENT.radiusM,
      DEFAULT_INCIDENT.description,
    ]).toEqual([53.3498, -6.2603, 150, "Road closed"]);
    expect(placeAt(site, DEFAULT_INCIDENT.lat, DEFAULT_INCIDENT.lon)).toBe("O'Connell St Upper");
  });

  it("P3: the incident assessed, figure for figure and row by row", async () => {
    const { state } = await reported();
    const [d] = named(state).open;
    if (!d) throw new Error("no incident");
    expect(incidentTitle(d)).toBe("O'Connell St Upper, 150 m closure");
    expect(stageEyebrow(d)).toBe("INCIDENT · NEEDS A PROPOSAL");
    expect(stageChip(d).label).toBe("Needs proposal");
    expect(d.impact?.patterns).toHaveLength(13);
    expect(d.impact?.affectedTrips).toBe(848);
    expect(d.impact?.vehicles).toMatchObject({ approaching: 59, inside: 3 });
    expect([...new Set(d.impact?.patterns.map((p) => p.routeCode))]).toEqual(["E1", "E2", "F1", "F2"]);
    expect(d.recommendation).toMatchObject({ band: "A1", confidence: "medium" });

    const rows = (d.recommendation?.items ?? []).map((it) => {
      const p = d.impact?.patterns.find((x) => x.patternIndex === it.patternIndex);
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

  it("P4 to P6: the proposal, as the controller and the duty manager read it", async () => {
    const { state, notice } = await proposed();
    expect(notice).toBe("Proposed. It is pending the duty manager's approval.");
    const { open, declined } = named(state);
    const [d] = open;
    if (!d) throw new Error("no incident");
    expect(stageEyebrow(d)).toBe("INCIDENT · AWAITING REVIEW");
    expect(stageChip(d).label).toBe("Pending review");
    expect(proposalLines(open, declined).map((l) => [l.chip.label, l.text])).toEqual([
      ["Pending review", "Approve all 13 bypasses · O'Connell St Upper"],
    ]);
    const t = proposalText(d);
    expect(t.ask).toBe("Controller proposes: approve all 13 suggested bypasses.");
    expect(t.approve).toBe("Approve 13 changes");
    expect(t.consequence).toBe(
      "Approving diverts E1, E2, F1 and F2 and issues 13 passenger notices. It is recorded in the audit trail.",
    );
    expect(t.confirmTitle).toBe("Approve 13 route changes?");
    expect(t.confirmBody).toBe(
      "This diverts E1, E2, F1 and F2 and issues 13 passenger notices. The approval is recorded in the audit trail under your name.",
    );
  });

  it("P7, P9 and PA: approved, in effect, and in the audit trail", async () => {
    const { core, proposalId } = await proposed();
    const res = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId,
      outcome: "approve",
      reason: "",
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.notice).toBe("Approved. Service states and passenger notices updated.");
    const { open, declined } = named(res.state);
    const [d] = open;
    if (!d) throw new Error("no incident");
    expect(queueRows(open, declined).map((r) => r.status)).toEqual(["approved"]);
    expect(serviceNow(d).map((s) => `${s.routeCode} · ${s.label}`)).toEqual([
      "E1 · Diverted",
      "E2 · Diverted",
      "F1 · Diverted",
      "F2 · Diverted",
    ]);
    expect(decidedText(d, "you")).toBe(
      "Approved by you. E1, E2, F1 and F2 are diverted and 13 passenger notices were issued. Recorded in the audit trail.",
    );
    expect(stageEyebrow(d)).toBe("INCIDENT · IN EFFECT");
    expect(decidedText(d, "the duty manager")).toBe(
      "Approved by the duty manager. E1, E2, F1 and F2 are diverted and 13 passenger notices were issued.",
    );
    expect(proposalLines(open, declined).map((l) => [l.chip.label, l.text])).toEqual([
      ["Approved", "Approve all 13 bypasses · approved"],
    ]);

    const admin = await readState(core, "memory", "administrator");
    const audit = admin.audit;
    expect(audit?.chain.ok).toBe(true);
    const rows = trailRows(audit?.trail ?? []);
    expect(countByCategory(rows)).toEqual({ all: 39, assessment: 5, decisions: 3, service: 26, authority: 5 });
    expect(rows.map((r) => `${rowLabel(r)} ${rowTitle(r)}`)).toEqual([
      "27–39 Passenger notice issued",
      "14–26 Service state changed",
      "13 Proposal approved",
      "12 Decision made: approve",
      "11 Proposal submitted",
      "10 Recommendation issued",
      "9 Bypass options generated",
      "8 Impact assessed",
      "7 Evidence snapshot frozen",
      "6 Disruption declared",
      "1–5 Authority granted",
    ]);
    const decision = rows.find((r) => r.type === "decision.made");
    if (!decision) throw new Error("no decision.made event");
    const detail = eventDetail(decision, rows, withPlaces(site, admin.disruptions));
    expect(detail.title).toBe("Decision made: approve");
    expect(detail.facts).toEqual([
      ["Incident", "O'Connell St Upper, 150 m closure"],
      ["Verdict", "Approve"],
      ["Bypasses", "13 route patterns on E1, E2, F1 and F2"],
      ["Reason recorded", "Approved the controller's proposal (event #11)"],
    ]);
    expect(detail.related.map((r) => rowLabel(r))).toEqual(["11", "13", "14–26", "27–39"]);
  });
});

describe("flow 2: deny with a reason", () => {
  const reason = "Westmoreland Street has a planned closure from 09:00; use a hold instead.";

  it("P10 and P11: the denial stays in the queue, and the reason reaches My proposals", async () => {
    const { core, proposalId } = await proposed();
    const res = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId,
      outcome: "deny",
      reason,
    });
    if (!res.ok) throw new Error(res.error);
    expect(res.notice).toBe(
      "Denied. The incident is declined and closed; the reason is on the controller's noticeboard.",
    );
    const { open, declined } = named(res.state);
    expect(open).toEqual([]);
    const [d] = declined as [DisruptionView];
    expect(incidentTitle(d)).toBe("O'Connell St Upper, 150 m closure");

    // P10: the duty manager's queue.
    expect(queueRows(open, declined).map((r) => r.status)).toEqual(["denied"]);
    expect(decidedText(d, "you")).toBe(
      `Denied by you. Reason: ${reason} The incident is declined and closed; no routes changed and no notices were issued.`,
    );

    // P11: the controller's incidents and My proposals.
    expect(countByStage(open, declined.length)).toEqual({ needs: 0, awaiting: 0, decided: 1 });
    expect(landingStage(open, declined.length)).toBe("decided");
    expect(proposalLines(open, declined).map((l) => [l.chip.label, l.text, l.reason])).toEqual([
      ["Denied", "Approve all 13 bypasses · denied", `Reason: ${reason} To resubmit, report the incident again.`],
    ]);
  });
});

describe("naming a closure's place", () => {
  it("names the nearest bus road, shortened as a sign would", () => {
    // Crofton Avenue, Dún Laoghaire: the E2 runs along Crofton Road beside it.
    expect(nearestRoad(site, 53.2957927315715, -6.13820878983198)).toBe("Crofton Road");
    expect(placeAt(site, 53.2957927315715, -6.13820878983198)).toBe("Crofton Rd");
  });

  it("names nothing far from any bus road", () => {
    expect(placeAt(site, 53.3559, -6.3298)).toBeNull(); // Phoenix Park
  });
});
