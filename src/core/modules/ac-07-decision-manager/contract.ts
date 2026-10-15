import type { Actor } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

export const DECISION_MADE = "decision.made";

export type Verdict = "approve" | "reject";

/** DD-6. A decision approves or rejects a whole recommendation. */
export type Decision = {
  id: string;
  recommendationId: string;
  disruptionId: string;
  verdict: Verdict;
  decidedBy: Actor;
  decidedAt: string;
};

export type DecisionMadePayload = {
  decisionId: string;
  disruptionId: string;
  verdict: Verdict;
  /** The option taken for each affected pattern. */
  items: { patternIndex: number; optionId: string; optionKind: string }[];
};

export type ProposalStatus = "pending" | "approved" | "denied";

export type ReviewOutcome = "approve" | "deny";

/**
 * The maker-checker step (ADR-0017). A controller proposes a verdict on a recommendation; a duty manager approves
 * it, which makes the decision, or denies it with a reason. Nothing reaches a decision without a proposal.
 */
export type Proposal = {
  id: string;
  recommendationId: string;
  disruptionId: string;
  verdict: Verdict;
  proposedBy: Actor;
  proposedAt: string;
  status: ProposalStatus;
  reviewedBy: Actor | null;
  reviewedAt: string | null;
  reason: string | null;
};

/** AC-07 Decision Manager: sole writer of DD-6 and of proposals. Verifies authority at decision time (AR-006). */
export interface DecisionManager {
  decide(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Decision>;
  decision(tx: Tx, id: string): Decision | undefined;
  forRecommendation(tx: Tx, recommendationId: string): Decision | undefined;
  propose(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Proposal>;
  review(actor: Actor, proposalId: string, outcome: ReviewOutcome, reason: string): Promise<Proposal>;
  proposal(tx: Tx, id: string): Proposal | undefined;
  latestProposal(tx: Tx, recommendationId: string): Proposal | undefined;
  proposals(tx: Tx): Proposal[];
}

/** Raised after a refused decision has been recorded in the audit chain. */
export class DecisionRefused extends Error {
  override readonly name = "DecisionRefused";
}

/** Raised when a proposal or a review is refused. Authority refusals are recorded in the audit chain first. */
export class ProposalRefused extends Error {
  override readonly name = "ProposalRefused";
}
