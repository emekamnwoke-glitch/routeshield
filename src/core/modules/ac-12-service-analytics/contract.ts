import type { Tx } from "../../kernel/store";

export type EventCount = { type: string; component: string; count: number };

/**
 * AC-12 Service Analytics: sole writer of DD-12, which it derives from the
 * audit record alone. It holds service and decision outcomes, never
 * individual driver behaviour (BR-042, INV-12).
 */
export interface ServiceAnalytics {
  refresh(): Promise<void>;
  eventCounts(tx: Tx): EventCount[];
}
