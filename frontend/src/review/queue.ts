import type { ProposalStatus } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { DisruptionView, NoticeItem } from "../workspace/service";

/**
 * One row of the duty manager's review queue.
 *
 * A pending or approved proposal still has its disruption, so the row opens the review drawer.
 * A denied proposal declines its incident (CH-012): the disruption is gone and only the
 * noticeboard line remains, so the row shows that line and opens nothing.
 */
export type QueueRow =
  | { kind: "open"; id: string; status: ProposalStatus; d: DisruptionView }
  | { kind: "closed"; id: string; status: "denied"; text: string };

export const FILTERS: readonly ProposalStatus[] = ["pending", "approved", "denied"];

export const FILTER_LABEL: Record<ProposalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

/** Status chip wording and tone (ADR-0021 status roles). Colour is never the only signal: the label carries it. */
export const STATUS_CHIP: Record<ProposalStatus, { label: string; tone: "attention" | "in-effect" | "closed" }> = {
  pending: { label: "Pending review", tone: "attention" },
  approved: { label: "Approved", tone: "in-effect" },
  denied: { label: "Denied", tone: "closed" },
};

/** Every proposal the duty manager can see, newest disruption first. */
export function queueRows(disruptions: DisruptionView[], noticeboard: NoticeItem[]): QueueRow[] {
  const open: QueueRow[] = disruptions
    .filter((d) => d.proposal)
    .map((d) => ({ kind: "open" as const, id: d.proposal?.id ?? d.id, status: d.proposal?.status ?? "pending", d }))
    .reverse();
  const shown = new Set(open.map((r) => r.id));
  const closed: QueueRow[] = noticeboard
    .filter((n) => n.tone === "denied" && !shown.has(n.id))
    .map((n) => ({ kind: "closed" as const, id: n.id, status: "denied" as const, text: n.text }));
  return [...open, ...closed];
}

export function countByStatus(rows: QueueRow[]): Record<ProposalStatus, number> {
  const out: Record<ProposalStatus, number> = { pending: 0, approved: 0, denied: 0 };
  for (const r of rows) out[r.status] += 1;
  return out;
}

/** J and K move the selection down and up without wrapping, as in a mail list. */
export function moveSelection(index: number, key: string, count: number): number {
  if (count <= 0) return -1;
  if (key === "j" || key === "J" || key === "ArrowDown") return Math.min(index + 1, count - 1);
  if (key === "k" || key === "K" || key === "ArrowUp") return Math.max(index - 1, 0);
  return index;
}

/** Route codes in network order, each once: "E1 E2 F1 F2". */
export function routeCodes(d: DisruptionView): string[] {
  return [...new Set(d.impact?.patterns.map((p) => p.routeCode) ?? [])];
}

/** "E1", "E1 and E2", "E1, E2, F1 and F2". */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What the review drawer says about a proposal: the ask, and what approving it does. */
export function proposalText(d: DisruptionView): { ask: string; approve: string; confirmTitle: string; consequence: string } {
  const p = d.proposal;
  const changes = d.recommendation?.items.length ?? 0;
  const routes = listJoin(routeCodes(d));
  const who = p?.proposedBy === "controller" ? "Controller" : (p?.proposedBy ?? "Someone");
  if (p?.verdict === "reject") {
    return {
      ask: `${who} proposes: reject the recommendation. No route changes.`,
      approve: "Approve rejection",
      confirmTitle: "Approve the rejection?",
      consequence: "Approving rejects the recommendation: no route changes and no passenger notices. It is recorded in the audit trail.",
    };
  }
  return {
    ask: `${who} proposes: approve ${changes === 1 ? "the suggested bypass" : `all ${changes} suggested bypasses`}.`,
    approve: `Approve ${plural(changes, "change")}`,
    confirmTitle: `Approve ${plural(changes, "route change")}?`,
    // As Figma frame A: "Approving diverts E1, E2, F1 and F2 and issues 13 passenger notices." One notice per change.
    consequence: `Approving ${
      d.recommendation?.items.every((i) => i.kind === "reroute") ? "diverts" : "changes service on"
    } ${routes || "the affected routes"} and issues ${plural(changes, "passenger notice")}. It is recorded in the audit trail.`,
  };
}
