import type { DisruptionView } from "../workspace/service";

/**
 * Where an incident stands for the controller (Figma frame D):
 * - "needs": a bypass is suggested and nobody has proposed a verdict, or the last proposal was denied;
 * - "awaiting": a proposal waits for the duty manager;
 * - "decided": a person decided, or nothing runs through the closure so there is nothing to decide.
 */
export type IncidentStage = "needs" | "awaiting" | "decided";

export const STAGES: readonly IncidentStage[] = ["needs", "awaiting", "decided"];

export const STAGE_LABEL: Record<IncidentStage, string> = {
  needs: "Needs proposal",
  awaiting: "Awaiting review",
  decided: "Decided",
};

/** Chip wording and tone, as the review queue's status chips: the label always carries the meaning. */
export const STAGE_CHIP: Record<IncidentStage, { label: string; tone: "attention" | "in-effect" | "closed"; icon: string }> = {
  needs: { label: "Needs proposal", tone: "attention", icon: "◷" },
  awaiting: { label: "Awaiting review", tone: "closed", icon: "◔" },
  decided: { label: "Decided", tone: "in-effect", icon: "✓" },
};

export function stageOf(d: DisruptionView): IncidentStage {
  if (d.decision) return "decided";
  if (d.proposal?.status === "pending") return "awaiting";
  if (!d.recommendation || d.recommendation.items.length === 0) return d.impact ? "decided" : "needs";
  return "needs";
}

/** Newest first, as the review queue. */
export const incidentRows = (disruptions: DisruptionView[]): DisruptionView[] => [...disruptions].reverse();

export function countByStage(rows: DisruptionView[]): Record<IncidentStage, number> {
  const out: Record<IncidentStage, number> = { needs: 0, awaiting: 0, decided: 0 };
  for (const d of rows) out[stageOf(d)] += 1;
  return out;
}

/** A row's name: the place the reporter gave, or the closure's coordinates when they gave none. */
export const placeName = (d: DisruptionView): string =>
  d.place ?? `${d.footprint.lat.toFixed(4)}, ${d.footprint.lon.toFixed(4)}`;

/** A panel's title, as Figma frame D: "O'Connell St Upper, 150 m closure". */
export const incidentTitle = (d: DisruptionView): string =>
  d.place ? `${d.place}, ${d.footprint.radiusM} m closure` : `${d.footprint.radiusM} m closure`;

/** "08:00" from an ISO time, in the scenario's own clock (UTC, as the core records it). */
export const clock = (iso: string, seconds = false): string => iso.slice(11, seconds ? 19 : 16);
