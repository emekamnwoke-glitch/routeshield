import type { Verdict } from "../../src/core/modules/ac-07-decision-manager/contract";
import type { DisruptionView, ItemView } from "./workspace/service";

const metres = (m: number) => (m >= 0 ? `+${m.toLocaleString("en-IE")} m` : `${Math.abs(m).toLocaleString("en-IE")} m shorter`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Option({ item }: { item: ItemView | undefined }) {
  if (!item) return null;
  if (item.kind === "reroute") {
    return (
      <>
        <strong>Bypass</strong> from {item.divertStop ?? "?"} to {item.rejoinStop ?? "?"}, {metres(item.extraM)},{" "}
        {item.stopsLost.length ? `misses ${plural(item.stopsLost.length, "stop")} (${item.stopsLost.join(", ")})` : "misses no stops"}
      </>
    );
  }
  if (item.kind === "contingency") return <strong>Pre-approved contingency route</strong>;
  return (
    <>
      <strong>Hold</strong> until the road reopens: no bypass was found
    </>
  );
}

type Props = { d: DisruptionView; busy: boolean; onDecide: (recommendationId: string, verdict: Verdict) => void };

export function DisruptionCard({ d, busy, onDecide }: Props) {
  const impact = d.impact;
  const rec = d.recommendation;
  const items = new Map(rec?.items.map((i) => [i.patternId, i]));
  return (
    <li>
      <p className="mono">
        {d.id.slice(0, 12)}… · {d.status} · {d.footprint.radiusM} m radius
      </p>

      {!impact ? (
        <p className="hint">Being assessed…</p>
      ) : impact.patterns.length === 0 ? (
        <p>
          No bus route in the sample runs through it ({plural(impact.blockedRoads, "road")} closed). Nothing to decide
          {rec ? ` (band ${rec.band}: observe only)` : ""}.
        </p>
      ) : (
        <>
          <p>
            <strong>{plural(impact.patterns.length, "route pattern")}</strong> cut, {plural(impact.affectedTrips, "trip")} a
            day; {impact.vehicles.approaching} vehicles approaching, {impact.vehicles.inside} inside the closure.
          </p>
          {rec && (
            <p className="hint">
              Recommendation, band {rec.band}: a person decides. Confidence is {rec.confidence}, because vehicle positions come
              from the timetable, not a live feed.
            </p>
          )}
          <ul className="impact">
            {impact.patterns.map((p) => (
              <li key={p.patternId}>
                <span className="tag">{p.routeCode}</span> towards {p.towards} <span className="muted">({p.patternId})</span>
                <br />
                {p.stopsInside.length ? `Closed stop: ${p.stopsInside.join(", ")}` : "No stop on the closed stretch"};{" "}
                {p.approaching} approaching{p.inside ? `, ${p.inside} inside` : ""}.
                <br />→ <Option item={items.get(p.patternId)} />
              </li>
            ))}
          </ul>
          {rec && rec.items.length > 0 && !d.decision && (
            <div className="row">
              <button type="button" className="primary" disabled={busy} onClick={() => onDecide(rec.id, "approve")}>
                Approve all
              </button>
              <button type="button" disabled={busy} onClick={() => onDecide(rec.id, "reject")}>
                Reject
              </button>
            </div>
          )}
        </>
      )}

      {(d.decision || d.serviceStates.length > 0) && (
        <dl className="facts">
          <dt>Decision</dt>
          <dd>{d.decision ? `${d.decision.verdict} by ${d.decision.decidedBy}` : "awaiting a person"}</dd>
          <dt>Service</dt>
          <dd>{d.serviceStates.length ? d.serviceStates.map((s) => `${s.routeCode} ${s.state}`).join(", ") : "as planned"}</dd>
          <dt>Notices</dt>
          <dd>{d.notices.length ? `${plural(d.notices.length, "passenger notice")} issued` : "none"}</dd>
        </dl>
      )}
    </li>
  );
}
