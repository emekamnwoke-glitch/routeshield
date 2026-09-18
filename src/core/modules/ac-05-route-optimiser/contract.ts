import type { Tx } from "../../kernel/store";

export const OPTIONS_GENERATED = "options.generated";

/**
 * DD-5b. One response for one affected pattern. "hold" keeps vehicles where
 * they are until the road reopens; "reroute" leaves the pattern at the divert
 * stop and rejoins at the rejoin stop; "contingency" uses a pre-approved route.
 */
export type ResponseOption = {
  id: string;
  assessmentId: string;
  patternIndex: number;
  kind: "hold" | "reroute" | "contingency";
  /** Stops (positions in the pattern's stop sequence) the option does not serve. */
  stopsLost: number[];
  divertStop: number | null;
  rejoinStop: number | null;
  /** Extra distance against the planned path between divert and rejoin, in metres. */
  extraM: number;
  /** The bypass as directed road graph edges, from the divert stop's edge to the rejoin stop's edge. */
  detour: number[];
  contingencyRouteId: string | null;
};

export type OptionsGeneratedPayload = { assessmentId: string; disruptionId: string; options: number };

/**
 * AC-05 Route Optimiser: sole writer of DD-5b. v1.2.0 runs one divert and
 * rejoin pair per pattern in the core worker; v1.3.0 moves the search to its
 * own worker with a time budget and ranks several pairs (ADR-0006, ADR-0014).
 */
export interface RouteOptimiser {
  options(tx: Tx, assessmentId: string): ResponseOption[];
}
