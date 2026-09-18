import type { Network } from "../../kernel/network";
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

/** data/fixtures/scenario/fleet.json: fictional vehicles placed from the timetable. */
export type FleetScene = {
  format: "routeshield-fleet-scene/1";
  serviceDate: string;
  time: string;
  vehicles: {
    vehicle: string;
    trip: string;
    pattern: number;
    alongM: number;
    pathIndex: number;
    offsetM: number;
    nextStop: number;
    location: [number, number];
  }[];
};

/** A vehicle as the (fictional) Reference Vehicle GPS Platform last reported it. */
export type VehiclePosition = {
  vehicle: string;
  trip: string;
  pattern: number;
  pathIndex: number;
  offsetM: number;
  lat: number;
  lon: number;
  observedAt: string;
};

/**
 * AC-01 Source Gateway: the only component that talks to sourced systems. It
 * keeps the read-only cache and records source health (DD-10). It reports
 * what sources said; it does not decide that something is a disruption.
 */
export interface SourceGateway {
  reportIncident(report: IncidentReport): Promise<string>;
  incident(tx: Tx, id: string): (IncidentReport & { id: string; receivedAt: string }) | undefined;
  health(tx: Tx): SourceHealth[];
  /** The published network, or undefined when none is loaded. */
  network(): Network | undefined;
  positions(tx: Tx): VehiclePosition[];
}
