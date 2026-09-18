import type { Tx } from "../../kernel/store";

export const OPTIONS_GENERATED = "options.generated";

/** DD-5b. "hold" keeps the vehicle where it is; "contingency" uses a pre-approved route. */
export type ResponseOption = {
  id: string;
  assessmentId: string;
  kind: "hold" | "reroute" | "contingency";
  stopsLost: number;
  contingencyRouteId: string | null;
};

export type OptionsGeneratedPayload = { assessmentId: string; disruptionId: string; options: number };

/**
 * AC-05 Route Optimiser: sole writer of DD-5b. The search itself will run in
 * its own worker with a time budget (ADR-0006); this module records the result.
 */
export interface RouteOptimiser {
  options(tx: Tx, assessmentId: string): ResponseOption[];
}
