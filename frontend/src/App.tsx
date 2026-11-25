import { useEffect, useState } from "react";
import type { PersonaId } from "../../src/core/modules/ac-14-access-control/contract";
import { AuditScreen } from "./audit/AuditScreen";
import { IncidentsScreen } from "./incidents/IncidentsScreen";
import { stageOf } from "./incidents/incidents";
import { MapScreen } from "./map/MapScreen";
import { ReportSheet } from "./map/ReportSheet";
import { Noticeboard } from "./Noticeboard";
import { ReviewQueue } from "./ReviewQueue";
import { queueRows } from "./review/queue";
import { RoleSwitcher } from "./shell/RoleSwitcher";
import type { Failure } from "./shell/failure";
import { failureText } from "./shell/failure";
import { ScreenHead } from "./shell/ScreenHead";
import type { Screen } from "./shell/screens";
import { SCREENS, SCREEN_META, homeScreen } from "./shell/screens";
import { SiteNote } from "./shell/SiteNote";
import type { SiteNetwork } from "./map/network";
import { loadNetwork } from "./map/network";
import { nearestRoad } from "./map/roads";
import { CoreClient } from "./worker/client";
import type { Request, WorkspaceState } from "./workspace/service";

const DEFAULT_PICK = { lat: 53.3498, lon: -6.2603 }; // O'Connell Street

/** A command is a request without the persona, which the page adds from the role switcher. */
type Command = Request extends infer R ? (R extends unknown ? Omit<R, "persona"> : never) : never;

// One core worker per page: it is the only writer of the store (ADR-0010), and
// a second one would contend for the same OPFS file.
const client = new CoreClient();

/**
 * The site: one screen per role (Figma frames A, D and E) and a shared network map.
 * The controller lands on Incidents, the duty manager on the Review queue and the administrator on the Audit trail.
 */
