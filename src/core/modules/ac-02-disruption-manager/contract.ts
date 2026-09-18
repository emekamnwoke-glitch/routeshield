import type { Circle } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

export const DISRUPTION_VERSIONED = "disruption.versioned";

/** A disruption is described by versions; each is a static footprint plus a time window (ADR-0005, A-007). */
export type DisruptionVersion = {
  id: string;
  disruptionId: string;
  version: number;
  footprint: Circle;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
};

export type DisruptionSummary = {
  id: string;
  status: "reported" | "confirmed" | "cleared";
  createdAt: string;
  latest: DisruptionVersion;
};

export type DisruptionVersionedPayload = { disruptionId: string; versionId: string; version: number };

/** AC-02 Disruption Manager: sole writer of DD-4. */
export interface DisruptionManager {
  version(tx: Tx, versionId: string): DisruptionVersion | undefined;
  /** Every disruption with its latest version, newest first. */
  list(tx: Tx): DisruptionSummary[];
}
