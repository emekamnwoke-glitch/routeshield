import type { Tx } from "../../kernel/store";

export const RECOMMENDATION_ISSUED = "recommendation.issued";

/** Autonomy bands (autonomy model §3): observe, recommend, pre-approved contingency, manual. */
export type AutonomyBand = "A0" | "A1" | "A2" | "A3";

/** DD-5c. */
export type Recommendation = {
  id: string;
  assessmentId: string;
  disruptionId: string;
  optionId: string;
  band: AutonomyBand;
  confidence: "high" | "medium" | "low";
  issuedAt: string;
};

export type RecommendationIssuedPayload = { recommendationId: string; disruptionId: string; band: AutonomyBand };

/** AC-06 Decision Support: sole writer of DD-5c. */
export interface DecisionSupport {
  recommendation(tx: Tx, id: string): Recommendation | undefined;
}
