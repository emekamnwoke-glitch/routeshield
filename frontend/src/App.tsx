import { useEffect, useState } from "react";
import type { PersonaId } from "../../src/core/modules/ac-14-access-control/contract";
import { AuditScreen } from "./audit/AuditScreen";
import { IncidentsScreen } from "./incidents/IncidentsScreen";
import { proposalLines } from "./incidents/incidents";
import { MyProposals } from "./incidents/MyProposals";
import { MapScreen } from "./map/MapScreen";
import { ReportSheet } from "./map/ReportSheet";
import { ReviewQueue } from "./ReviewQueue";
import { queueRows } from "./review/queue";
import { RoleSwitcher } from "./shell/RoleSwitcher";
import type { Failure } from "./shell/failure";
import { failureText } from "./shell/failure";
import { Icon } from "./shell/Icon";
import { ScreenHead } from "./shell/ScreenHead";
import type { Screen } from "./shell/screens";
import { SCREENS, SCREEN_META, homeScreen } from "./shell/screens";
import { SiteNote } from "./shell/SiteNote";
import type { Snack } from "./shell/Snackbar";
import { Snackbar } from "./shell/Snackbar";
import type { SiteNetwork } from "./map/network";
import { loadNetwork } from "./map/network";
import { placeAt, withPlaces } from "./map/roads";
import { CoreClient } from "./worker/client";
import type { Request, WorkspaceState } from "./workspace/service";
import { DEFAULT_INCIDENT } from "./workspace/service";

const DEFAULT_PICK = { lat: DEFAULT_INCIDENT.lat, lon: DEFAULT_INCIDENT.lon }; // O'Connell Street

/** A command is a request without the persona, which the page adds from the role switcher. */
type Command = Request extends infer R ? (R extends unknown ? Omit<R, "persona"> : never) : never;

// One core worker per page: it is the only writer of the store (ADR-0010), and
// a second one would contend for the same OPFS file.
const client = new CoreClient();

/**
 * The site, as the Round 3 prototype plays it: one screen per role and a shared network map.
 * The controller lands on Incidents, the duty manager on the Review queue and the administrator on the Audit trail.
 * The snackbar's actions hand the story over from one role to the next.
 */
