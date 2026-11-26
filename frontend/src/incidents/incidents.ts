import { listJoin, routeCodes } from "../review/queue";
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

export type Chip = { label: string; tone: "attention" | "in-effect" | "closed"; icon: "clock" | "check" | "minus" };

/** An incident's status chip (prototype P3, P4 and P9): the label always carries the meaning, not the colour. */
export function stageChip(d: DisruptionView): Chip {
  const stage = stageOf(d);
  if (stage === "needs") return { label: "Needs proposal", tone: "attention", icon: "clock" };
  if (stage === "awaiting") return { label: "Pending review", tone: "attention", icon: "clock" };
  if (d.status === "declined") return { label: "Denied", tone: "closed", icon: "minus" };
  if (!d.decision) return { label: "Nothing to decide", tone: "closed", icon: "minus" };
  return d.decision.verdict === "approve"
    ? { label: "Approved", tone: "in-effect", icon: "check" }
    : { label: "Rejected", tone: "closed", icon: "minus" };
}

/** The panel's eyebrow: "INCIDENT · NEEDS A PROPOSAL", "INCIDENT · AWAITING REVIEW", "INCIDENT · IN EFFECT". */
export function stageEyebrow(d: DisruptionView): string {
  const stage = stageOf(d);
  if (stage === "needs") return "INCIDENT · NEEDS A PROPOSAL";
  if (stage === "awaiting") return "INCIDENT · AWAITING REVIEW";
  if (d.status === "declined") return "INCIDENT · DECLINED";
  return d.decision?.verdict === "approve" && d.serviceStates.length ? "INCIDENT · IN EFFECT" : "INCIDENT · DECIDED";
}

export function stageOf(d: DisruptionView): IncidentStage {
  if (d.decision || d.status === "declined") return "decided";
  if (d.proposal?.status === "pending") return "awaiting";
  if (!d.recommendation || d.recommendation.items.length === 0) return d.impact ? "decided" : "needs";
  return "needs";
}

/**
 * Newest first, open incidents then declined ones. A declined incident stays listed under Decided, read-only, as the
 * duty manager's queue keeps it: the prototype (P11) dropped it while still counting it (Jane's review, 26 Nov 2026).
 */
export const incidentRows = (disruptions: DisruptionView[], declined: DisruptionView[] = []): DisruptionView[] => [
  ...[...disruptions].reverse(),
  ...[...declined].reverse(),
];

/** Counts for the filter chips: each one is the number of rows its filter shows. */
export function countByStage(rows: DisruptionView[]): Record<IncidentStage, number> {
  const out: Record<IncidentStage, number> = { needs: 0, awaiting: 0, decided: 0 };
  for (const d of rows) out[stageOf(d)] += 1;
  return out;
}

/** The filter a list opens on: the given incident's, else the newest incident's (a declined one after a denial). */
export function landingStage(rows: DisruptionView[], openId: string | null = null): IncidentStage {
  const start = rows.find((r) => r.id === openId) ?? rows[0];
  return start ? stageOf(start) : "needs";
}

const STATE_LABEL: Record<string, string> = { diverted: "Diverted", held: "Held", contingency: "Contingency" };

/** "Service now" (prototype P7 and P9): each route once, with what it is doing now. */
export function serviceNow(d: DisruptionView): { routeCode: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const s of d.serviceStates) if (!seen.has(s.routeCode)) seen.set(s.routeCode, STATE_LABEL[s.state] ?? s.state);
  return [...seen].map(([routeCode, label]) => ({ routeCode, label }));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "E1, E2, F1 and F2 are diverted and 13 passenger notices were issued." */
function outcome(d: DisruptionView): string {
  const routes = listJoin(routeCodes(d));
  const diverted = d.serviceStates.length > 0 && d.serviceStates.every((s) => s.state === "diverted");
  const notices = `${plural(d.notices.length, "passenger notice")} ${d.notices.length === 1 ? "was" : "were"} issued`;
  return `${routes} ${routeCodes(d).length === 1 ? "is" : "are"} ${diverted ? "diverted" : "changed"} and ${notices}.`;
}

