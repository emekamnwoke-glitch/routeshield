import type { TrailEntry } from "../workspace/service";

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

/** A person by role; a component acting on its own, or no actor, is "System". */
export const actorName = (actor: string | null): string => (actor === null || COMPONENT[actor] ? "System" : (PERSONA[actor] ?? actor));

/** One row of the trail: a run of the same event from the same component and actor collapses into one row. */
export type TrailRow = { first: number; last: number; type: string; component: string; actor: string | null; at: string; count: number; seqs: number[] };

/** Rows newest first, as the trail arrives; a run of 13 notices becomes "27–39 · Passenger notice issued (13)". */
export function trailRows(trail: TrailEntry[]): TrailRow[] {
  const rows: TrailRow[] = [];
  for (const e of trail) {
    const prev = rows.at(-1);
    if (prev && prev.type === e.type && prev.component === e.component && prev.actor === e.actor && prev.first === e.seq + 1) {
      prev.first = e.seq;
      prev.count += 1;
      prev.seqs.push(e.seq);
    } else {
      rows.push({ first: e.seq, last: e.seq, type: e.type, component: e.component, actor: e.actor, at: e.at, count: 1, seqs: [e.seq] });
    }
  }
  return rows;
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
