import type { Json } from "../../../src/core/kernel/primitives";
import { incidentTitle } from "../incidents/incidents";
import { listJoin, routeCodes } from "../review/queue";
import type { DisruptionView, TrailEntry } from "../workspace/service";

/** The audit trail's filters (Figma frame E). Every event type the core records falls in exactly one. */
export type TrailCategory = "assessment" | "decisions" | "service" | "authority";

export const CATEGORIES: readonly TrailCategory[] = ["assessment", "decisions", "service", "authority"];

export const CATEGORY_LABEL: Record<TrailCategory | "all", string> = {
  all: "All",
  assessment: "Assessment",
  decisions: "Decisions",
  service: "Service and notices",
  authority: "Authority",
};

/** Plain words for each event type. An unknown type falls back to its own name. */
const ACTION: Record<string, string> = {
  "disruption.declared": "Disruption declared",
  "disruption.declined": "Disruption declined",
  "snapshot.frozen": "Evidence snapshot frozen",
  "impact.assessed": "Impact assessed",
  "options.generated": "Bypass options generated",
  "recommendation.issued": "Recommendation issued",
  "proposal.submitted": "Proposal submitted",
  "proposal.approved": "Proposal approved",
  "proposal.denied": "Proposal denied",
  "proposal.refused": "Proposal refused",
  "decision.made": "Decision made",
  "decision.refused": "Decision refused",
  "service_state.changed": "Service state changed",
  "notice.issued": "Passenger notice issued",
  "authority.granted": "Authority granted",
  "authority.revoked": "Authority revoked",
  "event.dead_lettered": "Event not delivered",
};

export const actionName = (type: string): string => ACTION[type] ?? type;

export function categoryOf(type: string): TrailCategory {
  const head = type.split(".")[0];
  if (head === "proposal" || head === "decision") return "decisions";
  if (head === "service_state" || head === "notice") return "service";
  if (head === "authority") return "authority";
  return "assessment";
}

/** The core's application components, by the id the ledger records. */
const COMPONENT: Record<string, string> = {
  "AC-01": "Source Gateway",
  "AC-02": "Disruption Manager",
  "AC-04": "Impact Assessor",
  "AC-05": "Route Optimiser",
  "AC-06": "Decision Support",
  "AC-07": "Decision Manager",
  "AC-08": "Service State",
  "AC-09": "Communication Hub",
  "AC-10": "Contingency Library",
  "AC-11": "Audit Ledger",
  "AC-12": "Service Analytics",
  "AC-14": "Access Control",
};

/** "AC-07" becomes "AC-07 Decision Manager". */
export const componentName = (id: string): string => (COMPONENT[id] ? `${id} ${COMPONENT[id]}` : id);

const PERSONA: Record<string, string> = {
  controller: "Controller",
  "duty-manager": "Duty manager",
  administrator: "Administrator",
  "contingency-approver": "Contingency approver",
};

/** A person by role; a component acting on its own is "System"; an event with no actor is "Not recorded". */
export const actorName = (actor: string | null): string =>
  actor === null ? "Not recorded" : COMPONENT[actor] ? "System" : (PERSONA[actor] ?? actor);

/**
 * One row of the trail: a run of the same event from the same component and actor collapses into one row
 * ("Authority granted (5)", one for each role). The row keeps the newest event's id, subject and payload.
 */
export type TrailRow = {
  first: number;
  last: number;
  type: string;
  component: string;
  actor: string | null;
  at: string;
  count: number;
  seqs: number[];
  eventId: string;
  subject: string;
  payload: Json;
};

