import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ProposalStatus, ReviewOutcome } from "../../src/core/modules/ac-07-decision-manager/contract";
import { ReviewDrawer } from "./review/ReviewDrawer";
import type { QueueRow } from "./review/queue";
import { FILTERS, FILTER_LABEL, STATUS_CHIP, countByStatus, moveSelection, routeCodes } from "./review/queue";

type Props = {
  rows: QueueRow[];
  busy: boolean;
  onReview: (proposalId: string, outcome: ReviewOutcome, reason: string) => void;
};

export function StatusChip({ status }: { status: ProposalStatus }) {
  const chip = STATUS_CHIP[status];
  return (
    <span className={`chip tone-${chip.tone}`}>
      <span aria-hidden="true">{status === "pending" ? "◷" : status === "approved" ? "✓" : "✕"}</span>
      {chip.label}
    </span>
  );
}

/**
 * The duty manager's review queue: controllers' proposals, filtered by status. J and K (or the arrow keys) move
 * the selection; Enter or a click opens the review drawer, where the duty manager approves or denies.
 */
export function ReviewQueue({ rows, busy, onReview }: Props) {
  const [filter, setFilter] = useState<ProposalStatus>("pending");
  const [selected, setSelected] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const section = useRef<HTMLElement>(null);

  // Return focus to the selected row, or to the active filter when the list is now empty.
  const refocus = () =>
    (rowRefs.current[selected] ?? section.current?.querySelector<HTMLElement>(".filter-chip[aria-pressed=true]"))?.focus();

  const counts = countByStatus(rows);
  const shown = rows.filter((r) => r.status === filter);
  const openRow = rows.find((r) => r.id === openId && r.kind === "open");

  // Keep the selection inside the list as rows arrive and leave.
  useEffect(() => {
    if (selected > shown.length - 1) setSelected(Math.max(shown.length - 1, 0));
  }, [shown.length, selected]);

  const onKey = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const next = moveSelection(selected, e.key, shown.length);
    if (next !== selected) {
      e.preventDefault();
      setSelected(next);
      rowRefs.current[next]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      const row = shown[selected];
      if (row?.kind === "open") {
        e.preventDefault();
        setOpenId(row.id);
      }
    }
  };

  // A denied proposal closes its incident, so its row leaves the open list: close the drawer with it.
  useEffect(() => {
    if (openId && !openRow) {
      setOpenId(null);
      refocus();
    }
  }, [openId, openRow, selected]);

  const closeDrawer = () => {
    setOpenId(null);
    refocus();
  };

  return (
    <section ref={section} className="queue" aria-label="Review queue">
      <div className="queue-head">
        <div>
          <p>DUTY MANAGER</p>
          <h3>Review queue</h3>
        </div>
        <small className="keys" aria-hidden="true">
          J/K · Enter
        </small>
      </div>

      <div className="filters" role="group" aria-label="Show proposals">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className="filter-chip"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setSelected(0);
            }}
          >
            {filter === f && <span aria-hidden="true">✓ </span>}
            {FILTER_LABEL[f]} ({counts[f]})
          </button>
        ))}
      </div>

      <table className="queue-table">
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Incident</th>
            <th scope="col">Routes</th>
            <th scope="col" className="num">
              Patterns
            </th>
          </tr>
        </thead>
        <tbody onKeyDown={onKey}>
          {shown.length === 0 && (
            <tr className="empty">
              <td colSpan={4}>
                {filter === "pending"
                  ? "Nothing waiting. A controller's proposal appears here."
                  : filter === "approved"
                    ? "No approved proposal is still open."
                    : "No denial yet. A denied proposal closes its incident and stays listed here."}
              </td>
            </tr>
          )}
          {shown.map((r, i) => (
            <tr
              key={r.id}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              tabIndex={i === selected ? 0 : -1}
              aria-selected={i === selected}
              className={r.kind === "open" ? "opens" : undefined}
              onClick={() => {
                setSelected(i);
                if (r.kind === "open") setOpenId(r.id);
              }}
              onFocus={() => setSelected(i)}
            >
              <td>
                <StatusChip status={r.status} />
              </td>
              {r.kind === "open" ? (
                <>
                  <td>
                    <b>{r.d.footprint.radiusM} m closure</b>
                    <small>by Controller · {r.d.id.slice(0, 8)}</small>
                  </td>
                  <td>{routeCodes(r.d).join(" ") || "—"}</td>
                  <td className="num">{r.d.impact?.patterns.length ?? "—"}</td>
                </>
              ) : (
                <td colSpan={3}>
                  <small>{r.text}</small>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {openRow?.kind === "open" && (
        <ReviewDrawer row={openRow} busy={busy} onClose={closeDrawer} onReview={onReview} />
      )}
    </section>
  );
}