export function App() {
  const [network, setNetwork] = useState<SiteNetwork | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState<PersonaId>("controller");
  const [screen, setScreen] = useState<Screen>(homeScreen("controller"));
  const [route, setRoute] = useState<number | null>(null);
  const [pick, setPick] = useState(DEFAULT_PICK);
  const [radiusM, setRadiusM] = useState(150);
  const [description, setDescription] = useState("");
  const [reporting, setReporting] = useState(false);

  // Moving the closure suggests the place again, from the nearest named bus road.
  useEffect(() => {
    if (network) setDescription(nearestRoad(network, pick.lat, pick.lon) ?? "");
  }, [network, pick]);

  const send = async (cmd: Command, as: PersonaId = persona): Promise<boolean> => {
    setBusy(true);
    const res = await client.request({ ...cmd, persona: as } as Request);
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      // A plain refresh (a role switch) keeps the last command's message.
      if (cmd.kind !== "state" || res.notice) setNotice(res.notice ?? null);
      // A network failure stands until the network loads; anything else is cleared by a request that works.
      setFailure((f) => (f?.kind === "network" ? f : null));
    } else {
      setFailure({ kind: cmd.kind === "state" ? "state" : "command", detail: res.error });
    }
    return res.ok;
  };

  // Reporting happens on the map: + in the rail, or a click on any incident screen's map, opens it there.
  const startReport = (at?: { lat: number; lon: number }) => {
    if (at) setPick(at);
    setScreen("map");
    setReporting(true);
  };

  const report = async () => {
    if (await send({ kind: "report", incident: { ...pick, radiusM, description: description.trim() } })) {
      setReporting(false);
      setScreen("incidents"); // every role has the incident list: the new incident is there
    }
  };

  const loadMap = () => {
    setFailure((f) => (f?.kind === "network" ? null : f));
    loadNetwork()
      .then((n) => {
        setNetwork(n);
        const e2 = n.routes.findIndex((r) => r.code === "E2");
        setRoute(e2 >= 0 ? e2 : null);
      })
      .catch((err: unknown) => setFailure({ kind: "network", detail: String(err) }));
  };

  const retry = () => (failure?.kind === "network" ? loadMap() : void send({ kind: "state" }));

  useEffect(loadMap, []); // load once

  // Each persona sees its own view: the core returns the audit trail only to a persona that may read it.
  useEffect(() => {
    void send({ kind: "state" }, persona);
  }, [persona]);

  const switchRole = (p: PersonaId) => {
    setPersona(p);
    setScreen(homeScreen(p));
    setReporting(false);
  };

  const disruptions = state?.disruptions ?? [];
  const failedState = failure?.kind === "state" && state === null;
  const needs = disruptions.filter((d) => stageOf(d) === "needs" && (d.recommendation?.items.length ?? 0) > 0).length;
  const pending = disruptions.filter((d) => d.proposal?.status === "pending").length;
  const badge: Partial<Record<Screen, { n: number; text: string }>> =
    persona === "controller"
      ? { incidents: { n: needs, text: "need a proposal" } }
      : persona === "duty-manager"
        ? { review: { n: pending, text: "awaiting review" } }
        : {};
  const note = <SiteNote storage={state?.storage ?? null} />;
  const pickAt = (lat: number, lon: number) => startReport({ lat, lon });

  return (
    <div className="shell">
      <aside className="rail" aria-label="Navigation">
        {persona === "controller" && (
          <button type="button" className="fab" title="Report an incident" aria-label="Report an incident" onClick={() => startReport()}>
            +
          </button>
        )}
        <nav aria-label="Screens">
          {SCREENS[persona].map((s) => {
            const b = badge[s];
            return (
              <a
                key={s}
                href={`#${s}`}
                title={SCREEN_META[s].title}
                aria-current={screen === s ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  setScreen(s);
                }}
              >
                <span className="indicator" aria-hidden="true">
                  {SCREEN_META[s].icon}
                  {b && b.n > 0 && <i>{b.n}</i>}
                </span>
                <span className="label">{SCREEN_META[s].label}</span>
                {b && b.n > 0 && <span className="visually-hidden">{` ${b.n} ${b.text}`}</span>}
              </a>
            );
          })}
        </nav>
        <RoleSwitcher
          persona={persona}
          busy={busy}
          onSwitch={switchRole}
          onReset={() => void send({ kind: "reset" })}
          onScenario={() => {
            // The scenario starts where frame D does: the controller's incident list.
            setPersona("controller");
            setScreen("incidents");
            setReporting(false);
            void send({ kind: "scenario" }, "controller");
          }}
        />
      </aside>

      <div className="workspace">
        {failure && (
          <div className="alert" role="alert">
            <span aria-hidden="true">!</span>
            <p>
              <b>{failureText(failure).title}</b> {failureText(failure).body}
            </p>
            {failureText(failure).retry && (
              <button type="button" className="text" onClick={retry} disabled={busy}>
                {failureText(failure).retry}
              </button>
            )}
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setFailure(null)}>
              ✕
            </button>
          </div>
        )}

        {screen === "incidents" && (
          <IncidentsScreen
            persona={persona}
            disruptions={state ? disruptions : null}
            failed={failedState}
            onRetry={retry}
            noticeboard={state?.noticeboard ?? []}
            busy={busy}
            network={network}
            vehicles={state?.vehicles ?? []}
            onPropose={(recommendationId, verdict) => void send({ kind: "propose", recommendationId, verdict })}
            onPick={pickAt}
            onShowProposals={() => setScreen("proposals")}
            note={note}
          />
        )}

        {screen === "review" && (
          <ReviewQueue
            rows={state ? queueRows(disruptions, state.noticeboard) : null}
            failed={failedState}
            onRetry={retry}
            busy={busy}
            onReview={(proposalId, outcome, reason) => void send({ kind: "review", proposalId, outcome, reason })}
            network={network}
            disruptions={disruptions}
            vehicles={state?.vehicles ?? []}
            onPick={pickAt}
            note={note}
          />
        )}

        {screen === "audit" && <AuditScreen audit={state?.audit ?? null} failed={failedState} busy={busy} onRetry={retry} note={note} />}

        {screen === "proposals" && (
          <div className="screen single">
            <section className="screen-main" aria-label="My proposals">
              <ScreenHead title="My proposals" />
              <Noticeboard items={state?.noticeboard ?? []} />
              {note}
            </section>
          </div>
        )}

        {screen === "map" && (
          <MapScreen
            network={network}
            networkFailed={failure?.kind === "network" ? failureText(failure).title : null}
            onRetryNetwork={loadMap}
            state={state}
            route={route}
            onRoute={setRoute}
            pick={pick}
            reporting={reporting}
            radiusM={radiusM}
            onPick={(lat, lon) => {
              setPick({ lat, lon });
              setReporting(true);
            }}
            onReport={() => setReporting(true)}
            note={note}
          />
        )}

        {reporting && screen === "map" && (
          <ReportSheet
            pick={pick}
            radiusM={radiusM}
            description={description}
            busy={busy}
            disabled={!state?.network.loaded}
            onRadius={setRadiusM}
            onDescription={setDescription}
            onCancel={() => setReporting(false)}
            onReport={() => void report()}
          />
        )}

        <p className={notice || (!state && !failure) ? "status shown" : "status"} role="status" aria-live="polite">
          {!state && !failure ? "Loading the road network and fleet…" : notice}
        </p>
      </div>
    </div>
  );
}
