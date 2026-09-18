import type { Actor } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

export const DECISION_MADE = "decision.made";

export type Verdict = "approve" | "reject";

/** DD-6. */
export type Decision = {
  id: string;
  recommendationId: string;
  disruptionId: string;
  verdict: Verdict;
  optionId: string;
  decidedBy: Actor;
  decidedAt: string;
};

export type DecisionMadePayload = {
  decisionId: string;
  disruptionId: string;
  verdict: Verdict;
  optionId: string;
  optionKind: string;
};

/** AC-07 Decision Manager: sole writer of DD-6. Verifies authority at decision time (AR-006). */
export interface DecisionManager {
  decide(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Decision>;
  decision(tx: Tx, id: string): Decision | undefined;
  forRecommendation(tx: Tx, recommendationId: string): Decision | undefined;
}

/** Raised after a refused decision has been recorded in the audit chain. */
export class DecisionRefused extends Error {
  override readonly name = "DecisionRefused";
}
