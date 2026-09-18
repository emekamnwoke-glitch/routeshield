import type { RouteStatus } from "./routeStatus";
import { STATUS_TEXT } from "./routeStatus";

/** Bus numbers of affected routes: yellow while a bypass awaits approval, red once it is in effect. */
export function RouteStatusCard({ routes }: { routes: RouteStatus[] }) {
  return (
    <section className="card" aria-labelledby="route-status-title">
      <h2 id="route-status-title">Routes affected</h2>
      {routes.length === 0 ? (
        <p className="hint">No route is affected.</p>
      ) : (
        <ul className="route-chips">
          {routes.map((r) => (
            <li key={r.routeCode} className={`route-chip ${r.status === "recommended" ? "amber" : "red"}`} title={STATUS_TEXT[r.status]}>
              {r.routeCode}
              <span className="visually-hidden">: {STATUS_TEXT[r.status]}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="legend">
        <span>
          <span className="swatch dot" style={{ background: "var(--chip-amber)" }} />
          Bypass recommended, awaiting approval
        </span>
        <span>
          <span className="swatch dot" style={{ background: "var(--chip-red)" }} />
          Approved and in effect
        </span>
      </p>
    </section>
  );
}
