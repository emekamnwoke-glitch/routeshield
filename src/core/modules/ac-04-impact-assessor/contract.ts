import type { Tx } from "../../kernel/store";

export const IMPACT_ASSESSED = "impact.assessed";

/** How a pattern is cut by a disruption. Stops are positions in the pattern's stop sequence. */
export type AffectedPattern = {
  patternIndex: number;
  patternId: string;
  routeCode: string;
  direction: number;
  trips: number;
  /** First and last path indexes that run over a blocked edge. */
  blockedFrom: number;
  blockedTo: number;
  /** Stops on the blocked stretch. */
  stopsInside: number[];
  /** The last stop before the blocked stretch, where a bus could leave the pattern. */
  divertStop: number | null;
  /** The first stop after it, where a bus could rejoin. */
  rejoinStop: number | null;
};

export type VehicleRelation = "approaching" | "inside" | "past";

export type AffectedVehicle = { vehicle: string; patternIndex: number; relation: VehicleRelation };

/** DD-5a. An assessment belongs to one disruption version and one snapshot (ADR-0004). */
export type ImpactAssessment = {
  id: string;
  disruptionId: string;
  versionId: string;
  snapshotId: string;
  networkVersion: string;
  /** Undirected road graph edges the footprint blocks. */
  blockedEdges: number[];
  patterns: AffectedPattern[];
  vehicles: AffectedVehicle[];
  affectedTrips: number;
  assessedAt: string;
};

export type ImpactAssessedPayload = { assessmentId: string; disruptionId: string; versionId: string };

/** AC-04 Impact Assessor: sole writer of DD-5a. */
export interface ImpactAssessor {
  assessment(tx: Tx, id: string): ImpactAssessment | undefined;
}
