import type { Tx } from "../../kernel/store";

/** DD-8. Keyed by what caused it, so a replayed event never issues a second notice (ADR-0007). */
export type Notice = {
  id: string;
  idempotencyKey: string;
  disruptionId: string;
  channel: "passenger" | "driver";
  kind: "not_served" | "diverted" | "resumed";
  createdAt: string;
};

/** AC-09 Communication Hub: sole writer of DD-8. */
export interface CommunicationHub {
  notices(tx: Tx, disruptionId: string): Notice[];
}
