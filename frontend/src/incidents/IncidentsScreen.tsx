import type { ReactNode } from "react";
import { useState } from "react";
import type { Verdict } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";
import { MiniMap } from "../map/MiniMap";
import type { SiteNetwork } from "../map/network";
import { routeCodes } from "../review/queue";
import { EmptyPanel } from "../shell/EmptyPanel";
import { Icon } from "../shell/Icon";
import { ScreenHead } from "../shell/ScreenHead";
import { useListPanel } from "../shell/useListPanel";
import type { DisruptionView, VehicleView } from "../workspace/service";
import { IncidentPanel } from "./IncidentPanel";
import type { IncidentStage } from "./incidents";
import {
  SCENARIO_TIME,
  STAGES,
  STAGE_LABEL,
  countByStage,
  decidedText,
  incidentRows,
  landingStage,
  placeName,
  proposalLines,
  stageChip,
  stageEyebrow,
  stageOf,
} from "./incidents";
import { MyProposals, StatusChip } from "./MyProposals";

type Props = {
  persona: PersonaId;
  /** null while the workspace is still loading. */
  disruptions: DisruptionView[] | null;
  /** Incidents declined on denial: off the list, but their proposals stay under My proposals. */
  declined: DisruptionView[];
  failed: boolean;
  onRetry: () => void;
  busy: boolean;
  network: SiteNetwork | null;
  vehicles: VehicleView[];
  onPropose: (recommendationId: string, verdict: Verdict) => void;
  /** A click on the map: place a closure there. */
  onPick: (lat: number, lon: number) => void;
  /** A denial's "Report again". */
  onReportAgain: (at: { lat: number; lon: number }) => void;
  /** While a closure is being placed: the point and radius, drawn on the map (prototype P2). */
  picking: { lat: number; lon: number; radiusM: number } | null;
  /** The report sheet, over the panel while a closure is being placed. */
  sheet?: ReactNode;
  /** The fiction notice at the foot of the list. */
  note?: ReactNode;
  /** Open on this incident (a hand-over from another role, or a new report). */
  openId?: string | null;
};

function ask(d: DisruptionView): string {
  const n = d.impact?.patterns.length ?? 0;
  if (!d.impact) return "Being assessed.";
  if (n === 0)
    return `No bus route in the sample runs through it (${d.impact.blockedRoads} road${d.impact.blockedRoads === 1 ? "" : "s"} closed). Nothing to decide.`;
  return `Suggested: one bypass for each of the ${n} affected route pattern${n === 1 ? "" : "s"}.`;
}

/**
 * The incident list (Round 3 prototype P1 to P4, P9 and P11): the controller's home, and a read-only view for the
 * other roles. The controller reports here, proposes from the panel and reads the outcome under My proposals.
 */
