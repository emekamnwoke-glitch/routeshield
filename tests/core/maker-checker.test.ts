/**
 * Maker-checker (ADR-0017): a controller proposes, a duty manager approves or denies. Nothing reaches a
 * decision without a proposal, and the proposer cannot review their own proposal.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { SqliteStore } from "../../src/adapters/sqlite/sqlite-store";
import type { Core } from "../../src/core/core";
import { createCore } from "../../src/core/core";
import { ManualClock } from "../../src/core/kernel/primitives";
import { DecisionRefused, ProposalRefused } from "../../src/core/modules/ac-07-decision-manager/contract";
import type { Actor } from "../../src/core/kernel/primitives";
import { dublin } from "./network-fixture";

// Crofton Avenue, Dún Laoghaire: a 60 m closure there cuts only southbound E2.
const incident = {
  source: "fictional-incident-feed",
  externalRef: "CAD-0002",
  area: { lat: 53.2957927315715, lon: -6.13820878983198, radiusM: 60 },
  description: "Road closed, Crofton Avenue",
};

const controller: Actor = { kind: "persona", id: "controller" };
const dutyManager: Actor = { kind: "persona", id: "duty-manager" };
const administrator: Actor = { kind: "persona", id: "administrator" };

let core: Core;

beforeEach(async () => {
  core = await createCore({ store: await SqliteStore.inMemory(), clock: new ManualClock(), ...dublin() });
});

async function reportAndRecommend(): Promise<{ recommendationId: string; disruptionId: string }> {
  await core.sources.reportIncident(incident);
  await core.bus.dispatch();
  const rec = await core.store.read((tx) =>
    tx.one<{ id: string; disruption_id: string }>("select id, disruption_id from ds_recommendation"),
  );
  if (!rec) throw new Error("no recommendation was issued");
  return { recommendationId: rec.id, disruptionId: rec.disruption_id };
}

async function auditTypes(disruptionId: string): Promise<string[]> {
  return core.store.read((tx) => core.ledger.events(tx, { subject: disruptionId }).map((e) => e.type));
}

describe("maker-checker", () => {
  it("lets a controller propose, but not decide", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    await expect(core.decisions.decide(controller, recommendationId, "approve", "")).rejects.toThrow(DecisionRefused);
    const proposal = await core.decisions.propose(controller, recommendationId, "approve", "");
    expect(proposal).toMatchObject({ status: "pending", proposedBy: controller, verdict: "approve" });
    const types = await auditTypes(disruptionId);
    expect(types).toContain("decision.refused");
    expect(types).toContain("proposal.submitted");
    expect(types).not.toContain("decision.made");
  });

  it("leaves a proposal pending: no decision, no service change, until the duty manager reviews it", async () => {
    const { recommendationId } = await reportAndRecommend();
    await core.decisions.propose(controller, recommendationId, "approve", "");
    await core.bus.dispatch();
    const decision = await core.store.read((tx) => core.decisions.forRecommendation(tx, recommendationId));
    expect(decision).toBeUndefined();
  });

  it("allows one proposal at a time per recommendation", async () => {
    const { recommendationId } = await reportAndRecommend();
    await core.decisions.propose(controller, recommendationId, "approve", "");
    await expect(core.decisions.propose(controller, recommendationId, "reject", "")).rejects.toThrow(
      /already pending a duty manager's approval/,
    );
  });

  it("makes the decision when the duty manager approves, recording who proposed it and who approved it", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    const proposal = await core.decisions.propose(controller, recommendationId, "approve", "");
    const reviewed = await core.decisions.review(dutyManager, proposal.id, "approve", "");
    expect(reviewed).toMatchObject({ status: "approved", reviewedBy: dutyManager, proposedBy: controller });
    const decision = await core.store.read((tx) => core.decisions.forRecommendation(tx, recommendationId));
    expect(decision).toMatchObject({ verdict: "approve", decidedBy: dutyManager });
    expect(await auditTypes(disruptionId)).toEqual(expect.arrayContaining(["proposal.submitted", "decision.made", "proposal.approved"]));
  });

  it("requires a reason to deny, then records the denial and declines the incident", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    const proposal = await core.decisions.propose(controller, recommendationId, "approve", "");
    await expect(core.decisions.review(dutyManager, proposal.id, "deny", " ")).rejects.toThrow(ProposalRefused);

    const denied = await core.decisions.review(dutyManager, proposal.id, "deny", "Hospital stop would be missed");
    expect(denied).toMatchObject({ status: "denied", reason: "Hospital stop would be missed", reviewedBy: dutyManager });
    await core.bus.dispatch();
    expect(await auditTypes(disruptionId)).toEqual(
      expect.arrayContaining(["proposal.denied", "disruption.declined"]),
    );
    expect(await core.store.read((tx) => core.disruptions.status(tx, disruptionId))).toBe("declined");
    const decision = await core.store.read((tx) => core.decisions.forRecommendation(tx, recommendationId));
    expect(decision).toBeUndefined();
    // The denial stays on record, and the closed incident cannot be proposed on again.
    expect(await core.store.read((tx) => core.decisions.latestProposal(tx, recommendationId))).toMatchObject({
      id: proposal.id,
      status: "denied",
    });
    await expect(core.decisions.propose(controller, recommendationId, "reject", "")).rejects.toThrow(/was declined/);
  });

  it("refuses a review of a proposal that is no longer pending", async () => {
    const { recommendationId } = await reportAndRecommend();
    const proposal = await core.decisions.propose(controller, recommendationId, "approve", "");
    await core.decisions.review(dutyManager, proposal.id, "approve", "");
    await expect(core.decisions.review(dutyManager, proposal.id, "deny", "too late")).rejects.toThrow(
      /has already been approved/,
    );
  });

  it("refuses a proposer who reviews their own proposal, even when they also hold decide", async () => {
    const { recommendationId, disruptionId } = await reportAndRecommend();
    // Separation of duties is enforced in code, so give the duty manager the maker right as well.
    await core.store.transaction((tx) => core.access.grant(tx, administrator, "duty-manager", "propose"));
    const proposal = await core.decisions.propose(dutyManager, recommendationId, "approve", "");
    await expect(core.decisions.review(dutyManager, proposal.id, "approve", "")).rejects.toThrow(
      /cannot review their own proposal/,
    );
    expect(await auditTypes(disruptionId)).toContain("proposal.refused");
  });
});