export function App() {
  const [network, setNetwork] = useState<SiteNetwork | null>(null);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState<PersonaId>("controller");
  const [screen, setScreen] = useState<Screen>(homeScreen("controller"));
  const [route, setRoute] = useState<number | null>(null);
  const [pick, setPick] = useState(DEFAULT_PICK);
  const [radiusM, setRadiusM] = useState(DEFAULT_INCIDENT.radiusM);
  const [description, setDescription] = useState(DEFAULT_INCIDENT.description);
  const [reporting, setReporting] = useState(false);
  // Where a list opens: the incident a hand-over or a new report names. A new landing remounts the list.
  const [landing, setLanding] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });

  const land = (id: string | null) => setLanding((l) => ({ id, n: l.n + 1 }));

  const send = async (cmd: Command, as: PersonaId = persona): Promise<WorkspaceState | null> => {
    setBusy(true);
    const res = await client.request({ ...cmd, persona: as } as Request);
    setBusy(false);
    if (res.ok) {
      setState(res.state);
      // A plain refresh (a role switch) keeps the last message.
      if (cmd.kind !== "state" || res.notice) setSnack(res.notice ? { text: res.notice } : null);
      // A network failure stands until the network loads; anything else is cleared by a request that works.
      setFailure((f) => (f?.kind === "network" ? f : null));
      return res.state;
    }
    setFailure({ kind: cmd.kind === "state" ? "state" : "command", detail: res.error });
    return null;
  };

  /** Act as another role, landing on its home screen at the given incident (the snackbar's hand-overs). */
  const handOver = (p: PersonaId, id: string | null = null) => {
    setSnack(null);
    setReporting(false);
    setPersona(p);
    setScreen(homeScreen(p));
    land(id);
  };

  // Reporting starts from + or a click on an incident map; the sheet opens over the panel (prototype P2).
  const startReport = (at?: { lat: number; lon: number }) => {
    setPick(at ?? DEFAULT_PICK);
    if (screen !== "map") setScreen("incidents");
    setSnack(null);
    setReporting(true);
  };

  const report = async () => {
    const next = await send({ kind: "report", incident: { ...pick, radiusM, description: description.trim() } });
    if (next) {
      setReporting(false);
      setScreen("incidents");
      land(next.disruptions.at(-1)?.id ?? null); // the new incident, selected with its panel open (P3)
    }
  };

  const propose = async (recommendationId: string, verdict: "approve" | "reject") => {
    if (await send({ kind: "propose", recommendationId, verdict })) {
      setSnack(
        (s) =>
          s &&
          (s.text.startsWith("Proposed")
            ? { ...s, action: { label: "Continue as duty manager", run: () => handOver("duty-manager") } }
            : s),
      );
    }
  };

  const review = async (proposalId: string, outcome: "approve" | "deny", reason: string) => {
    const next = await send({ kind: "review", proposalId, outcome, reason });
    if (next) {
      const open = next.disruptions.find((d) => d.proposal?.id === proposalId)?.id ?? null;
      setSnack((s) =>
        s && !s.text.startsWith("Refused")
          ? { ...s, action: { label: "See the controller's view", run: () => handOver("controller", open) } }
          : s,
      );
    }
  };

  const reset = async () => {
    handOver("controller");
    await send({ kind: "reset" }, "controller");
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

  const switchRole = (p: PersonaId) => handOver(p);

  // Incidents are named by the street they are on, from the map's road names.
  const disruptions = withPlaces(network, state?.disruptions ?? []);
  const declined = withPlaces(network, state?.declined ?? []);
  const failedState = failure?.kind === "state" && state === null;
  const note = <SiteNote storage={state?.storage ?? null} />;
  const pickAt = (lat: number, lon: number) => startReport({ lat, lon });
  // A list remounts on a new landing, and once the first state arrives, so it opens on the right filter.
  const listKey = `${landing.n}-${state ? "ready" : "loading"}`;

  const sheet = reporting && (
    <ReportSheet
      pick={pick}
      place={network ? placeAt(network, pick.lat, pick.lon) : null}
      radiusM={radiusM}
      description={description}
      busy={busy}
      disabled={!state?.network.loaded}
      onRadius={setRadiusM}
      onDescription={setDescription}
      onCancel={() => setReporting(false)}
      onReport={() => void report()}
    />
  );

  return (
    <div className="shell">
      <aside className={persona === "controller" ? "rail" : "rail no-fab"} aria-label="Navigation">
        {persona === "controller" && (
          <button
            type="button"
            className="fab"
            title="Report an incident"
            aria-label="Report an incident"
            onClick={() => startReport()}
          >
            <Icon name="add" />
          </button>
        )}
        {/* As the prototype: icon and label only. Each screen's filter chips carry the counts. */}
        <nav aria-label="Screens">
          {SCREENS[persona].map((s) => (
            <a
              key={s}
              href={`#${s}`}
              title={SCREEN_META[s].title}
              aria-current={screen === s ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setReporting(false);
                land(null);
                setScreen(s);
              }}
            >
              <span className="indicator" aria-hidden="true">
                <Icon name={SCREEN_META[s].icon} />
              </span>
              <span className="label">{SCREEN_META[s].label}</span>
            </a>
          ))}
        </nav>
        <RoleSwitcher persona={persona} busy={busy} onSwitch={switchRole} onReset={() => void reset()} />
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
              <Icon name="close" />
            </button>
          </div>
        )}

        {screen === "incidents" && (
          <IncidentsScreen
            key={listKey}
            openId={landing.id}
            persona={persona}
            disruptions={state ? disruptions : null}
            declined={declined}
            failed={failedState}
            onRetry={retry}
            busy={busy}
            network={network}
            vehicles={state?.vehicles ?? []}
            onPropose={(recommendationId, verdict) => void propose(recommendationId, verdict)}
            onPick={(lat, lon) => (reporting ? setPick({ lat, lon }) : pickAt(lat, lon))}
            onReportAgain={startReport}
            picking={reporting ? { ...pick, radiusM } : null}
            sheet={sheet || null}
            note={note}
          />
        )}

        {screen === "review" && (
          <ReviewQueue
            key={listKey}
            rows={state ? queueRows(disruptions, declined) : null}
            failed={failedState}
            onRetry={retry}
            busy={busy}
            onReview={(proposalId, outcome, reason) => void review(proposalId, outcome, reason)}
            network={network}
            disruptions={disruptions}
            vehicles={state?.vehicles ?? []}
            onPick={pickAt}
            note={note}
          />
        )}

        {screen === "audit" && (
          <AuditScreen
            audit={state?.audit ?? null}
            disruptions={disruptions}
            failed={failedState}
            busy={busy}
            onRetry={retry}
            onOpenIncident={(id) => {
              land(id);
              setScreen("incidents");
            }}
            note={note}
          />
        )}

        {screen === "proposals" && (
          <div className="screen single">
            <section className="screen-main" aria-label="My proposals">
              <ScreenHead title="My proposals" />
              <MyProposals lines={proposalLines(disruptions, declined)} onReportAgain={startReport} />
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

        {screen === "map" && sheet}

        <Snackbar snack={!state && !failure ? { text: "Loading the road network and fleet…" } : snack} />
      </div>
    </div>
  );
}
