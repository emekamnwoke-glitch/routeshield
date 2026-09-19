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
const DOCS = `${REPO}/blob/main/docs`;
const DEFAULT_PICK = { lat: 53.3498, lon: -6.2603 }; // O'Connell Street
const RADII = [100, 150, 300, 500];

// Sidebar entries jump to sections of this one page; the last two leave the site.
const NAV = [
  { href: "#network", icon: "◉", label: "Network" },
  { href: "#disruptions", icon: "△", label: "Disruptions" },
  { href: "#routes", icon: "⌁", label: "Routes affected" },
  { href: "#audit", icon: "▤", label: "Audit trail" },
  { href: `${DOCS}/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md`, icon: "◇", label: "Architecture" },
  { href: REPO, icon: "⌂", label: "Source" },
];

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

  const disruptions = state?.disruptions ?? [];
  const awaiting = disruptions.filter((d) => d.recommendation && d.recommendation.items.length > 0 && !d.decision).length;
  const patterns = disruptions.reduce((n, d) => n + (d.impact?.patterns.length ?? 0), 0);
  const approaching = disruptions.reduce((n, d) => n + (d.impact?.vehicles.approaching ?? 0), 0);
  const inside = disruptions.reduce((n, d) => n + (d.impact?.vehicles.inside ?? 0), 0);
  const personaName = PERSONAS.find((p) => p.id === persona)?.name ?? persona;
  // Display only: the core checks authority itself when a decision is made (AC-14).
  const hasAuthority = persona === "controller";

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href={REPO}>
          <span aria-hidden="true">▣</span>
          <b>
            RouteShield
            <small>Emergency bus rerouting · reference implementation</small>
          </b>
        </a>
        <nav aria-label="Sections">
          {NAV.map((n) => (
            <a key={n.label} href={n.href} title={n.label}>
              <span className="icon" aria-hidden="true">
                {n.icon}
              </span>
              <span className="label">{n.label}</span>
              {n.href === "#disruptions" && awaiting > 0 && (
                <i>
                  {awaiting}
                  <span className="visually-hidden"> awaiting a decision</span>
                </i>
              )}
            </a>
          ))}
        </nav>
        <p className="city">
          DUBLIN<small>synthetic demonstrator</small>
        </p>
      </aside>

      <div className="workspace">
        <header>
          <div>
            <p>ROUTESHIELD · v1.2.0</p>
            <h1>Control Workspace</h1>
            <small>Observe → Assess → Recommend → Authorise → Execute → Audit</small>
          </div>
          <div className="health">
            <b className={awaiting ? "attention" : undefined}>
              ● {awaiting ? `${awaiting} awaiting a decision` : disruptions.length ? "All disruptions decided" : "No disruptions"}
            </b>
            <small>
              {network?.routes.length ?? "—"} routes · {state?.vehicles.length ?? "—"} buses (synthetic)
            </small>
          </div>
          <div className="time" title="Vehicle positions come from the timetable, not a live feed">
            <small>Scenario time</small>
            <b>Mon 08:00</b>
            <em>TIMETABLE</em>
          </div>
          <label className="persona">
            <span aria-hidden="true">●</span>
            <span className="who">
              <small>Acting as</small>
              <select value={persona} onChange={(e) => setPersona(e.target.value as PersonaId)}>
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <small title="Persona switcher: nobody is signed in or authenticated (ADR-0012)">
                Decision authority: {hasAuthority ? "yes" : "no"} · not signed in
              </small>
            </span>
          </label>
        </header>

        <p className="banner" role="note">
          <b>Fictional reference implementation</b>
          <span>
            The bus network is real (NTA GTFS, OpenStreetMap). Incidents, decisions, notices and fleet positions are
            invented, and no operator's system is connected.
          </span>
          <a href={`${DOCS}/02-stage-two-reference-implementation/fact-vs-assumption-model.md`}>Why this matters ↗</a>
        </p>

        <main>
          <section className="network" id="network" aria-label="Network map">
            <div className="title">
              <div>
                <p>NETWORK</p>
                <h2>Dublin bus network, 11-route sample</h2>
              </div>
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
                footprints={disruptions.map((d) => d.footprint)}
                blocked={disruptions.flatMap((d) => d.impact?.blockedLines ?? [])}
                detours={disruptions.flatMap(
                  (d) => d.recommendation?.items.flatMap((i) => (i.detour.length ? [i.detour] : [])) ?? [],
                )}
                vehicles={state?.vehicles ?? []}
                pick={pick}
                onPick={(lat, lon) => setPick({ lat, lon })}
              />
            ) : (
              <p className="loading">{error ? "The network could not be loaded." : "Loading the Dublin network…"}</p>
            )}
            <p className="map-note">Click the map to place a closure. It starts on O'Connell Street.</p>
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
                <span
                  className="swatch"
                  style={{ background: "repeating-linear-gradient(90deg, var(--map-detour) 0 5px, transparent 5px 8px)" }}
                />
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

          <aside className="right">
            <section className="incident" aria-label="Disruption summary">
              <p>DISRUPTIONS</p>
              <h2>{disruptions.length ? `${disruptions.length} reported` : "Network clear"}</h2>
              <span className={awaiting ? "pill major" : "pill"}>{awaiting ? "Decision needed" : "No decision pending"}</span>
              <small>
                {disruptions.length
                  ? "Totals across every reported disruption. Each is listed below with its own decision."
                  : "Report a closure to see what it cuts and a suggested bypass for each affected route."}
              </small>
              <div>
                <span>
                  <b>{patterns}</b>Patterns cut
                </span>
                <span>
                  <b>{approaching}</b>Approaching
                </span>
                <span>
                  <b>{inside}</b>Inside
                </span>
              </div>
            </section>

            <section className="card" id="disruptions">
              <div className="title">
                <div>
                  <p>DECISION SUPPORT</p>
                  <h2>Suggested bypasses</h2>
                </div>
              </div>
              <p className="hint">
                One suggested bypass per affected route pattern, dashed on the map, for a person to approve or reject.
                They are not alternatives to each other: v1.3.0 ranks several options with their costs.
              </p>
              {disruptions.length ? (
                <ul className="disruptions">
                  {disruptions.map((d) => (
                    <DisruptionCard key={d.id} d={d} busy={busy} onDecide={decide} />
                  ))}
                </ul>
              ) : (
                <p className="hint">None yet. Report an incident to start one.</p>
              )}
              {!hasAuthority && awaiting > 0 && (
                <p className="hint">{personaName} holds no decision authority, so an approval will be refused.</p>
              )}
            </section>

            <section className="card report">
              <p>OBSERVE</p>
              <h2>Report an incident</h2>
              <small className="coords">
                {pick.lat.toFixed(5)}, {pick.lon.toFixed(5)}
              </small>
              <div>
                <label>
                  Radius
                  <select value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))}>
                    {RADII.map((r) => (
                      <option key={r} value={r}>
                        {r} m
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Description
                  <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} />
                </label>
              </div>
              <button
                type="button"
                className="primary full"
                disabled={busy || !state?.network.loaded}
                onClick={() => send({ kind: "report", incident: { ...pick, radiusM, description: description || "Incident" } })}
              >
                Report incident
              </button>
            </section>
          </aside>

          <section className="lower">
            <div id="routes">
              <RouteStatusCard routes={routeStatuses(state)} />
            </div>
            <section className="card activity" id="audit">
              <div className="title">
                <div>
                  <p>GOVERNANCE</p>
                  <h2>Audit trail</h2>
                </div>
                {state && <b className={state.chain.ok ? "ok" : "bad"}>● {state.chain.ok ? "Chain verified" : "Chain broken"}</b>}
              </div>
              {state && (
                <p className="hint">
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
                    <b>#{t.seq}</b> {t.type}
                    <small>
                      {t.component}
                      {t.actor && ` · ${t.actor}`}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
          </section>
        </main>

        <p className="status" role="status" aria-live="polite">
          {error ? `Error: ${error}` : !state ? "Loading the road network and fleet…" : notice}
        </p>

        <footer>
          <div>
            {(network?.attribution ?? []).map((a) => (
              <p key={a}>{a}</p>
            ))}
            <p>
              <a href={REPO}>Architecture and source on GitHub</a> · Independent portfolio project, not affiliated with
              Dublin Bus or the National Transport Authority.
            </p>
          </div>
          <div className="store">
            <small>
              {state?.storage === "opfs"
                ? "Stored in this browser (OPFS). It survives a reload."
                : "Stored in memory: this browser refused OPFS, so a reload starts again."}
            </small>
            <button type="button" disabled={busy} onClick={() => send({ kind: "reset" })}>
              Start again
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
