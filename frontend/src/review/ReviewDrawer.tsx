import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewOutcome } from "../../../src/core/modules/ac-07-decision-manager/contract";
import { IncidentPanel } from "../incidents/IncidentPanel";
import { clock } from "../incidents/incidents";
import type { QueueRow } from "./queue";
import { proposalText } from "./queue";

type Props = {
  row: Extract<QueueRow, { kind: "open" }>;
  busy: boolean;
  modal: boolean;
  takeFocus: boolean;
  onClose: () => void;
  onReview: (proposalId: string, outcome: ReviewOutcome, reason: string) => void;
};

/**
 * The review drawer (Figma frame A): everything the duty manager reads before deciding (BR-019), and the decision.
 * Approve asks first, with initial focus on Cancel; deny needs a reason, which the controller sees.
 */
export function ReviewDrawer({ row, busy, modal, takeFocus, onClose, onReview }: Props) {
  const { d, status } = row;
  const proposal = d.proposal;
  const text = proposalText(d);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const confirm = useRef<HTMLDialogElement>(null);
  const pending = status === "pending" && proposal !== null;
  const dialogOpen = useCallback(() => confirm.current?.open === true, []);

  // A fresh proposal starts with the deny form closed.
  useEffect(() => {
    setDenying(false);
    setReason("");
  }, [row.id]);

  const eyebrow = denying ? "PROPOSAL · DENYING" : `PROPOSAL · ${status === "pending" ? "PENDING REVIEW" : status.toUpperCase()}`;

  const footer = !pending ? (
    <p className="readonly">
      {status === "approved" ? "Approved. Service changes and passenger notices are in effect." : "Reviewed."} This proposal is
      read-only.
    </p>
  ) : !denying ? (
    <>
      <p>{text.consequence}</p>
      <button type="button" className="tonal" disabled={busy} onClick={() => setDenying(true)}>
        Deny…
      </button>
      <button type="button" className="primary" disabled={busy} onClick={() => confirm.current?.showModal()}>
        {text.approve}
      </button>
    </>
  ) : (
    <form
      className="deny-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim() && proposal) onReview(proposal.id, "deny", reason.trim());
      }}
    >
      <label>
        Reason for denial (required)
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          rows={2}
          autoFocus
          required
          aria-describedby="deny-help"
        />
      </label>
      <small id="deny-help">Shown to the controller on their noticeboard. The incident is declined and closed.</small>
      <div className="row">
        <button type="button" className="text" onClick={() => setDenying(false)}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={busy || !reason.trim()}>
          Deny and close incident
        </button>
      </div>
    </form>
  );

  return (
    <IncidentPanel
      d={d}
      eyebrow={eyebrow}
      subtitle={`Reported ${clock(d.createdAt)} · proposed by Controller`}
      ask={text.ask}
      modal={modal}
      takeFocus={takeFocus}
      onClose={onClose}
      dialogOpen={dialogOpen}
      footer={footer}
    >
      {/* Approve asks first, with initial focus on Cancel. */}
      <dialog
        ref={confirm}
        className="confirm"
        aria-labelledby="approve-title"
        aria-describedby="approve-body"
        onClose={() => document.getElementById("incident-panel")?.focus()}
      >
        <form method="dialog">
          <h2 id="approve-title">{text.confirmTitle}</h2>
          <p id="approve-body">{text.consequence}</p>
          <div className="confirm-actions">
            <button type="submit" value="cancel" className="text" autoFocus>
              Cancel
            </button>
            <button
              type="submit"
              value="approve"
              className="text"
              onClick={() => {
                if (proposal) onReview(proposal.id, "approve", "");
              }}
            >
              {proposal?.verdict === "reject" ? "Approve rejection" : "Approve and issue notices"}
            </button>
          </div>
        </form>
      </dialog>
    </IncidentPanel>
  );
}
