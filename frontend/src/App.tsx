import { useEffect, useState } from "react";
import type { PersonaId } from "../../src/core/modules/ac-14-access-control/contract";
import { DisruptionCard } from "./DisruptionCard";
import { NetworkMap } from "./map/NetworkMap";
import { Noticeboard } from "./Noticeboard";
import { ReviewQueue } from "./ReviewQueue";
import { RouteStatusCard } from "./RouteStatusCard";
import { RoleSwitcher } from "./shell/RoleSwitcher";
import { roleName } from "./shell/roles";
import { routeStatuses } from "./routeStatus";
import type { SiteNetwork } from "./map/network";
import { loadNetwork } from "./map/network";
import { CoreClient } from "./worker/client";
import type { Request, WorkspaceState } from "./workspace/service";

const REPO = "https://github.com/emekamnwoke-glitch/routeshield";
const DOCS = `${REPO}/blob/main/docs`;
const DEFAULT_PICK = { lat: 53.3498, lon: -6.2603 }; // O'Connell Street
const RADII = [100, 150, 300, 500];

/** A command is a request without the persona, which the page adds from the role switcher. */
type Command = Request extends infer R ? (R extends unknown ? Omit<R, "persona"> : never) : never;

// Navigation rail: each entry jumps to a section of this one page. The audit entry appears only
// for a persona the core returns the audit trail to (AC-14 read_audit).
const NAV = [
  { href: "#network", icon: "◉", label: "Network", title: "Network map", audit: false },
  { href: "#observe", icon: "＋", label: "Observe", title: "Report an incident", audit: false },
  { href: "#disruption", icon: "△", label: "Disruption", title: "Disruption summary", audit: false },
  { href: "#routes", icon: "⌁", label: "Routes", title: "Routes affected", audit: false },
  { href: "#decision-support", icon: "◎", label: "Decisions", title: "Decision support", audit: false },
  { href: "#audit", icon: "▤", label: "Audit", title: "Audit trail", audit: true },
];
const ARCHITECTURE = `${DOCS}/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md`;

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
  const [section, setSection] = useState("#network");

  const send = async (cmd: Command, as: PersonaId = persona) => {
    setBusy(true);
    const res = await client.request({ ...cmd, persona: as } as Request);
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
  }, []); // load once

  // Each persona sees its own view: the core returns the audit trail only to a persona that may read it.
  useEffect(() => {
    void send({ kind: "state" }, persona);
  }, [persona]);

  const disruptions = state?.disruptions ?? [];
  const audit = state?.audit ?? null;
  const awaiting = disruptions.filter((d) => d.recommendation && d.recommendation.items.length > 0 && !d.decision).length;
  const pending = disruptions.filter((d) => d.proposal?.status === "pending");
  const patterns = disruptions.reduce((n, d) => n + (d.impact?.patterns.length ?? 0), 0);
  const approaching = disruptions.reduce((n, d) => n + (d.impact?.vehicles.approaching ?? 0), 0);
  const inside = disruptions.reduce((n, d) => n + (d.impact?.vehicles.inside ?? 0), 0);
  const personaName = roleName(persona);
  const nav = NAV.filter((n) => !n.audit || audit !== null);

  return (
    <div className="shell">
      <aside className="rail" aria-label="Navigation">
        <a className="brand" href={REPO} title="RouteShield on GitHub: emergency bus rerouting, reference implementation">
          <span aria-hidden="true">▣</span>
          <span className="visually-hidden">RouteShield source on GitHub</span>
        </a>
        <nav aria-label="Sections">
          {nav.map((n) => (
            <a
              key={n.label}
              href={n.href}
              title={n.title}
              aria-current={section === n.href ? "location" : undefined}
              onClick={() => setSection(n.href)}
            >
              <span className="indicator" aria-hidden="true">
                {n.icon}
                {n.href === "#decision-support" && (awaiting > 0 || pending.length > 0) && <i>{pending.length || awaiting}</i>}
              </span>
              <span className="label">{n.label}</span>
              {n.href === "#decision-support" && (awaiting > 0 || pending.length > 0) && (
                <span className="visually-hidden">
                  {pending.length ? ` awaiting review` : ` awaiting a decision`}
                </span>
              )}
            </a>
          ))}
        </nav>
        <RoleSwitcher
          persona={persona}
          busy={busy}
          onSwitch={setPersona}
          onReset={() => void send({ kind: "reset" })}
        />
      </aside>

      <div className="workspace">
        <header>
          <div>
            <p>ROUTESHIELD · v1.2.0 · DUBLIN, SYNTHETIC</p>
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
          {/* The map stays in view while the menus on the right scroll. */}
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
            {/* Observe: report what is happening. */}
            <section className="card report" id="observe" aria-label="Observe">
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

            {/* Disruption: what the reported closures cut. */}
            <section className="incident" id="disruption" aria-label="Disruption summary">
              <p>DISRUPTION</p>
              <h2>{disruptions.length ? `${disruptions.length} reported` : "Network clear"}</h2>
              <span className={awaiting ? "pill major" : "pill"}>{awaiting ? "Decision needed" : "No decision pending"}</span>
              <small>
                {disruptions.length
                  ? "Totals across every reported disruption. Each is listed under Decision support with its own decision."
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

            {/* Routes affected: the status of each route the closures touch. */}
            <div id="routes">
              <RouteStatusCard routes={routeStatuses(state)} />
            </div>

            {/* Decision support: the bypasses, and the maker-checker step for the persona acting. */}
            <section className="card" id="decision-support">
              <div className="title">
                <div>
                  <p>DECISION SUPPORT</p>
                  <h2>Suggested bypasses</h2>
                </div>
              </div>
              <p className="hint">
                One suggested bypass per affected route pattern, dashed on the map. A controller proposes a verdict; a duty
                manager approves or denies it. They are not alternatives to each other: v1.3.0 ranks several options with
                their costs.
              </p>
              {persona === "duty-manager" && <ReviewQueue items={pending} busy={busy} onReview={(proposalId, outcome, reason) => send({ kind: "review", proposalId, outcome, reason })} />}
              {persona === "controller" && <Noticeboard items={state?.noticeboard ?? []} />}
              {disruptions.length ? (
                <ul className="disruptions">
                  {disruptions.map((d) => (
                    <DisruptionCard
                      key={d.id}
                      d={d}
                      persona={persona}
                      busy={busy}
                      onPropose={(recommendationId, verdict) => send({ kind: "propose", recommendationId, verdict })}
                    />
                  ))}
                </ul>
              ) : (
                <p className="hint">None yet. Report an incident to start one.</p>
              )}
              {persona === "administrator" && <p className="hint">The administrator reads the audit trail and does not decide.</p>}
              {persona === "contingency-approver" && <p className="hint">{personaName} holds no decision authority here.</p>}
            </section>

            {/* Audit trail: its own menu, shown only to the administrator (AC-14 read_audit). */}
            {audit && (
              <section className="card activity" id="audit" aria-label="Audit trail">
                <div className="title">
                  <div>
                    <p>GOVERNANCE</p>
                    <h2>Audit trail</h2>
                  </div>
                  <b className={audit.chain.ok ? "ok" : "bad"}>● {audit.chain.ok ? "Chain verified" : "Chain broken"}</b>
                </div>
                <p className="hint">
                  {audit.chain.ok
                    ? `Hash chain verified: ${audit.chain.events} events, ${audit.chain.snapshots} snapshots.`
                    : `Hash chain broken: ${audit.chain.problems.join("; ")}`}
                </p>
                {audit.components.length > 0 && <p className="hint">Components that recorded events: {audit.components.join(", ")}</p>}
                <ol className="trail">
                  {audit.trail.map((t) => (
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
            )}
          </aside>
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
              <a href={ARCHITECTURE}>Architecture</a> · <a href={REPO}>Source on GitHub</a> · Independent portfolio project, not affiliated with
              Dublin Bus or the National Transport Authority.
            </p>
          </div>
          <div className="store">
            <small>
              {state?.storage === "opfs"
                ? "Stored in this browser (OPFS). It survives a reload."
                : "Stored in memory: this browser refused OPFS, so a reload starts again."}
            </small>
          </div>
        </footer>
      </div>
    </div>
  );
}
