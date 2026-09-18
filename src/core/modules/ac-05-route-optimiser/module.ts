import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Network } from "../../kernel/network";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { SourceGateway } from "../ac-01-source-gateway/contract";
import type { AffectedPattern, ImpactAssessedPayload, ImpactAssessor } from "../ac-04-impact-assessor/contract";
import { IMPACT_ASSESSED } from "../ac-04-impact-assessor/contract";
import type { ContingencyLibrary } from "../ac-10-contingency-library/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { OptionsGeneratedPayload, ResponseOption, RouteOptimiser } from "./contract";
import { OPTIONS_GENERATED } from "./contract";

type OptionRow = {
  id: string;
  assessment_id: string;
  pattern_index: number;
  kind: ResponseOption["kind"];
  stops_lost: string;
  divert_stop: number | null;
  rejoin_stop: number | null;
  extra_m: number;
  detour: string;
  contingency_route_id: string | null;
};

export type Bypass = { divertStop: number; rejoinStop: number; detour: number[]; stopsLost: number[]; extraM: number };

/** Candidate stops each side of the blockage (ADR-0014). */
const CANDIDATES = 3;
/** A bypass may be at most this much longer than the planned path it replaces. */
const MAX_EXTRA_M = 6_000;

/**
 * The best single bypass for a cut pattern (ADR-0014): for up to three divert
 * stops before the blockage and three rejoin stops after it, the shortest path
 * a bus may take from the end of the divert stop's edge to the start of the
 * rejoin stop's edge, never using a blocked edge. Stops in between are lost
 * unless the bypass runs along their edge. The pair losing fewest stops, then
 * adding least distance, wins. Null when no pair has a path.
 */
export function findBypass(network: Network, cut: AffectedPattern, blocked: ReadonlySet<number>): Bypass | null {
  const pattern = network.patterns[cut.patternIndex];
  if (!pattern || cut.divertStop === null || cut.rejoinStop === null) return null;
  const at = pattern.stopPositions.map((s) => s.pathIndex);
  const lengths = pattern.path.map((de) => network.length(de >> 1));

  let best: Bypass | null = null;
  for (let d = cut.divertStop; d >= Math.max(0, cut.divertStop - CANDIDATES + 1); d--) {
    for (let r = cut.rejoinStop; r <= Math.min(at.length - 1, cut.rejoinStop + CANDIDATES - 1); r++) {
      const a = at[d];
      const b = at[r];
      const leave = a === undefined ? undefined : pattern.path[a];
      const rejoin = b === undefined ? undefined : pattern.path[b];
      if (a === undefined || b === undefined || leave === undefined || rejoin === undefined) continue;
      const planned = lengths.slice(a + 1, b).reduce((m, x) => m + x, 0);
      const route = network.shortestPath(network.head(leave), network.tail(rejoin), blocked, planned + MAX_EXTRA_M);
      if (!route) continue;
      const onDetour = new Set(route.edges);
      const stopsLost: number[] = [];
      for (let k = d + 1; k < r; k++) {
        const edge = pattern.path[at[k] ?? -1];
        if (edge === undefined || !onDetour.has(edge)) stopsLost.push(k);
      }
      const candidate = { divertStop: d, rejoinStop: r, detour: route.edges, stopsLost, extraM: Math.round(route.lengthM - planned) };
      if (
        !best ||
        candidate.stopsLost.length < best.stopsLost.length ||
        (candidate.stopsLost.length === best.stopsLost.length && candidate.extraM < best.extraM)
      ) {
        best = candidate;
      }
    }
  }
  return best;
}

export class RouteOptimiserModule implements CoreModule, RouteOptimiser {
  readonly id = "AC-05";
  readonly name = "Route Optimiser";
  readonly tablePrefix = "ro_";

