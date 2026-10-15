/**
 * AC-13 Control Workspace service: what the site's core worker runs, driven
 * here under Node over in-memory SQLite WASM and the real sample network.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { handle, readState } from "../../frontend/src/workspace/service";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";
import { dublin } from "../core/network-fixture";

// Crofton Avenue, Dún Laoghaire: cuts only southbound E2.
const incident = { lat: 53.2957927315715, lon: -6.13820878983198, radiusM: 60, description: "Road closed" };

let core: Core;

beforeEach(async () => {
  core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
});

async function reportedRecommendation(): Promise<string> {
  const res = await handle(core, "memory", { persona: "controller", kind: "report", incident });
  if (!res.ok) throw new Error(res.error);
  const rec = res.state.disruptions[0]?.recommendation;
  if (!rec) throw new Error("no recommendation");
  return rec.id;
}

describe("workspace service", () => {
  it("starts with the access grants, the fleet and a verified chain, shown to the administrator only", async () => {
    const state = await readState(core, "memory", "administrator");
    expect(state.disruptions).toEqual([]);
    expect(state.network).toEqual({ loaded: true, version: dublin().network.version });
    expect(state.vehicles.length).toBe(dublin().fleet.vehicles.length);
    expect(state.vehicles.every((v) => v.relation === null)).toBe(true);
    expect(state.audit).toMatchObject({ chain: { ok: true, events: 5 }, components: ["AC-14"] });
  });

  it("gives the audit trail to the administrator only", async () => {
    expect((await readState(core, "memory", "administrator")).audit).not.toBeNull();
    expect((await readState(core, "memory", "controller")).audit).toBeNull();
    expect((await readState(core, "memory", "duty-manager")).audit).toBeNull();
    expect((await readState(core, "memory", "contingency-approver")).audit).toBeNull();
  });

  it("shows the impact and a bypass awaiting a person", async () => {
    const res = await handle(core, "memory", { persona: "controller", kind: "report", incident });
    if (!res.ok) throw new Error(res.error);
    expect(res.notice).toBe("Incident assessed: 1 route pattern affected.");
    const [d] = res.state.disruptions;
    expect(d?.impact?.patterns).toMatchObject([{ routeCode: "E2" }]);
    expect(d?.impact?.blockedLines.length).toBeGreaterThan(0);
    expect(d?.recommendation).toMatchObject({ band: "A1", confidence: "medium" });
    const [item] = d?.recommendation?.items ?? [];
    expect(item).toMatchObject({ routeCode: "E2", kind: "reroute" });
    expect(item?.stopsLost).toHaveLength(1);
    expect(item?.divertStop).toEqual(expect.any(String));
    expect(item?.detour.length).toBeGreaterThan(2);
    expect(d?.decision).toBeNull();
    expect(d?.proposal).toBeNull();
    // Vehicles on the affected pattern are marked on the map.
    expect(res.state.vehicles.some((v) => v.relation === "approaching" || v.relation === "inside")).toBe(true);
  });

  it("proposes, then the duty manager approves: the decision follows and the noticeboard says so", async () => {
    const recommendationId = await reportedRecommendation();
    const proposed = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId, verdict: "approve" });
    if (!proposed.ok) throw new Error(proposed.error);
    expect(proposed.notice).toBe("Proposed. It is pending the Duty manager's approval.");
    const proposal = proposed.state.disruptions[0]?.proposal;
    expect(proposal).toMatchObject({ status: "pending", verdict: "approve", proposedBy: "controller" });
    expect(proposed.state.disruptions[0]?.decision).toBeNull();
    expect(proposed.state.noticeboard[0]).toMatchObject({ tone: "pending" });

    const approved = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId: proposal?.id ?? "",
      outcome: "approve",
      reason: "",
    });
    if (!approved.ok) throw new Error(approved.error);
    expect(approved.notice).toContain("Approved.");
    expect(approved.state.disruptions[0]).toMatchObject({
      proposal: { status: "approved", reviewedBy: "duty-manager" },
      decision: { verdict: "approve", decidedBy: "duty-manager" },
      serviceStates: [{ routeCode: "E2", state: "diverted" }],
      notices: [{ routeCode: "E2", channel: "passenger", kind: "diverted" }],
    });
    expect(approved.state.noticeboard[0]).toMatchObject({ tone: "approved" });
    expect(approved.state.noticeboard[0]?.text).toContain("Recommendation approved");
    const audit = (await readState(core, "memory", "administrator")).audit;
    expect(audit?.components).toEqual(expect.arrayContaining(["AC-07", "AC-08", "AC-09", "AC-14"]));
    expect(audit?.chain.ok).toBe(true);
  });

  it("denies with a reason, which goes to the controller's noticeboard, and lets the controller propose again", async () => {
    const recommendationId = await reportedRecommendation();
    const proposed = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId, verdict: "approve" });
    if (!proposed.ok) throw new Error(proposed.error);
    const proposalId = proposed.state.disruptions[0]?.proposal?.id ?? "";

    const denied = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId,
      outcome: "deny",
      reason: "Bypass cuts the hospital stop",
    });
    if (!denied.ok) throw new Error(denied.error);
    // The incident is declined: it leaves the map and the menus, so the controller's card clears too.
    expect(denied.state.disruptions).toEqual([]);
    expect(denied.state.vehicles.every((v) => v.relation === null)).toBe(true);
    expect(denied.state.noticeboard[0]).toMatchObject({ tone: "denied" });
    expect(denied.state.noticeboard[0]?.text).toContain("Reason: Bypass cuts the hospital stop.");

    // The closed incident cannot be proposed on again.
    const again = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId, verdict: "reject" });
    expect(again).toMatchObject({ ok: true, notice: expect.stringContaining("was declined and is closed") });
    const audit = (await readState(core, "memory", "administrator")).audit;
    expect(audit?.trail.map((t) => t.type)).toEqual(expect.arrayContaining(["proposal.denied", "disruption.declined"]));
  });

  it("resubmits a denied incident through a fresh report, which the controller can propose on again", async () => {
    const firstRecommendation = await reportedRecommendation();
    const proposed = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId: firstRecommendation, verdict: "approve" });
    if (!proposed.ok) throw new Error(proposed.error);
    const proposalId = proposed.state.disruptions[0]?.proposal?.id ?? "";
    await handle(core, "memory", { persona: "duty-manager", kind: "review", proposalId, outcome: "deny", reason: "Missed the school run" });

    // The same place, reported again: a new incident, so a new recommendation to propose on.
    const resubmitted = await handle(core, "memory", { persona: "controller", kind: "report", incident });
    if (!resubmitted.ok) throw new Error(resubmitted.error);
    expect(resubmitted.state.disruptions).toHaveLength(1);
    const secondRecommendation = resubmitted.state.disruptions[0]?.recommendation?.id ?? "";
    expect(secondRecommendation).not.toBe(firstRecommendation);

    const again = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId: secondRecommendation, verdict: "approve" });
    expect(again).toMatchObject({ ok: true, notice: "Proposed. It is pending the Duty manager's approval." });
    if (again.ok) expect(again.state.disruptions[0]?.proposal).toMatchObject({ status: "pending" });
    expect(again.ok && again.state.noticeboard.map((n) => n.tone)).toEqual(["pending", "denied"]);
  });

  it("refuses a denial without a reason, and a controller trying to approve its own proposal", async () => {
    const recommendationId = await reportedRecommendation();
    const proposed = await handle(core, "memory", { persona: "controller", kind: "propose", recommendationId, verdict: "approve" });
    if (!proposed.ok) throw new Error(proposed.error);
    const proposalId = proposed.state.disruptions[0]?.proposal?.id ?? "";

    const noReason = await handle(core, "memory", {
      persona: "duty-manager",
      kind: "review",
      proposalId,
      outcome: "deny",
      reason: "  ",
    });
    expect(noReason).toMatchObject({ ok: true, notice: expect.stringContaining("a denial needs a reason") });

    const selfReview = await handle(core, "memory", {
      persona: "controller",
      kind: "review",
      proposalId,
      outcome: "approve",
      reason: "",
    });
    // A controller holds no decide authority, so it cannot approve even its own proposal.
    expect(selfReview).toMatchObject({ ok: true, notice: expect.stringContaining("controller does not hold decide") });
  });

  it("says so when no route is affected", async () => {
    const res = await handle(core, "memory", {
      persona: "controller",
      kind: "report",
      incident: { lat: 53.3559, lon: -6.3298, radiusM: 50, description: "Phoenix Park" },
    });
    expect(res).toMatchObject({ ok: true, notice: "Incident assessed: no bus route in the sample runs through it." });
    if (res.ok) expect(res.state.disruptions[0]?.recommendation).toMatchObject({ band: "A0", items: [] });
  });

  it("returns errors as responses rather than throwing", async () => {
    const res = await handle(core, "memory", {
      persona: "controller",
      kind: "propose",
      recommendationId: "rec_missing",
      verdict: "approve",
    });
    expect(res).toMatchObject({ ok: true, notice: expect.stringContaining("not found") });
    expect(await handle(core, "memory", { persona: "controller", kind: "reset" })).toMatchObject({ ok: false });
  });
});
