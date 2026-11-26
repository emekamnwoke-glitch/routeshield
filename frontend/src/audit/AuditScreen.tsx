import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { clock } from "../incidents/incidents";
import { trapIndex } from "../shell/failure";
import { EmptyPanel } from "../shell/EmptyPanel";
import { ScreenHead } from "../shell/ScreenHead";
import { useListPanel } from "../shell/useListPanel";
import type { AuditView } from "../workspace/service";
import type { TrailCategory, TrailRow } from "./trail";
import { CATEGORIES, CATEGORY_LABEL, actionName, actorName, categoryOf, componentName, countByCategory, rowLabel, trailRows } from "./trail";

type Props = {
  /** null while the workspace is still loading. */
  audit: AuditView | null;
  failed: boolean;
  busy: boolean;
  onRetry: () => void;
  /** The fiction notice at the foot of the list. */
  note?: ReactNode;
};

type Row = TrailRow & { id: string };

function EventPanel({ row, rows, chainOk, modal, takeFocus, onClose }: { row: Row; rows: Row[]; chainOk: boolean; modal: boolean; takeFocus: boolean; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const index = rows.findIndex((r) => r.id === row.id);
  const nearby = [rows[index + 1], rows[index - 1]].filter((r): r is Row => r !== undefined);
  const grouped = row.count > 1;

  useEffect(() => {
    if (takeFocus) panel.current?.focus();
  }, [row.id, takeFocus]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const trap = (e: React.KeyboardEvent) => {
    if (!modal || e.key !== "Tab") return;
    const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    const next = trapIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, e.shiftKey);
    if (next >= 0) {
      e.preventDefault();
      focusable[next]?.focus();
    }
  };

  return (
    <aside
      ref={panel}
      className={modal ? "drawer event-panel modal" : "drawer event-panel"}
      role={modal ? "dialog" : "region"}
      aria-modal={modal || undefined}
      aria-labelledby="event-title"
      tabIndex={-1}
      onKeyDown={trap}
    >
      <header className="drawer-head">
        <div>
          <p>
            {grouped ? `EVENTS #${rowLabel(row)}` : `EVENT #${row.first}`} · {row.type}
          </p>
          <h2 id="event-title">
            {actionName(row.type)}
            {grouped ? ` (${row.count})` : ""}
          </h2>
          <small>
            {clock(row.at, true)} · {actorName(row.actor)} · {componentName(row.component)}
          </small>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>
      <div className="drawer-body">
        <dl className="event-facts">
          <div>
            <dt>Action</dt>
            <dd>{actionName(row.type)}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{CATEGORY_LABEL[categoryOf(row.type)]}</dd>
          </div>
          <div>
            <dt>Component</dt>
            <dd>{componentName(row.component)}</dd>
          </div>
          <div>
            <dt>Actor</dt>
            <dd>{actorName(row.actor)}</dd>
          </div>
          {grouped && (
            <div>
              <dt>Events</dt>
              <dd>
                {row.count} in a row, #{row.first} to #{row.last}
              </dd>
            </div>
          )}
          <div>
            <dt>Chain</dt>
            <dd>
              {row.first > 1 ? `Follows event #${row.first - 1}` : "First event"} · {chainOk ? "hash verified" : "chain broken"}
            </dd>
          </div>
        </dl>
        {nearby.length > 0 && (
          <>
            <h3 className="related-title">Events either side</h3>
            <ul className="related">
              {nearby.map((r) => (
                <li key={r.id}>
                  #{rowLabel(r)} · {actionName(r.type)}
                  {r.count > 1 ? ` (${r.count})` : ""} · {actorName(r.actor)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="drawer-actions">
        <p>Read-only. The administrator reads the trail and cannot decide.</p>
      </footer>
    </aside>
  );
}

/** The administrator's home (Figma frame E): the hash-chained audit trail, newest first, with each event's detail. */
export function AuditScreen({ audit, failed, busy, onRetry, note }: Props) {
  const all: Row[] = trailRows(audit?.trail ?? []).map((r) => ({ ...r, id: String(r.last) }));
  const [filter, setFilter] = useState<TrailCategory | "all">("all");
  const counts = countByCategory(all);
  const shown = filter === "all" ? all : all.filter((r) => categoryOf(r.type) === filter);
  const ui = useListPanel(shown);
  const loading = audit === null && !failed;

  return (
    <div className="screen audit">
      <section ref={ui.list} className="screen-main" aria-label="Audit trail">
        <ScreenHead title="Audit trail">
          {audit && (
            <div className="chain">
              <span className={`chip ${audit.chain.ok ? "tone-in-effect" : "tone-danger"}`}>
                <span aria-hidden="true">{audit.chain.ok ? "✓" : "!"}</span>
                {audit.chain.ok ? "Chain verified" : "Chain broken"}
              </span>
              <small>
                {audit.chain.events} events · {audit.chain.snapshots} snapshot{audit.chain.snapshots === 1 ? "" : "s"} · checked on every
                refresh
              </small>
            </div>
          )}
        </ScreenHead>
        {audit && !audit.chain.ok && <p className="hint bad">{audit.chain.problems.join("; ")}</p>}

        <div className="filters-row">
          <div className="filters" role="group" aria-label="Show events">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                type="button"
                className="filter-chip"
                aria-pressed={filter === c}
                onClick={() => {
                  setFilter(c);
                  ui.resetSelection();
                }}
              >
                {filter === c && <span aria-hidden="true">✓ </span>}
                {CATEGORY_LABEL[c]} ({counts[c]})
              </button>
            ))}
          </div>
        </div>

        <table className="queue-table trail-table" aria-busy={loading}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Time</th>
              <th scope="col">Action</th>
              <th scope="col">Component</th>
              <th scope="col">Actor</th>
            </tr>
          </thead>
          <tbody onKeyDown={ui.onKey}>
            {loading &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i} className="skeleton" aria-hidden="true">
                  <td colSpan={5}>
                    <span />
                  </td>
                </tr>
              ))}
            {failed && audit === null && (
              <tr className="empty error">
                <td colSpan={5}>
                  The audit trail could not be loaded. Nothing was changed.{" "}
                  <button type="button" className="text" onClick={onRetry} disabled={busy}>
                    Try again
                  </button>
                </td>
              </tr>
            )}
            {audit !== null && shown.length === 0 && (
              <tr className="empty">
                <td colSpan={5}>No event of this kind yet.</td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id} {...ui.rowProps(i)} className="opens">
                <td className="seq">{rowLabel(r)}</td>
                <td>{clock(r.at, true)}</td>
                <td>
                  <b>
                    {actionName(r.type)}
                    {r.count > 1 ? ` (${r.count})` : ""}
                  </b>
                  <small>{r.type}</small>
                </td>
                <td>{componentName(r.component)}</td>
                <td>{actorName(r.actor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit && audit.chain.events > audit.trail.length && (
          <p className="hint">The latest {audit.trail.length} events are listed. The chain check covers all {audit.chain.events}.</p>
        )}
        {note}
      </section>

      {ui.panelRow ? (
        <>
          {ui.modal && <div className="scrim" aria-hidden="true" onClick={ui.close} />}
          <EventPanel row={ui.panelRow} rows={shown} chainOk={audit?.chain.ok ?? false} modal={ui.modal} takeFocus={ui.takeFocus} onClose={ui.close} />
        </>
      ) : (
        !ui.modal && <EmptyPanel>Select an event to see its detail.</EmptyPanel>
      )}
    </div>
  );
}
