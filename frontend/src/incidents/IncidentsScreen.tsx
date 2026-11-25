import type { ReactNode } from "react";
import { useState } from "react";
import type { Verdict } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";
import { MiniMap } from "../map/MiniMap";
import type { SiteNetwork } from "../map/network";
import { Noticeboard } from "../Noticeboard";
import { routeCodes } from "../review/queue";
import { EmptyPanel } from "../shell/EmptyPanel";
import { ScreenHead } from "../shell/ScreenHead";
import { useListPanel } from "../shell/useListPanel";
import type { DisruptionView, NoticeItem, VehicleView } from "../workspace/service";
import { IncidentPanel } from "./IncidentPanel";
import type { IncidentStage } from "./incidents";
import { STAGES, STAGE_CHIP, STAGE_LABEL, clock, countByStage, incidentRows, stageOf } from "./incidents";

type Props = {
  persona: PersonaId;
  /** null while the workspace is still loading. */
  disruptions: DisruptionView[] | null;
  failed: boolean;
  onRetry: () => void;
  noticeboard: NoticeItem[];
  busy: boolean;
  network: SiteNetwork | null;
  vehicles: VehicleView[];
  onPropose: (recommendationId: string, verdict: Verdict) => void;
  onPick: (lat: number, lon: number) => void;
  onShowProposals: () => void;
  /** The fiction notice at the foot of the list. */
  note?: ReactNode;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function StageChip({ d }: { d: DisruptionView }) {
  const stage = stageOf(d);
  const chip = STAGE_CHIP[stage];
  // A closure no route runs through has nothing to decide: say so rather than "Decided".
  const label = stage === "decided" && !d.decision ? "Nothing to decide" : chip.label;
  return (
    <span className={`chip tone-${chip.tone}`}>
      <span aria-hidden="true">{chip.icon}</span>
      {label}
    </span>
  );
}

function ask(d: DisruptionView): string {
  const n = d.impact?.patterns.length ?? 0;
  if (!d.impact) return "Being assessed.";
  if (n === 0) return `No bus route in the sample runs through it (${plural(d.impact.blockedRoads, "road")} closed). Nothing to decide.`;
  return `Suggested: one bypass for each of the ${plural(n, "affected route pattern")}.`;
}

/**
 * The incident list (Figma frame D): the controller's home, and a read-only view for the other roles.
 * The controller proposes a verdict from the panel; the duty manager decides on it in the review queue.
 */
export function IncidentsScreen(props: Props) {
  const { persona, disruptions: loaded, failed, onRetry, noticeboard, busy, network, vehicles, onPropose, onPick, onShowProposals, note } = props;
  const rows = incidentRows(loaded ?? []);
  const loading = loaded === null && !failed;
  const [filter, setFilter] = useState<IncidentStage>("needs");
  const counts = countByStage(rows);
  const shown = rows.filter((d) => stageOf(d) === filter);
  const ui = useListPanel(shown);
  const d = ui.panelRow;
  const controller = persona === "controller";

  // A proposal moves the incident to Awaiting review: the list follows it there.
  const propose = (recommendationId: string, verdict: Verdict) => {
    onPropose(recommendationId, verdict);
    setFilter("awaiting");
    ui.resetSelection();
  };

  const footer = (d: DisruptionView) => {
    const rec = d.recommendation;
    const stage = stageOf(d);
    if (stage === "decided") {
      return (
        <p className="readonly">
          {d.decision
            ? `${d.decision.verdict === "approve" ? "Approved" : "Rejected"} by the Duty manager. ${
                d.notices.length ? `${plural(d.notices.length, "passenger notice")} issued.` : "No passenger notices."
              }`
            : "No route runs through this closure, so there is nothing to decide."}
        </p>
      );
    }
    if (stage === "awaiting") return <p className="readonly">Proposal sent. It waits in the duty manager's review queue.</p>;
    if (!controller || !rec || rec.items.length === 0) {
      return <p className="readonly">A controller proposes a verdict on this incident. This view is read-only.</p>;
    }
    return (
      <>
        <p>
          {d.proposal?.status === "denied"
            ? `Denied by the Duty manager: ${d.proposal.reason ?? "no reason given"}. You may propose again.`
            : "Your proposal goes to the duty manager's review queue. Nothing changes for riders until it is approved."}
        </p>
        <button type="button" className="tonal" disabled={busy} onClick={() => propose(rec.id, "reject")}>
          Propose: reject
        </button>
        <button type="button" className="primary" disabled={busy} onClick={() => propose(rec.id, "approve")}>
          Propose: approve all
        </button>
      </>
    );
  };

  return (
    <div className="screen">
      <section ref={ui.list} className="screen-main" aria-label="Incidents">
        <ScreenHead title="Incidents" />

        <div className="filters-row">
          <div className="filters" role="group" aria-label="Show incidents">
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                className="filter-chip"
                aria-pressed={filter === s}
                onClick={() => {
                  setFilter(s);
                  ui.resetSelection();
                }}
              >
                {filter === s && <span aria-hidden="true">✓ </span>}
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
                  {filter === "needs"
                    ? rows.length
                      ? "Nothing needs a proposal."
                      : `No incident reported. ${controller ? "Press + or click the map to report one." : "A reported incident appears here."}`
                    : filter === "awaiting"
                      ? "No proposal is waiting for review."
                      : "Nothing decided yet."}
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id} {...ui.rowProps(i)} className="opens">
                <td>
                  <StageChip d={r} />
                </td>
                <td>
                  <b>{r.footprint.radiusM} m closure</b>
                  <small>
                    {r.footprint.lat.toFixed(4)}, {r.footprint.lon.toFixed(4)} · {clock(r.createdAt)}
                  </small>
                </td>
                <td>{routeCodes(r).join(" ") || "—"}</td>
                <td className="num">{r.impact?.patterns.length ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {controller && <Noticeboard items={noticeboard.slice(0, 2)} more={noticeboard.length > 2 ? onShowProposals : undefined} />}

        <MiniMap network={network} disruptions={loaded ?? []} selected={shown[ui.selected] ?? null} vehicles={vehicles} onPick={onPick} />
        {note}
      </section>

      {d ? (
        <>
          {ui.modal && <div className="scrim" aria-hidden="true" onClick={ui.close} />}
          <IncidentPanel
            d={d}
            eyebrow={`INCIDENT · ${(d.decision || !d.impact?.patterns.length ? "DECIDED" : STAGE_LABEL[stageOf(d)]).toUpperCase()}`}
            subtitle={`Reported ${clock(d.createdAt)} · assessed automatically`}
            ask={ask(d)}
            modal={ui.modal}
            takeFocus={ui.takeFocus}
            onClose={ui.close}
            footer={footer(d)}
          />
        </>
      ) : (
        !ui.modal && <EmptyPanel>{rows.length ? "Select an incident to see what it cuts." : "No incident selected."}</EmptyPanel>
      )}
    </div>
  );
}
