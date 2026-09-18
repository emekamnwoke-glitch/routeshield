import type { Circle } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

export const INCIDENT_REPORTED = "source.incident_reported";

/** What a (fictional) incident source said, before anyone has interpreted it. */
export type IncidentReport = {
  source: string;
  externalRef: string;
  area: Circle;
  description: string;
};

export type IncidentReportedPayload = { incidentId: string };

export type SourceHealth = { source: string; lastSeenAt: string; status: "fresh" | "stale" | "unavailable" };

/**
 * AC-01 Source Gateway: the only component that talks to sourced systems. It
 * keeps the read-only cache and records source health (DD-10). It reports
 * what sources said; it does not decide that something is a disruption.
 */
export interface SourceGateway {
  reportIncident(report: IncidentReport): Promise<string>;
  incident(tx: Tx, id: string): (IncidentReport & { id: string; receivedAt: string }) | undefined;
  health(tx: Tx): SourceHealth[];
}