export function IncidentsScreen(props: Props) {
  const {
    persona,
    disruptions: loaded,
    declined,
    failed,
    onRetry,
    busy,
    network,
    vehicles,
    onPropose,
    onPick,
    onReportAgain,
  } = props;
  const { picking, sheet, note, openId = null } = props;
  const rows = incidentRows(loaded ?? []);
  const loading = loaded === null && !failed;
  const [filter, setFilter] = useState<IncidentStage>(() => landingStage(rows, declined.length, openId));
  const counts = countByStage(rows, declined.length);
  const shown = rows.filter((d) => stageOf(d) === filter);
  const ui = useListPanel(shown, undefined, openId);
  const d = ui.panelRow;
  const controller = persona === "controller";

  // A proposal moves the incident to Awaiting review: the list follows it there, panel open (prototype P4).
  const propose = (recommendationId: string, verdict: Verdict) => {
    onPropose(recommendationId, verdict);
    setFilter("awaiting");
    ui.resetSelection();
  };

  const footer = (d: DisruptionView) => {
    const rec = d.recommendation;
    const stage = stageOf(d);
    if (stage === "decided") return <p className="readonly">{decidedText(d, "the duty manager")}</p>;
    if (stage === "awaiting") {
      return (
        <p className="readonly locked">
          <Icon name="lock" size={20} />
          {controller
            ? "Proposal sent. Only a duty manager can approve or deny; you are acting as Controller."
            : "Proposal sent. It waits in the duty manager's review queue."}
        </p>
      );
    }
    if (!controller || !rec || rec.items.length === 0) {
      return (
        <p className="readonly locked">
          <Icon name="lock" size={20} />A controller proposes a verdict on this incident. This view is read-only.
        </p>
      );
    }
    return (
      <>
        <p>Your proposal goes to the duty manager's review queue. Nothing changes for riders until it is approved.</p>
        <button type="button" className="tonal" disabled={busy} onClick={() => propose(rec.id, "reject")}>
          Propose: reject
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => propose(rec.id, "approve")}>
          Propose: approve all
        </button>
      </>
    );
  };

  const empty =
    rows.length === 0
      ? declined.length > 0
        ? "No open incidents. A declined incident is closed and leaves this list."
        : `No open incidents. ${controller ? "Report one with the + button." : "A reported incident appears here."}`
      : filter === "needs"
        ? "Nothing needs a proposal."
        : filter === "awaiting"
          ? "No proposal is waiting for review."
          : "Nothing decided yet.";

  const emptyPanel =
    rows.length === 0 && declined.length > 0 ? (
      <EmptyPanel eyebrow="NO INCIDENT SELECTED" title="Nothing to propose">
        Your denied proposal and its reason are on the left, under My proposals.
      </EmptyPanel>
    ) : rows.length === 0 ? (
      <EmptyPanel eyebrow="NO INCIDENT SELECTED" title="Nothing to propose yet">
        Report a closure to see what it cuts and a suggested bypass for each affected route.
      </EmptyPanel>
    ) : (
      <EmptyPanel eyebrow="NO INCIDENT SELECTED" title="Nothing selected">
        Select an incident to see what it cuts.
      </EmptyPanel>
    );

  return (
    <div className={ui.closed && !sheet ? "screen panel-closed" : "screen"}>
      <section ref={ui.list} className="screen-main" aria-label="Incidents">
        <div className="screen-fill">
          <ScreenHead title="Incidents" />

          <div className="filters-row">
            <div className="filters" role="group" aria-label="Show incidents">
              {STAGES.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={i === 0 ? "filter-chip" : "filter-chip alt"}
                  aria-pressed={filter === s}
                  onClick={() => {
                    setFilter(s);
                    ui.resetSelection();
                  }}
                >
                  {filter === s && <Icon name="check" size={18} />}
                  {STAGE_LABEL[s]} ({counts[s]})
                </button>
              ))}
            </div>
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
              {loading &&
                [0, 1].map((i) => (
                  <tr key={i} className="skeleton" aria-hidden="true">
                    <td colSpan={4}>
                      <span />
                    </td>
                  </tr>
                ))}
              {failed && loaded === null && (
                <tr className="empty error">
                  <td colSpan={4}>
                    Incidents could not be loaded. Nothing was changed.{" "}
                    <button type="button" className="text" onClick={onRetry} disabled={busy}>
                      Try again
                    </button>
                  </td>
                </tr>
              )}
              {loaded !== null && shown.length === 0 && (
                <tr className="empty">
                  <td colSpan={4}>
                    <Icon name="inbox" size={28} />
                    <span>{empty}</span>
                  </td>
                </tr>
              )}
              {shown.map((r, i) => (
                <tr key={r.id} {...ui.rowProps(i)} className="opens">
                  <td>
                    <StatusChip chip={stageChip(r)} />
                  </td>
                  <td>
                    <b>{placeName(r)}</b>
                    <small>
                      {r.footprint.radiusM} m · {SCENARIO_TIME.time}
                    </small>
                  </td>
                  <td>{routeCodes(r).join(" ") || "—"}</td>
                  <td className="num">{r.impact?.patterns.length ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {controller && <MyProposals lines={proposalLines(loaded ?? [], declined)} onReportAgain={onReportAgain} />}

          <MiniMap
            network={network}
            disruptions={loaded ?? []}
            selected={shown[ui.selected] ?? null}
            vehicles={vehicles}
            picking={picking}
            onPick={onPick}
          />
        </div>
        {note}
      </section>

      {d && !sheet ? (
        <>
          {ui.modal && <div className="scrim" aria-hidden="true" onClick={ui.close} />}
          <IncidentPanel
            d={d}
            eyebrow={stageEyebrow(d)}
            subtitle={`Reported ${SCENARIO_TIME.day} ${SCENARIO_TIME.time} · assessed automatically`}
            ask={ask(d)}
            modal={ui.modal}
            takeFocus={ui.takeFocus}
            onClose={ui.close}
            footer={footer(d)}
          />
        </>
      ) : (
        (sheet || (!ui.modal && !ui.closed)) && emptyPanel
      )}
      {sheet}
    </div>
  );
}
