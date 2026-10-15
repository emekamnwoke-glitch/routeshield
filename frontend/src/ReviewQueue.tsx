import { useState } from "react";
import type { ReviewOutcome } from "../../src/core/modules/ac-07-decision-manager/contract";
import type { DisruptionView } from "./workspace/service";

type Props = {
  /** Disruptions whose latest proposal is pending. */
  items: DisruptionView[];
  busy: boolean;
  onReview: (proposalId: string, outcome: ReviewOutcome, reason: string) => void;
};

/** The duty manager's dashboard: proposals from controllers, each to approve or deny. */
export function ReviewQueue({ items, busy, onReview }: Props) {
  return (
    <section className="queue" aria-label="Awaiting your review">
      <p>DUTY MANAGER</p>
      <h3>Awaiting your review ({items.length})</h3>
      {items.length === 0 ? (
        <p className="hint">Nothing waiting. A controller's proposal appears here.</p>
      ) : (
        <ul>
          {items.map((d) => (
            <QueueItem key={d.proposal?.id} d={d} busy={busy} onReview={onReview} />
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueItem({ d, busy, onReview }: { d: DisruptionView } & Omit<Props, "items">) {
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const proposal = d.proposal;
  if (!proposal) return null;
  const routes = [...new Set(d.impact?.patterns.map((p) => p.routeCode) ?? [])].join(", ") || "no route";
  const action = proposal.verdict === "approve" ? "approve all suggested bypasses" : "reject the recommendation";
  return (
    <li>
      <p>
        <b>{proposal.proposedBy === "controller" ? "Controller" : proposal.proposedBy}</b> proposes to {action} for{" "}
        <span className="tag">{routes}</span>
      </p>
      <p className="mono">
        {d.id.slice(0, 12)}… · {d.footprint.radiusM} m closure
      </p>
      {!denying ? (
        <div className="row">
          <button type="button" className="primary" disabled={busy} onClick={() => onReview(proposal.id, "approve", "")}>
            Approve
          </button>
          <button type="button" disabled={busy} onClick={() => setDenying(true)}>
            Deny…
          </button>
        </div>
      ) : (
        <div className="deny">
          <label>
            Reason for denial (shown to the controller)
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
          </label>
          <div className="row">
            <button
              type="button"
              className="primary"
              disabled={busy || !reason.trim()}
              onClick={() => onReview(proposal.id, "deny", reason.trim())}
            >
              Confirm denial
            </button>
            <button type="button" disabled={busy} onClick={() => setDenying(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
