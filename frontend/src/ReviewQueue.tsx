import type { ReactNode } from "react";
import { useState } from "react";
import type { ProposalStatus, ReviewOutcome } from "../../src/core/modules/ac-07-decision-manager/contract";
import { MiniMap } from "./map/MiniMap";
import type { SiteNetwork } from "./map/network";
import { ReviewDrawer } from "./review/ReviewDrawer";
import type { QueueRow } from "./review/queue";
import { FILTERS, FILTER_LABEL, STATUS_CHIP, countByStatus, routeCodes } from "./review/queue";
import { EmptyPanel } from "./shell/EmptyPanel";
import { ScreenHead } from "./shell/ScreenHead";
import { useListPanel } from "./shell/useListPanel";
import { placeName } from "./incidents/incidents";
import type { DisruptionView, VehicleView } from "./workspace/service";

type Props = {
  /** null while the workspace is still loading. */
  rows: QueueRow[] | null;
  /** The workspace could not be read: the table says so and offers Try again. */
  failed: boolean;
  onRetry: () => void;
  busy: boolean;
  onReview: (proposalId: string, outcome: ReviewOutcome, reason: string) => void;
  network: SiteNetwork | null;
  disruptions: DisruptionView[];
  vehicles: VehicleView[];
  onPick: (lat: number, lon: number) => void;
  /** The fiction notice at the foot of the list. */
  note?: ReactNode;
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
 * The duty manager's home (Figma frame A): controllers' proposals, filtered by status, with the selected
 * proposal's evidence and decision in the panel beside it.
 */
export function ReviewQueue({ rows: loaded, failed, onRetry, busy, onReview, network, disruptions, vehicles, onPick, note }: Props) {
  const rows = loaded ?? [];
  const loading = loaded === null && !failed;
  const [filter, setFilter] = useState<ProposalStatus>("pending");
  const counts = countByStatus(rows);
  const shown = rows.filter((r) => r.status === filter);
  const ui = useListPanel(shown, (r) => r.kind === "open");
  const panel = ui.panelRow?.kind === "open" ? ui.panelRow : null;
  const current = shown[ui.selected];

  return (
    <div className="screen">
      <section ref={ui.list} className="screen-main" aria-label="Review queue">
        <ScreenHead title="Review queue" />

        <div className="filters-row">
          <div className="filters" role="group" aria-label="Show proposals">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className="filter-chip"
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  ui.resetSelection();
                }}
              >
                {filter === f && <span aria-hidden="true">✓ </span>}
                {FILTER_LABEL[f]} ({counts[f]})
              </button>
            ))}
          </div>
          <small className="keys" aria-hidden="true">
            J/K · Enter
          </small>
        </div>

        <table className="queue-table" aria-busy={loading}>
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
          <tbody onKeyDown={ui.onKey}>
            {/* Table states: loading keeps the header with skeleton rows; error says nothing changed and offers Try again. */}
            {loading &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="skeleton" aria-hidden="true">
                  <td colSpan={4}>
                    <span />
                  </td>
                </tr>
              ))}
            {failed && loaded === null && (
              <tr className="empty error">
                <td colSpan={4}>
                  The queue could not be loaded. Nothing was changed.{" "}
                  <button type="button" className="text" onClick={onRetry} disabled={busy}>
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {loaded !== null && shown.length === 0 && (
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
              <tr key={r.id} {...ui.rowProps(i)} className={r.kind === "open" ? "opens" : undefined}>
                <td>
                  <StatusChip status={r.status} />
                </td>
                {r.kind === "open" ? (
                  <>
                    <td>
                      <b>{placeName(r.d)}</b>
                      <small>{r.d.footprint.radiusM} m · by Controller</small>
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

        <MiniMap
          network={network}
          disruptions={disruptions}
          selected={current?.kind === "open" ? current.d : null}
          vehicles={vehicles}
          onPick={onPick}
        />
        {note}
      </section>

      {panel ? (
        <>
          {ui.modal && <div className="scrim" aria-hidden="true" onClick={ui.close} />}
          <ReviewDrawer row={panel} busy={busy} modal={ui.modal} takeFocus={ui.takeFocus || ui.modal} onClose={ui.close} onReview={onReview} />
        </>
      ) : (
        !ui.modal && (
          <EmptyPanel>
            {current?.kind === "closed"
              ? "This proposal was denied and its incident closed. The reason is in the row."
              : "Select a proposal to see what it cuts and decide on it."}
          </EmptyPanel>
        )
      )}
    </div>
  );
}