/** Rows newest first, as the trail arrives; a run of 13 notices becomes "27–39 · Passenger notice issued (13)". */
export function trailRows(trail: TrailEntry[]): TrailRow[] {
  const rows: TrailRow[] = [];
  for (const e of trail) {
    const prev = rows.at(-1);
    if (
      prev &&
      prev.type === e.type &&
      prev.component === e.component &&
      prev.actor === e.actor &&
      prev.first === e.seq + 1
    ) {
      prev.first = e.seq;
      prev.count += 1;
      prev.seqs.push(e.seq);
    } else {
      rows.push({
        first: e.seq,
        last: e.seq,
        type: e.type,
        component: e.component,
        actor: e.actor,
        at: e.at,
        count: 1,
        seqs: [e.seq],
        eventId: e.id,
        subject: e.subject,
        payload: e.payload,
      });
    }
  }
  return rows;
}

/** A row's action as the trail lists it: "Decision made: approve" names the verdict. */
export function rowTitle(row: TrailRow): string {
  const verdict = field(row.payload, "verdict");
  return `${actionName(row.type)}${row.type === "decision.made" && typeof verdict === "string" ? `: ${verdict}` : ""}`;
}

const field = (payload: Json, key: string): Json | undefined =>
  payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload[key] : undefined;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the event panel shows for a row (Figma frame E). */
export type EventDetail = {
  /** "Decision made: approve". */
  title: string;
  facts: [string, string][];
  /** The other events about the same incident in the same phase, oldest first. */
  related: TrailRow[];
  /** The disruption the event is about, when it is still listed: "Open incident" opens it. */
  incidentId: string | null;
};

/**
 * An event in plain words: the incident it is about, the verdict, the bypasses and the reason recorded,
 * all read from what the ledger holds. An event with none of these (authority, assessment) lists its
 * action, component and actor instead.
 */
export function eventDetail(row: TrailRow, rows: TrailRow[], disruptions: DisruptionView[]): EventDetail {
  const d = disruptions.find((x) => x.id === row.subject) ?? null;
  const verdict = field(row.payload, "verdict");
  const items = field(row.payload, "items");
  const reason = field(row.payload, "reason");
  const facts: [string, string][] = [];
  if (d) facts.push(["Incident", incidentTitle(d)]);
  if (typeof verdict === "string") facts.push(["Verdict", verdict.charAt(0).toUpperCase() + verdict.slice(1)]);
  if (Array.isArray(items)) {
    const routes = d ? routeCodes(d) : [];
    facts.push(["Bypasses", `${plural(items.length, "route pattern")}${routes.length ? ` on ${listJoin(routes)}` : ""}`]);
  }
  if (typeof reason === "string" && reason) {
    // A decision made on review records "approved proposal prp_…": name the proposal's own event instead.
    const proposalId = /^approved proposal (\S+)$/.exec(reason)?.[1];
    const proposed = proposalId
      ? rows.find((r) => r.type === "proposal.submitted" && field(r.payload, "proposalId") === proposalId)
      : undefined;
    facts.push([
      "Reason recorded",
      proposed ? `Approved the ${actorName(proposed.actor).toLowerCase()}'s proposal (event #${proposed.first})` : reason,
    ]);
  }
  if (facts.length <= (d ? 1 : 0)) {
    facts.push(["Action", actionName(row.type)], ["Component", componentName(row.component)], ["Actor", actorName(row.actor)]);
  }
  const phase = (r: TrailRow) => (categoryOf(r.type) === "assessment" ? "assessment" : "after");
  const related = rows.filter((r) => r !== row && r.subject === row.subject && phase(r) === phase(row)).reverse();
  return {
    title: rowTitle(row),
    facts,
    related,
    incidentId: d?.id ?? null,
  };
}

export const rowLabel = (r: TrailRow): string => (r.count > 1 ? `${r.first}–${r.last}` : String(r.first));

export function countByCategory(rows: TrailRow[]): Record<TrailCategory | "all", number> {
  const out = { all: 0, assessment: 0, decisions: 0, service: 0, authority: 0 };
  for (const r of rows) {
    out.all += r.count;
    out[categoryOf(r.type)] += r.count;
  }
  return out;
}