  constructor(
    private readonly bus: EventBus,
    private readonly ledger: AuditLedger,
    private readonly contingencies: ContingencyLibrary,
    private readonly impact: ImpactAssessor,
    private readonly sources: SourceGateway,
  ) {
    bus.subscribe(IMPACT_ASSESSED, this.id, (tx, e) => this.onAssessed(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ro_option (
      id text primary key,
      assessment_id text not null,
      pattern_index integer not null,
      kind text not null check (kind in ('hold', 'reroute', 'contingency')),
      stops_lost text not null,
      divert_stop integer,
      rejoin_stop integer,
      extra_m real not null,
      detour text not null,
      contingency_route_id text
    )`);
    tx.run("create index if not exists ro_option_assessment on ro_option(assessment_id, pattern_index)");
  }

  private async onAssessed(tx: Tx, event: DomainEvent): Promise<void> {
    const { assessmentId, disruptionId, versionId } = event.payload as ImpactAssessedPayload;
    const assessment = this.impact.assessment(tx, assessmentId);
    if (!assessment) throw new Error(`assessment ${assessmentId} not found`);
    const network = this.sources.network();
    const blocked = new Set(assessment.blockedEdges);
    const contingencies = this.contingencies.candidates(tx, versionId);

    const options: ResponseOption[] = [];
    for (const cut of assessment.patterns) {
      const base = { assessmentId, patternIndex: cut.patternIndex, divertStop: cut.divertStop, rejoinStop: cut.rejoinStop };
      // Holding is always possible: vehicles wait until the road reopens.
      options.push({ ...base, id: newId("opt"), kind: "hold", stopsLost: [], extraM: 0, detour: [], contingencyRouteId: null });
      const bypass = network && findBypass(network, cut, blocked);
      if (bypass) options.push({ ...base, id: newId("opt"), kind: "reroute", ...bypass, contingencyRouteId: null });
      for (const route of contingencies.filter((c) => c.patternId === cut.patternId)) {
        options.push({ ...base, id: newId("opt"), kind: "contingency", stopsLost: [], extraM: 0, detour: [], contingencyRouteId: route.id });
      }
    }
    for (const o of options) {
      tx.run(
        `insert into ro_option (id, assessment_id, pattern_index, kind, stops_lost, divert_stop, rejoin_stop, extra_m, detour, contingency_route_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          o.id,
          o.assessmentId,
          o.patternIndex,
          o.kind,
          JSON.stringify(o.stopsLost),
          o.divertStop,
          o.rejoinStop,
          o.extraM,
          JSON.stringify(o.detour),
          o.contingencyRouteId,
        ],
      );
    }
    await this.ledger.append(tx, {
      type: "options.generated",
      component: this.id,
      subject: disruptionId,
      actor: { kind: "system", id: this.id },
      payload: {
        assessmentId,
        options: options.map((o) => ({
          id: o.id,
          pattern: o.patternIndex,
          kind: o.kind,
          stopsLost: o.stopsLost.length,
          extraM: o.extraM,
        })),
      },
    });
    const payload: OptionsGeneratedPayload = { assessmentId, disruptionId, options: options.length };
    this.bus.publish(tx, { type: OPTIONS_GENERATED, source: this.id, subject: disruptionId, payload });
  }

  options(tx: Tx, assessmentId: string): ResponseOption[] {
    return tx
      .all<OptionRow>("select * from ro_option where assessment_id = ? order by pattern_index, rowid", [assessmentId])
      .map((r) => ({
        id: r.id,
        assessmentId: r.assessment_id,
        patternIndex: Number(r.pattern_index),
        kind: r.kind,
        stopsLost: JSON.parse(r.stops_lost) as number[],
        divertStop: r.divert_stop === null ? null : Number(r.divert_stop),
        rejoinStop: r.rejoin_stop === null ? null : Number(r.rejoin_stop),
        extraM: r.extra_m,
        detour: JSON.parse(r.detour) as number[],
        contingencyRouteId: r.contingency_route_id,
      }));
  }
}
