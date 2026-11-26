import type { ProposalStatus } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { DisruptionView } from "../workspace/service";

/**
 * One row of the duty manager's review queue. A denied proposal declines its incident (CH-012): it leaves the map
 * and the incident list, but its row stays here, and opens the drawer read-only (prototype P10).
 */
export type QueueRow = { kind: "open"; id: string; status: ProposalStatus; d: DisruptionView };

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

/** Every proposal the duty manager can see, the newest incident first, declined ones included. */
export function queueRows(disruptions: DisruptionView[], declined: DisruptionView[] = []): QueueRow[] {
  return [...disruptions, ...declined]
    .filter((d) => d.proposal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((d) => ({ kind: "open" as const, id: d.proposal?.id ?? d.id, status: d.proposal?.status ?? "pending", d }));
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

/** The deny dialog: a denial is as final as an approval, so it asks first too (Jane's review, 26 Nov 2026). */
export const DENY_CONFIRM = {
  title: "Deny this proposal?",
  body: "This declines and closes the incident: no routes change and no notices are issued. Your reason goes to the controller and is recorded in the audit trail under your name.",
  action: "Deny and close incident",
} as const;

/** What the review drawer says about a proposal: the ask, and what approving it does. */
export function proposalText(d: DisruptionView): {
  ask: string;
  approve: string;
  confirmTitle: string;
  /** The approve dialog's body (prototype P6). */
  confirmBody: string;
  consequence: string;
} {
  const p = d.proposal;
  const changes = d.recommendation?.items.length ?? 0;
  const routes = listJoin(routeCodes(d));
  const who = p?.proposedBy === "controller" ? "Controller" : (p?.proposedBy ?? "Someone");
  if (p?.verdict === "reject") {
    return {
      ask: `${who} proposes: reject the recommendation. No route changes.`,
      approve: "Approve rejection",
      confirmTitle: "Approve the rejection?",
      confirmBody: "This rejects the recommendation: no route changes and no passenger notices. The approval is recorded in the audit trail under your name.",
      consequence: "Approving rejects the recommendation: no route changes and no passenger notices. It is recorded in the audit trail.",
    };
  }
  return {
    ask: `${who} proposes: approve ${changes === 1 ? "the suggested bypass" : `all ${changes} suggested bypasses`}.`,
    approve: `Approve ${plural(changes, "change")}`,
    confirmTitle: `Approve ${plural(changes, "route change")}?`,
    confirmBody: `This ${
      d.recommendation?.items.every((i) => i.kind === "reroute") ? "diverts" : "changes service on"
    } ${routes || "the affected routes"} and issues ${plural(changes, "passenger notice")}. The approval is recorded in the audit trail under your name.`,
    // As Figma frame A: "Approving diverts E1, E2, F1 and F2 and issues 13 passenger notices." One notice per change.
    consequence: `Approving ${
      d.recommendation?.items.every((i) => i.kind === "reroute") ? "diverts" : "changes service on"
    } ${routes || "the affected routes"} and issues ${plural(changes, "passenger notice")}. It is recorded in the audit trail.`,
  };
}
