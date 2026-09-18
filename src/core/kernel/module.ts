import type { Tx } from "./store";

/**
 * A core component (ADR-0006). It is the sole writer of the tables that carry
 * its prefix (ADR-0010), and other components reach it only through the
 * interface in its contract.ts. tools/architecture/check_boundaries.py
 * enforces both rules.
 */
export interface CoreModule {
  /** Component id from the application architecture, e.g. "AC-02". */
  readonly id: string;
  readonly name: string;
  /** Prefix of every table this module owns, e.g. "dm_". */
  readonly tablePrefix: string;
  migrate(tx: Tx): void;
}
