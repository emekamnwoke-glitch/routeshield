import type { Tx } from "../../kernel/store";

export const RECOMMENDATION_ISSUED = "recommendation.issued";

/** Autonomy bands (autonomy model §3): observe, recommend, pre-approved contingency, manual. */
export type AutonomyBand = "A0" | "A1" | "A2" | "A3";

/** The option recommended for one affected pattern. */
export type RecommendationItem = { patternIndex: number; optionId: string };

/**
 * DD-5c. One recommendation per assessment, with one item per affected
 * pattern. Band A0 means nothing is affected: there is nothing to decide.
 */
export type Recommendation = {
  id: string;
  assessmentId: string;
  disruptionId: string;
  band: AutonomyBand;
  confidence: "high" | "medium" | "low";
  items: RecommendationItem[];
  issuedAt: string;
};

export type RecommendationIssuedPayload = { recommendationId: string; disruptionId: string; band: AutonomyBand };

/** AC-06 Decision Support: sole writer of DD-5c. */
export interface DecisionSupport {
  recommendation(tx: Tx, id: string): Recommendation | undefined;
  /** The latest recommendation issued for a disruption. */
  forDisruption(tx: Tx, disruptionId: string): Recommendation | undefined;
}
