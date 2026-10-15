import type { EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Actor, Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Store, Tx } from "../../kernel/store";
import type { RouteOptimiser } from "../ac-05-route-optimiser/contract";
import type { DecisionSupport } from "../ac-06-decision-support/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { AccessControl } from "../ac-14-access-control/contract";
import type {
  Decision,
  DecisionMadePayload,
  DecisionManager,
  Proposal,
  ProposalStatus,
  ReviewOutcome,
  Verdict,
} from "./contract";
import { DECISION_MADE, DecisionRefused, ProposalRefused } from "./contract";

type DecisionRow = {
  id: string;
  recommendation_id: string;
  disruption_id: string;
  verdict: Verdict;
  decided_by: string;
  decided_at: string;
};

type ProposalRow = {
  id: string;
  recommendation_id: string;
  disruption_id: string;
  verdict: Verdict;
  proposed_by: string;
  proposed_at: string;
  status: ProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
};

const sameActor = (a: Actor, b: Actor) => a.kind === b.kind && a.id === b.id;

export class DecisionManagerModule implements CoreModule, DecisionManager {
  readonly id = "AC-07";
  readonly name = "Decision Manager";
  readonly tablePrefix = "dc_";

  constructor(
    private readonly store: Store,
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly support: DecisionSupport,
    private readonly optimiser: RouteOptimiser,
    private readonly access: AccessControl,
  ) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists dc_decision (
      id text primary key,
      recommendation_id text not null unique,
      disruption_id text not null,
      verdict text not null check (verdict in ('approve', 'reject')),
      decided_by text not null,
      decided_at text not null
    )`);
    tx.run(`create table if not exists dc_proposal (
      id text primary key,
      recommendation_id text not null,
      disruption_id text not null,
      verdict text not null check (verdict in ('approve', 'reject')),
      proposed_by text not null,
      proposed_at text not null,
      status text not null check (status in ('pending', 'approved', 'denied')),
      reviewed_by text,
      reviewed_at text,
      review_reason text
    )`);
    // At most one proposal awaiting a checker per recommendation, enforced by the store as well as by the code.
    tx.run(`create unique index if not exists dc_proposal_one_pending
      on dc_proposal (recommendation_id) where status = 'pending'`);
  }

  async decide(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Decision> {
    const outcome = await this.store.transaction((tx) => this.recordDecision(tx, actor, recommendationId, verdict, reason));
    // A refusal is committed to the audit record before it is raised.
    if ("refused" in outcome) throw new DecisionRefused(outcome.refused);
    return outcome;
  }

  /** The maker: a controller puts a verdict forward. It decides nothing until a duty manager reviews it. */
  async propose(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Proposal> {
    const outcome = await this.store.transaction(async (tx): Promise<Proposal | { refused: string }> => {
      const rec = this.support.recommendation(tx, recommendationId);
      if (!rec) return { refused: `recommendation ${recommendationId} not found` };
      if (tx.one("select 1 from dc_decision where recommendation_id = ?", [recommendationId])) {
        return { refused: `recommendation ${recommendationId} has already been decided` };
      }
      if (tx.one("select 1 from dc_proposal where recommendation_id = ? and status = 'pending'", [recommendationId])) {
        return { refused: `recommendation ${recommendationId} is already pending a duty manager's approval` };
      }
      if (rec.band === "A0") return { refused: "nothing to decide: no route is affected" };
      const authority = this.access.authorise(tx, actor, "propose");
      if (!authority.allowed) {
        await this.ledger.append(tx, {
          type: "proposal.refused",
          component: this.id,
          subject: rec.disruptionId,
          actor,
          payload: { recommendationId, verdict, reason: authority.reason },
        });
        return { refused: authority.reason };
      }
      const proposal: Proposal = {
        id: newId("prp"),
        recommendationId,
        disruptionId: rec.disruptionId,
        verdict,
        proposedBy: actor,
        proposedAt: this.clock.now(),
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        reason: null,
      };
      tx.run(
        `insert into dc_proposal (id, recommendation_id, disruption_id, verdict, proposed_by, proposed_at, status,
           reviewed_by, reviewed_at, review_reason)
         values (?, ?, ?, ?, ?, ?, 'pending', null, null, null)`,
        [proposal.id, recommendationId, rec.disruptionId, verdict, JSON.stringify(actor), proposal.proposedAt],
      );
      await this.ledger.append(tx, {
        type: "proposal.submitted",
        component: this.id,
        subject: rec.disruptionId,
        actor,
        payload: { proposalId: proposal.id, recommendationId, verdict, reason },
      });
      return proposal;
    });
    if ("refused" in outcome) throw new ProposalRefused(outcome.refused);
    return outcome;
  }

  /** The checker: a duty manager approves a proposal, which records the decision, or denies it with a reason. */
  async review(actor: Actor, proposalId: string, outcome: ReviewOutcome, reason: string): Promise<Proposal> {
    const result = await this.store.transaction(async (tx): Promise<Proposal | { refused: string }> => {
      const p = this.proposal(tx, proposalId);
      if (!p) return { refused: `proposal ${proposalId} not found` };
      if (p.status !== "pending") return { refused: `proposal ${proposalId} has already been ${p.status}` };
      if (outcome === "deny" && !reason.trim()) return { refused: "a denial needs a reason" };
      const authority = this.access.authorise(tx, actor, "decide");
      const refusal = !authority.allowed
        ? authority.reason
        : sameActor(actor, p.proposedBy)
          ? "the proposer cannot review their own proposal"
          : undefined;
      if (refusal) {
        await this.ledger.append(tx, {
          type: "proposal.refused",
          component: this.id,
          subject: p.disruptionId,
          actor,
          payload: { proposalId, outcome, reason: refusal },
        });
        return { refused: refusal };
      }
      if (outcome === "approve") {
        const made = await this.recordDecision(tx, actor, p.recommendationId, p.verdict, `approved proposal ${p.id}`);
        if ("refused" in made) return made;
      }
      const reviewedAt = this.clock.now();
      const status: ProposalStatus = outcome === "approve" ? "approved" : "denied";
      tx.run("update dc_proposal set status = ?, reviewed_by = ?, reviewed_at = ?, review_reason = ? where id = ?", [
        status,
        JSON.stringify(actor),
        reviewedAt,
        reason || null,
        proposalId,
      ]);
      await this.ledger.append(tx, {
        type: outcome === "approve" ? "proposal.approved" : "proposal.denied",
        component: this.id,
        subject: p.disruptionId,
        actor,
        payload: { proposalId, recommendationId: p.recommendationId, proposedBy: p.proposedBy.id, reason },
      });
      return { ...p, status, reviewedBy: actor, reviewedAt, reason: reason || null };
    });
    if ("refused" in result) throw new ProposalRefused(result.refused);
    return result;
  }

  decision(tx: Tx, id: string): Decision | undefined {
    return this.toDecision(tx.one<DecisionRow>("select * from dc_decision where id = ?", [id]));
  }

  forRecommendation(tx: Tx, recommendationId: string): Decision | undefined {
    return this.toDecision(
      tx.one<DecisionRow>("select * from dc_decision where recommendation_id = ?", [recommendationId]),
    );
  }

  proposal(tx: Tx, id: string): Proposal | undefined {
    return this.toProposal(tx.one<ProposalRow>("select * from dc_proposal where id = ?", [id]));
  }

  latestProposal(tx: Tx, recommendationId: string): Proposal | undefined {
    return this.toProposal(
      tx.one<ProposalRow>("select * from dc_proposal where recommendation_id = ? order by rowid desc limit 1", [
        recommendationId,
      ]),
    );
  }

  proposals(tx: Tx): Proposal[] {
    return tx.all<ProposalRow>("select * from dc_proposal order by rowid").map((r) => this.toProposal(r) as Proposal);
  }

  /**
   * Records a decision inside the caller's transaction. A refusal is appended to the audit chain and returned,
   * so the caller commits it. Used by decide directly, and by review when it approves a proposal.
   */
  private async recordDecision(
    tx: Tx,
    actor: Actor,
    recommendationId: string,
    verdict: Verdict,
    reason: string,
  ): Promise<Decision | { refused: string }> {
    const rec = this.support.recommendation(tx, recommendationId);
    if (!rec) return { refused: `recommendation ${recommendationId} not found` };
    if (tx.one("select 1 from dc_decision where recommendation_id = ?", [recommendationId])) {
      return { refused: `recommendation ${recommendationId} has already been decided` };
    }
    if (rec.band === "A0") return { refused: "nothing to decide: no route is affected" };
    // Authority is checked now, not when the recommendation was issued (AR-006).
    const authority = this.access.authorise(tx, actor, "decide");
    if (!authority.allowed) {
      await this.ledger.append(tx, {
        type: "decision.refused",
        component: this.id,
        subject: rec.disruptionId,
        actor,
        payload: { recommendationId, verdict, reason: authority.reason },
      });
      return { refused: authority.reason };
    }
    const options = new Map(this.optimiser.options(tx, rec.assessmentId).map((o) => [o.id, o]));
    const items = rec.items.map((item) => {
      const option = options.get(item.optionId);
      if (!option) throw new Error(`option ${item.optionId} not found`);
      return { patternIndex: item.patternIndex, optionId: option.id, optionKind: option.kind };
    });
    const decision: Decision = {
      id: newId("dec"),
      recommendationId,
      disruptionId: rec.disruptionId,
      verdict,
      decidedBy: actor,
      decidedAt: this.clock.now(),
    };
    tx.run(
      `insert into dc_decision (id, recommendation_id, disruption_id, verdict, decided_by, decided_at)
       values (?, ?, ?, ?, ?, ?)`,
      [
        decision.id,
        decision.recommendationId,
        decision.disruptionId,
        decision.verdict,
        JSON.stringify(actor),
        decision.decidedAt,
      ],
    );
    await this.ledger.append(tx, {
      type: "decision.made",
      component: this.id,
      subject: rec.disruptionId,
      actor,
      payload: { decisionId: decision.id, recommendationId, verdict, items, reason },
    });
    const payload: DecisionMadePayload = {
      decisionId: decision.id,
      disruptionId: rec.disruptionId,
      verdict,
      items,
    };
    this.bus.publish(tx, { type: DECISION_MADE, source: this.id, subject: rec.disruptionId, payload });
    return decision;
  }

  private toDecision(r: DecisionRow | undefined): Decision | undefined {
    return (
      r && {
        id: r.id,
        recommendationId: r.recommendation_id,
        disruptionId: r.disruption_id,
        verdict: r.verdict,
        decidedBy: JSON.parse(r.decided_by) as Actor,
        decidedAt: r.decided_at,
      }
    );
  }

  private toProposal(r: ProposalRow | undefined): Proposal | undefined {
    return (
      r && {
        id: r.id,
        recommendationId: r.recommendation_id,
        disruptionId: r.disruption_id,
        verdict: r.verdict,
        proposedBy: JSON.parse(r.proposed_by) as Actor,
        proposedAt: r.proposed_at,
        status: r.status,
        reviewedBy: r.reviewed_by ? (JSON.parse(r.reviewed_by) as Actor) : null,
        reviewedAt: r.reviewed_at,
        reason: r.review_reason,
      }
    );
  }
}
