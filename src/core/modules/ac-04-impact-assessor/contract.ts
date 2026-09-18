import type { Tx } from "../../kernel/store";

export const IMPACT_ASSESSED = "impact.assessed";

/** DD-5a. An assessment belongs to one disruption version and one snapshot (ADR-0004). */
export type ImpactAssessment = {
  id: string;
  disruptionId: string;
  versionId: string;
  snapshotId: string;
  affectedTrips: number;
  assessedAt: string;
};

export type ImpactAssessedPayload = { assessmentId: string; disruptionId: string; versionId: string };

/** AC-04 Impact Assessor: sole writer of DD-5a. */
export interface ImpactAssessor {
  assessment(tx: Tx, id: string): ImpactAssessment | undefined;
}
