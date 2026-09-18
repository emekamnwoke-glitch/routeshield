/**
 * AC-13 Control Workspace: the read model and commands behind the site. It
 * owns no data and reaches the core only through component contracts. It runs
 * inside the core worker, and under Node in the tests.
 */
import type { Core } from "../../../src/core/core";
import type { Network } from "../../../src/core/kernel/network";
import type { Circle } from "../../../src/core/kernel/primitives";
import type { VehicleRelation } from "../../../src/core/modules/ac-04-impact-assessor/contract";
import type { Verdict } from "../../../src/core/modules/ac-07-decision-manager/contract";
import { DecisionRefused } from "../../../src/core/modules/ac-07-decision-manager/contract";
import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";

export type Storage = "opfs" | "memory";

export type IncidentInput = { lat: number; lon: number; radiusM: number; description: string };

export type LatLon = [number, number];

export type PatternView = { patternIndex: number; patternId: string; routeCode: string; towards: string };

export type ImpactView = {
  blockedRoads: number;
  /** Geometry of every blocked road edge. */
  blockedLines: LatLon[][];
  affectedTrips: number;
  patterns: (PatternView & { trips: number; stopsInside: string[]; approaching: number; inside: number })[];
  vehicles: Record<VehicleRelation, number>;
};

export type ItemView = PatternView & {
  kind: "hold" | "reroute" | "contingency";
  divertStop: string | null;
  rejoinStop: string | null;
  stopsLost: string[];
  extraM: number;
  /** The bypass, as one line from the divert stop's edge to the rejoin stop's edge. */
  detour: LatLon[];
};

export type DisruptionView = {
  id: string;
  status: string;
  footprint: Circle;
  createdAt: string;
  impact: ImpactView | null;
  recommendation: { id: string; band: string; confidence: string; items: ItemView[] } | null;
  decision: { verdict: Verdict; decidedBy: string; decidedAt: string } | null;
  serviceStates: { routeCode: string; towards: string; state: string }[];
  notices: { routeCode: string; towards: string; channel: string; kind: string }[];
};

export type VehicleView = { vehicle: string; routeCode: string; lat: number; lon: number; relation: VehicleRelation | null };

export type TrailEntry = { seq: number; at: string; component: string; type: string; actor: string | null };

export type WorkspaceState = {
  storage: Storage;
  network: { loaded: boolean; version: string };
  disruptions: DisruptionView[];
  vehicles: VehicleView[];
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

function patternView(network: Network | undefined, patternIndex: number): PatternView {
  const p = network?.patterns[patternIndex];
  const last = p ? network?.stops[p.stops.at(-1) ?? -1] : undefined;
  return { patternIndex, patternId: p?.id ?? String(patternIndex), routeCode: p?.routeCode ?? "?", towards: last?.name ?? "?" };
}

function stopName(network: Network | undefined, patternIndex: number, k: number | null): string | null {
  if (k === null || !network) return null;
  const p = network.patterns[patternIndex];
  return network.stops[p?.stops[k] ?? -1]?.name ?? null;
}

function detourLine(network: Network, edges: number[]): LatLon[] {
  const out: LatLon[] = [];
  for (const de of edges) {
    const line = network.line(de);
    out.push(...(out.length ? line.slice(1) : line));
  }
  return out;
}

export function readState(core: Core, storage: Storage): Promise<WorkspaceState> {
  const network = core.sources.network();
  return core.store.read(async (tx) => {
    const relations = new Map<string, VehicleRelation>();
    const disruptions = core.disruptions.list(tx).map((d): DisruptionView => {
      const rec = core.support.forDisruption(tx, d.id);
      const assessment = rec && core.impact.assessment(tx, rec.assessmentId);
      const options = new Map(rec ? core.optimiser.options(tx, rec.assessmentId).map((o) => [o.id, o]) : []);
      const decision = rec ? core.decisions.forRecommendation(tx, rec.id) : undefined;
      for (const v of assessment?.vehicles ?? []) if (!relations.has(v.vehicle)) relations.set(v.vehicle, v.relation);

      const count = (r: VehicleRelation, pattern?: number) =>
        (assessment?.vehicles ?? []).filter((v) => v.relation === r && (pattern === undefined || v.patternIndex === pattern))
          .length;

      return {
        id: d.id,
        status: d.status,
        footprint: d.latest.footprint,
        createdAt: d.createdAt,
        impact: assessment
          ? {
              blockedRoads: assessment.blockedEdges.length,
              blockedLines: network ? assessment.blockedEdges.map((e) => network.line(2 * e)) : [],
              affectedTrips: assessment.affectedTrips,
              patterns: assessment.patterns.map((p) => ({
                ...patternView(network, p.patternIndex),
                trips: p.trips,
                stopsInside: p.stopsInside.flatMap((k) => stopName(network, p.patternIndex, k) ?? []),
                approaching: count("approaching", p.patternIndex),
                inside: count("inside", p.patternIndex),
              })),
              vehicles: { approaching: count("approaching"), inside: count("inside"), past: count("past") },
            }
          : null,
        recommendation: rec
          ? {
              id: rec.id,
              band: rec.band,
              confidence: rec.confidence,
              items: rec.items.flatMap((item): ItemView[] => {
                const o = options.get(item.optionId);
                if (!o) return [];
                return [
                  {
                    ...patternView(network, item.patternIndex),
                    kind: o.kind,
                    divertStop: stopName(network, o.patternIndex, o.divertStop),
                    rejoinStop: stopName(network, o.patternIndex, o.rejoinStop),
                    stopsLost: o.stopsLost.flatMap((k) => stopName(network, o.patternIndex, k) ?? []),
                    extraM: o.extraM,
                    detour: network ? detourLine(network, o.detour) : [],
                  },
                ];
              }),
            }
          : null,
        decision: decision
          ? { verdict: decision.verdict, decidedBy: decision.decidedBy.id, decidedAt: decision.decidedAt }
          : null,
        serviceStates: core.serviceState.current(tx, d.id).map((s) => ({ ...patternView(network, s.patternIndex), state: s.state })),
        notices: core.communications
          .notices(tx, d.id)
          .map((n) => ({ ...patternView(network, n.patternIndex), channel: n.channel, kind: n.kind })),
      };
    });
    const events = core.ledger.events(tx);
    return {
      storage,
      network: { loaded: network !== undefined, version: network?.version ?? "none" },
      disruptions,
      vehicles: core.sources.positions(tx).map((v) => ({
        vehicle: v.vehicle,
        routeCode: network?.patterns[v.pattern]?.routeCode ?? "?",
        lat: v.lat,
        lon: v.lon,
        relation: relations.get(v.vehicle) ?? null,
      })),
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
        const state = await readState(core, storage);
        const affected = state.disruptions[0]?.impact?.patterns.length ?? 0;
        return {
          ok: true,
          state,
          notice: affected
            ? `Incident assessed: ${affected} route pattern${affected === 1 ? "" : "s"} affected.`
            : "Incident assessed: no bus route in the sample runs through it.",
        };
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
          notice = d.verdict === "approve" ? "Approved. Service states and passenger notices updated." : "Rejected.";
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
