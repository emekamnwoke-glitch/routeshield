import { useEffect, useState } from "react";
import type { Verdict } from "../../src/core/modules/ac-07-decision-manager/contract";
import type { PersonaId } from "../../src/core/modules/ac-14-access-control/contract";
import { PERSONAS } from "../../src/core/modules/ac-14-access-control/contract";
import { DisruptionCard } from "./DisruptionCard";
import { NetworkMap } from "./map/NetworkMap";
import { RouteStatusCard } from "./RouteStatusCard";
import { routeStatuses } from "./routeStatus";
import type { SiteNetwork } from "./map/network";
import { loadNetwork } from "./map/network";
import { CoreClient } from "./worker/client";
import type { Request, WorkspaceState } from "./workspace/service";

const REPO = "https://github.com/emekamnwoke-glitch/routeshield";
const DEFAULT_PICK = { lat: 53.3498, lon: -6.2603 }; // O'Connell Street
const RADII = [100, 150, 300, 500];

// One core worker per page: it is the only writer of the store (ADR-0010), and
// a second one would contend for the same OPFS file.
const client = new CoreClient();

export function App() {
  const [network, setNetwork] = useState<SiteNetwork | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState<PersonaId>("controller");
  const [route, setRoute] = useState<number | null>(null);
  const [pick, setPick] = useState(DEFAULT_PICK);
  const [radiusM, setRadiusM] = useState(150);
  const [description, setDescription] = useState("Road closed");

  const send = async (req: Request) => {
    setBusy(true);
    const res = await client.request(req);
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      setNotice(res.notice ?? null);
      setError(null);
    } else {
      setError(res.error);
    }
  };

  useEffect(() => {
    loadNetwork()
      .then((n) => {
        setNetwork(n);
        const e2 = n.routes.findIndex((r) => r.code === "E2");
        setRoute(e2 >= 0 ? e2 : null);
      })
      .catch((err: unknown) => setError(String(err)));
    void send({ kind: "state" });
  }, []); // load once

  const decide = (recommendationId: string, verdict: Verdict) =>
    send({ kind: "decide", persona, recommendationId, verdict });

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>RouteShield</h1>
          <p className="subtitle">Emergency bus rerouting · reference implementation · v1.2.0</p>
        </div>
        <label className="persona">
          <span>Acting as</span>
          <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaId)}>
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <small>Persona switcher: nobody is signed in or authenticated (ADR-0012).</small>
        </label>
      </header>

      <p className="fiction" role="note">
        <strong>Fictional reference implementation.</strong> The bus network is real (NTA GTFS, OpenStreetMap).
        Everything operational — incidents, decisions, notices — is invented, and no real operator's system is
        connected. <a href={`${REPO}/blob/main/docs/02-stage-two-reference-implementation/fact-vs-assumption-model.md`}>Why this matters</a>
      </p>

      <main className="layout">
        <section className="map-panel" aria-label="Network map">
          <div className="map-toolbar">
            <label>
              Highlight route{" "}
              <select
                value={route ?? ""}
                onChange={(e) => setRoute(e.target.value === "" ? null : Number(e.target.value))}
                disabled={!network}
              >
                <option value="">None</option>
                {network?.routes.map((r, i) => (
                  <option key={r.code} value={i}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {network ? (
            <NetworkMap
              network={network}
              route={route}
              footprints={state?.disruptions.map((d) => d.footprint) ?? []}
              blocked={state?.disruptions.flatMap((d) => d.impact?.blockedLines ?? []) ?? []}
              detours={
                state?.disruptions.flatMap((d) =>
                  d.recommendation?.items.flatMap((i) => (i.detour.length ? [i.detour] : [])) ?? [],
                ) ?? []
              }
              vehicles={state?.vehicles ?? []}
              pick={pick}
              onPick={(lat, lon) => setPick({ lat, lon })}
            />
          ) : (
            <p className="loading">{error ? "The network could not be loaded." : "Loading the Dublin network…"}</p>
          )}
          <div className="legend" aria-label="Map legend">
            <span>
              <span className="swatch" style={{ background: "var(--map-route)" }} />
              Highlighted route
            </span>
            <span>
              <span className="swatch" style={{ background: "var(--map-footprint)" }} />
              Closed road
            </span>
            <span>
              <span className="swatch" style={{ background: "repeating-linear-gradient(90deg, var(--map-detour) 0 5px, transparent 5px 8px)" }} />
              Suggested bypass
            </span>
            <span>
              <span className="swatch dot" style={{ background: "var(--map-approaching)" }} />
              Vehicle approaching
            </span>
            <span>
              <span className="swatch dot" style={{ background: "var(--map-footprint)" }} />
              Vehicle inside
            </span>
            <span>
              <span className="swatch dot" style={{ background: "var(--map-vehicle)" }} />
              Other vehicle (synthetic)
            </span>
          </div>
        </section>

        <aside className="side">
          <RouteStatusCard routes={routeStatuses(state)} />

          <section className="card">
            <h2>1. Report an incident</h2>
            <p className="hint">
              Click the map to place it. It starts on O'Connell Street. Vehicles are a synthetic fleet placed from the
              timetable for Monday 08:00.
            </p>
            <dl className="facts">
              <dt>Location</dt>
              <dd>
                {pick.lat.toFixed(5)}, {pick.lon.toFixed(5)}
              </dd>
            </dl>
            <div className="row">
              <label>
                Radius{" "}
                <select value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))}>
                  {RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} m
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                Description{" "}
                <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
              </label>
            </div>
            <button
              type="button"
              className="primary"
              disabled={busy || !state?.network.loaded}
              onClick={() => send({ kind: "report", incident: { ...pick, radiusM, description: description || "Incident" } })}
            >
              Report incident
            </button>
          </section>

          <section className="card">
            <h2>2. Disruptions</h2>
            <p className="hint">
              Each affected route pattern gets one suggested bypass, dashed on the map, for a person to approve or
              reject. v1.3.0 ranks several options with their costs.
            </p>
            {state?.disruptions.length ? (
              <ul className="disruptions">
                {state.disruptions.map((d) => (
                  <DisruptionCard key={d.id} d={d} busy={busy} onDecide={decide} />
                ))}
              </ul>
            ) : (
              <p className="hint">None yet. Report an incident to start one.</p>
            )}
          </section>

          <section className="card">
            <h2>3. Audit trail</h2>
            {state && (
              <p className={state.chain.ok ? "ok" : "bad"}>
                {state.chain.ok
                  ? `Hash chain verified: ${state.chain.events} events, ${state.chain.snapshots} snapshots.`
                  : `Hash chain broken: ${state.chain.problems.join("; ")}`}
              </p>
            )}
            {state && state.components.length > 0 && (
              <p className="hint">Components that recorded events: {state.components.join(", ")}</p>
            )}
            <ol className="trail">
              {state?.trail.map((t) => (
                <li key={t.seq}>
                  <span className="mono">#{t.seq}</span> <span className="tag">{t.component}</span> {t.type}
                  {t.actor && <span className="actor"> · {t.actor}</span>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card">
            <p className="hint">
              {state?.storage === "opfs"
                ? "Stored in this browser (OPFS). It survives a reload."
                : "Stored in memory: this browser refused OPFS, so a reload starts again."}
            </p>
            <button type="button" disabled={busy} onClick={() => send({ kind: "reset" })}>
              Start again
            </button>
          </section>

          <p className="status" role="status" aria-live="polite">
            {error ? `Error: ${error}` : !state ? "Loading the road network and fleet…" : notice}
          </p>
        </aside>
      </main>

      <footer className="footer">
        {(network?.attribution ?? []).map((a) => (
          <p key={a}>{a}</p>
        ))}
        <p>
          <a href={REPO}>Architecture and source on GitHub</a> · Independent portfolio project, not affiliated with
          Dublin Bus or the National Transport Authority.
        </p>
      </footer>
    </div>
  );
}
