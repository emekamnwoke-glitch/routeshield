import { useEffect, useRef, useState } from "react";
import type { ReviewOutcome } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { QueueRow } from "./queue";
import { proposalText, routeCodes } from "./queue";

type Props = {
  row: Extract<QueueRow, { kind: "open" }>;
  busy: boolean;
  onClose: () => void;
  onReview: (proposalId: string, outcome: ReviewOutcome, reason: string) => void;
};

const metres = (m: number) => (m >= 0 ? `+${m.toLocaleString("en-IE")}` : `−${Math.abs(m).toLocaleString("en-IE")}`);

/**
 * The review drawer: everything the duty manager reads before deciding (BR-019), and the decision itself.
 * It is always opaque (ADR-0021): map colours must not bleed into the rationale and costs.
 * Esc closes it and returns focus to the queue row that opened it.
 */
export function ReviewDrawer({ row, busy, onClose, onReview }: Props) {
  const { d, status } = row;
  const proposal = d.proposal;
  const text = proposalText(d);
  const [denying, setDenying] = useState(false);
  const [reason, setReason] = useState("");
  const drawer = useRef<HTMLElement>(null);
  const confirm = useRef<HTMLDialogElement>(null);
  const items = new Map(d.recommendation?.items.map((i) => [i.patternId, i]));
  const impact = d.impact;
  const pending = status === "pending" && proposal !== null;

  // Focus the drawer when it opens, so the screen reader starts at its title.
  useEffect(() => {
    drawer.current?.focus();
  }, [row.id]);

  // Esc closes the drawer wherever focus is, unless the approve dialog is open (Esc closes that first).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !confirm.current?.open && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // A fresh proposal starts with the deny form closed.
  useEffect(() => {
    setDenying(false);
    setReason("");
  }, [row.id]);

  const eyebrow = denying ? "PROPOSAL · DENYING" : `PROPOSAL · ${status === "pending" ? "PENDING REVIEW" : status.toUpperCase()}`;

  return (
    <aside
      ref={drawer}
      className="drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="drawer-title"
      tabIndex={-1}
    >
      <header className="drawer-head">
        <div>
          <p>{eyebrow}</p>
          <h2 id="drawer-title">{d.footprint.radiusM} m closure</h2>
          <small>
            {d.footprint.lat.toFixed(5)}, {d.footprint.lon.toFixed(5)} · proposed by Controller
          </small>
        </div>
        <button type="button" className="icon-button" aria-label="Close review" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="drawer-body">
        {impact && (
          <dl className="stats">
            <div className="lead">
              <dt>Patterns cut</dt>
              <dd>{impact.patterns.length}</dd>
            </div>
            <div>
              <dt>Routes: {routeCodes(d).join(" ")}</dt>
              <dd>{routeCodes(d).length}</dd>
            </div>
            <div>
              <dt>Trips a day</dt>
              <dd>{impact.affectedTrips.toLocaleString("en-IE")}</dd>
            </div>
            <div>
              <dt>Vehicles approaching</dt>
              <dd>{impact.vehicles.approaching}</dd>
            </div>
            <div>
              <dt>Vehicles inside</dt>
              <dd>{impact.vehicles.inside}</dd>
            </div>
          </dl>
        )}

        <p className="ask">{text.ask}</p>
        {d.recommendation && (
          <p className="hint">
            Recommendation band {d.recommendation.band}: a person decides. Confidence is {d.recommendation.confidence}, because
            vehicle positions come from the timetable, not a live feed.
          </p>
        )}

        {impact && impact.patterns.length > 0 && (
          <div className="table-wrap">
            <table className="bypass-table">
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col">Pattern</th>
                  <th scope="col">Towards</th>
                  <th scope="col">Stop missed</th>
                  <th scope="col" className="num">
                    Appr.
                  </th>
                  <th scope="col" className="num">
                    Inside
                  </th>
                  <th scope="col">Bypass</th>
                  <th scope="col" className="num">
                    Extra m
                  </th>
                </tr>
              </thead>
              <tbody>
                {impact.patterns.map((p) => {
                  const item = items.get(p.patternId);
                  return (
                    <tr key={p.patternId}>
                      <th scope="row">{p.routeCode}</th>
                      <td className="muted">{p.patternId}</td>
                      <td>{p.towards}</td>
                      <td>{item?.stopsLost.join(", ") || p.stopsInside.join(", ") || "None"}</td>
                      <td className="num">{p.approaching}</td>
                      <td className="num">{p.inside}</td>
                      <td>
                        {item?.kind === "reroute"
                          ? `${item.divertStop ?? "?"} → ${item.rejoinStop ?? "?"}`
                          : item?.kind === "contingency"
                            ? "Pre-approved contingency"
                            : "Hold until reopened"}
                      </td>
                      <td className="num">{item?.kind === "reroute" ? metres(item.extraM) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer actions: Allowed while pending; read-only once reviewed. */}
      <footer className="drawer-actions">
        {!pending ? (
          <p className="readonly">
            {status === "approved" ? "Approved. Service changes and passenger notices are in effect." : "Reviewed."} This
            proposal is read-only.
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
        )}
      </footer>

      {/* Approve asks first, with initial focus on Cancel. */}
      <dialog
        ref={confirm}
        className="confirm"
        aria-labelledby="approve-title"
        aria-describedby="approve-body"
        onClose={() => drawer.current?.focus()}
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
    </aside>
  );
}