const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** The foot of a decided incident's panel, for whoever is reading it. */
export function decidedText(d: DisruptionView, by: "you" | "the duty manager"): string {
  if (d.status === "declined") {
    return `Denied by ${by}. Reason: ${sentence(d.proposal?.reason ?? "none given")} The incident is declined and closed; no routes changed and no notices were issued.`;
  }
  if (!d.decision) return "No route runs through this closure, so there is nothing to decide.";
  if (d.decision.verdict === "reject") return `Rejected by ${by}. No routes changed and no notices were issued.`;
  return `Approved by ${by}. ${outcome(d)}${by === "you" ? " Recorded in the audit trail." : ""}`;
}

/** One line of My proposals (prototype P4, P9 and P11). */
export type ProposalLine = {
  id: string;
  disruption: DisruptionView;
  chip: Chip;
  /** "Approve all 13 bypasses · O'Connell St Upper". */
  text: string;
  /** For a denial: the reason, and how to resubmit. */
  reason: string | null;
};

/** The controller's proposals, newest first, from the incidents and the declined ones. */
export function proposalLines(disruptions: DisruptionView[], declined: DisruptionView[]): ProposalLine[] {
  return [...disruptions, ...declined]
    .filter((d) => d.proposal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => {
      const p = d.proposal;
      const n = d.recommendation?.items.length ?? 0;
      const what = p?.verdict === "reject" ? "Reject the recommendation" : `Approve all ${n} ${n === 1 ? "bypass" : "bypasses"}`;
      const status = p?.status ?? "pending";
      const chip: Chip =
        status === "pending"
          ? { label: "Pending review", tone: "attention", icon: "clock" }
          : status === "approved"
            ? { label: "Approved", tone: "in-effect", icon: "check" }
            : { label: "Denied", tone: "closed", icon: "minus" };
      return {
        id: p?.id ?? d.id,
        disruption: d,
        chip,
        text: `${what} · ${status === "pending" ? placeName(d) : status}`,
        reason: status === "denied" ? `Reason: ${sentence(p?.reason ?? "none given")} To resubmit, report the incident again.` : null,
      };
    });
}

/** A row's name: the street the closure is on, or its coordinates where no named bus road is near. */
export const placeName = (d: DisruptionView): string =>
  d.place ?? `${d.footprint.lat.toFixed(4)}, ${d.footprint.lon.toFixed(4)}`;

/** A panel's title, as Figma frame D: "O'Connell St Upper, 150 m closure". */
export const incidentTitle = (d: DisruptionView): string =>
  d.place ? `${d.place}, ${d.footprint.radiusM} m closure` : `${d.footprint.radiusM} m closure`;

/** "08:00" from an ISO time, in the scenario's own clock (UTC, as the core records it). */
export const clock = (iso: string, seconds = false): string => iso.slice(11, seconds ? 19 : 16);

/**
 * The moment the scene shows (Figma frames A, D and E). Vehicle positions come from the timetable at this
 * moment, so an incident is reported against it: "Reported Mon 08:00". The audit trail keeps real times.
 */
export const SCENARIO_TIME = { day: "Mon", time: "08:00" } as const;

const SHORT: [RegExp, string][] = [
  [/\bStreet\b/g, "St"],
  [/\bSquare\b/g, "Sq"],
  [/\bRoad\b/g, "Rd"],
  [/\bAvenue\b/g, "Ave"],
  [/\b(Sq|St|Rd|Ave) East$/, "$1 E"],
  [/\b(Sq|St|Rd|Ave) West$/, "$1 W"],
  [/\b(Sq|St|Rd|Ave) North$/, "$1 N"],
  [/\b(Sq|St|Rd|Ave) South$/, "$1 S"],
];

/** A street as a sign shortens it: "Parnell Square East" is "Parnell Sq E", "D'Olier Street" is "D'Olier St". */
export const shortStreet = (name: string): string => SHORT.reduce((s, [from, to]) => s.replace(from, to), name);

/**
 * A bypass as the table names it (Figma frame D): from the street the bus leaves, to the one it rejoins.
 * The street it leaves is named without its type, as said aloud: "Westmoreland → Parnell Sq W".
 */
export const bypassName = (divert: string, rejoin: string): string =>
  `${shortStreet(divert).replace(/ (St|Rd|Ave)$/, "")} → ${shortStreet(rejoin)}`;
