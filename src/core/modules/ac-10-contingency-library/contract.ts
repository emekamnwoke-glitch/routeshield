import type { Tx } from "../../kernel/store";

/** DD-9. A pre-approved route for a known disruption; activating one is autonomy band A2 (ADR-0017). */
export type ContingencyRoute = {
  id: string;
  version: number;
  patternId: string;
  approvedBy: string;
  expiresAt: string;
};

/** AC-10 Contingency Library: sole writer of DD-9. */
export interface ContingencyLibrary {
  /** Approved, unexpired routes that could answer this disruption version. */
  candidates(tx: Tx, disruptionVersionId: string): ContingencyRoute[];
}
