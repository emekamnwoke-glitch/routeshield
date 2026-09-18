/**
 * AC-13 Control Workspace: the read model and commands behind the site. It
 * owns no data and reaches the core only through component contracts. It runs
 * inside the core worker, and under Node in the tests.
 */
import type { Core } from "../../../src/core/core";
import type { Circle } from "../../../src/core/kernel/primitives";
import type { Verdict } from "../../../src/core/modules/ac-07-decision-manager/contract";
import { DecisionRefused } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";

export type Storage = "opfs" | "memory";

export type IncidentInput = { lat: number; lon: number; radiusM: number; description: string };

export type DisruptionView = {
  id: string;
  status: string;
  footprint: Circle;
  createdAt: string;
  recommendation: {
    id: string;
    band: string;
    confidence: string;
    optionKind: string;
    stopsLost: number;
  } | null;
  decision: { verdict: Verdict; decidedBy: string; decidedAt: string } | null;
  serviceState: string | null;
  notices: { channel: string; kind: string }[];
};

export type TrailEntry = { seq: number; at: string; component: string; type: string; actor: string | null };

export type WorkspaceState = {
  storage: Storage;
  disruptions: DisruptionView[];
  trail: TrailEntry[];
  chain: { ok: boolean; events: number; snapshots: number; problems: string[] };
  components: string[];
};

export type Request =
  | { kind: "state" }
  | { kind: "report"; incident: IncidentInput }
  | { kind: "decide"; persona: PersonaId; recommendationId: string; verdict: Verdict }
  | { kind: "reset" };

export type Response = { ok: true; state: WorkspaceState; notice?: string } | { ok: false; error: string };

const TRAIL_LENGTH = 40;

export function readState(core: Core, storage: Storage): Promise<WorkspaceState> {
  return core.store.read(async (tx) => {
    const disruptions = core.disruptions.list(tx).map((d): DisruptionView => {
      const rec = core.support.forDisruption(tx, d.id);
      const option = rec && core.optimiser.options(tx, rec.assessmentId).find((o) => o.id === rec.optionId);
      const decision = rec ? core.decisions.forRecommendation(tx, rec.id) : undefined;
      return {
        id: d.id,
        status: d.status,
        footprint: d.latest.footprint,
        createdAt: d.createdAt,
        recommendation:
          rec && option
            ? { id: rec.id, band: rec.band, confidence: rec.confidence, optionKind: option.kind, stopsLost: option.stopsLost }
            : null,
        decision: decision
          ? { verdict: decision.verdict, decidedBy: decision.decidedBy.id, decidedAt: decision.decidedAt }
          : null,
        serviceState: core.serviceState.current(tx, d.id)?.state ?? null,
        notices: core.communications.notices(tx, d.id).map((n) => ({ channel: n.channel, kind: n.kind })),
      };
    });
    const events = core.ledger.events(tx);
    return {
      storage,
      disruptions,
      trail: events
        .slice(-TRAIL_LENGTH)
        .reverse()
        .map((e) => ({ seq: e.seq, at: e.at, component: e.component, type: e.type, actor: e.actor?.id ?? null })),
      chain: await core.ledger.verify(tx),
      components: [...new Set(events.map((e) => e.component))].sort(),
    };
  });
}

async function settle(core: Core): Promise<void> {
  await core.bus.dispatch();
  await core.analytics.refresh();
}

/** Handles every request except reset, which needs a fresh store and is the worker's job. */
export async function handle(core: Core, storage: Storage, req: Request): Promise<Response> {
  try {
    switch (req.kind) {
      case "state":
        return { ok: true, state: await readState(core, storage) };
      case "report": {
        const { lat, lon, radiusM, description } = req.incident;
        await core.sources.reportIncident({
          source: "fictional-incident-feed",
          externalRef: `demo-${core.clock.now()}`,
          area: { lat, lon, radiusM },
          description,
        });
        await settle(core);
        return { ok: true, state: await readState(core, storage), notice: "Incident reported and assessed." };
      }
      case "decide": {
        let notice: string;
        try {
          const d = await core.decisions.decide(
            { kind: "persona", id: req.persona },
            req.recommendationId,
            req.verdict,
            "decided in the demonstrator",
          );
          notice = d.verdict === "approve" ? "Approved. Service state and passenger notice updated." : "Rejected.";
        } catch (err) {
          if (!(err instanceof DecisionRefused)) throw err;
          notice = `Refused, and the refusal is in the audit trail: ${err.message}.`;
        }
        await settle(core);
        return { ok: true, state: await readState(core, storage), notice };
      }
      case "reset":
        return { ok: false, error: "reset is handled by the core worker" };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
