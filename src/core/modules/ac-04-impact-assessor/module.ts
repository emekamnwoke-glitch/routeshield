import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Network } from "../../kernel/network";
import type { Clock, Json } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { SourceGateway, VehiclePosition } from "../ac-01-source-gateway/contract";
import type { DisruptionManager, DisruptionVersionedPayload } from "../ac-02-disruption-manager/contract";
import { DISRUPTION_VERSIONED } from "../ac-02-disruption-manager/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type {
  AffectedPattern,
  AffectedVehicle,
  ImpactAssessedPayload,
  ImpactAssessment,
  ImpactAssessor,
  VehicleRelation,
} from "./contract";
import { IMPACT_ASSESSED } from "./contract";

type AssessmentRow = {
  id: string;
  disruption_id: string;
  version_id: string;
  snapshot_id: string;
  network_version: string;
  blocked_edges: string;
  affected_trips: number;
  assessed_at: string;
};

type PatternRow = {
  pattern_index: number;
  pattern_id: string;
  route_code: string;
  direction: number;
  trips: number;
  blocked_from: number;
  blocked_to: number;
  stops_inside: string;
  divert_stop: number | null;
  rejoin_stop: number | null;
};

/** How every pattern that runs over a blocked edge is cut. */
export function cutPatterns(network: Network, blocked: ReadonlySet<number>): AffectedPattern[] {
  const out: AffectedPattern[] = [];
  for (const p of network.patterns) {
    let from = -1;
    let to = -1;
    p.path.forEach((de, i) => {
      if (blocked.has(de >> 1)) {
        if (from < 0) from = i;
        to = i;
      }
    });
    if (from < 0) continue;
    const at = p.stopPositions.map((s) => s.pathIndex);
    const before = at.flatMap((idx, k) => (idx < from ? [k] : []));
    const after = at.flatMap((idx, k) => (idx > to ? [k] : []));
    out.push({
      patternIndex: p.index,
      patternId: p.id,
      routeCode: p.routeCode,
      direction: p.direction,
      trips: p.trips,
      blockedFrom: from,
      blockedTo: to,
      stopsInside: at.flatMap((idx, k) => (idx >= from && idx <= to ? [k] : [])),
      divertStop: before.at(-1) ?? null,
      rejoinStop: after[0] ?? null,
    });
  }
  return out;
}

/** Where each vehicle on an affected pattern stands relative to the blocked stretch. */
export function relate(patterns: AffectedPattern[], positions: VehiclePosition[]): AffectedVehicle[] {
  const byPattern = new Map(patterns.map((p) => [p.patternIndex, p]));
  return positions.flatMap((v) => {
    const p = byPattern.get(v.pattern);
    if (!p) return [];
    const relation: VehicleRelation =
      v.pathIndex < p.blockedFrom ? "approaching" : v.pathIndex <= p.blockedTo ? "inside" : "past";
    return [{ vehicle: v.vehicle, patternIndex: v.pattern, relation }];
  });
}

export class ImpactAssessorModule implements CoreModule, ImpactAssessor {
  readonly id = "AC-04";
  readonly name = "Impact Assessor";
  readonly tablePrefix = "ia_";

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly disruptions: DisruptionManager,
    private readonly sources: SourceGateway,
  ) {
    bus.subscribe(DISRUPTION_VERSIONED, this.id, (tx, e) => this.onVersion(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ia_assessment (
      id text primary key,
      disruption_id text not null,
      version_id text not null unique,
      snapshot_id text not null,
      network_version text not null,
      blocked_edges text not null,
      affected_trips integer not null,
      assessed_at text not null
    )`);
    tx.run(`create table if not exists ia_affected_pattern (
      assessment_id text not null references ia_assessment(id),
      pattern_index integer not null,
      pattern_id text not null,
      route_code text not null,
      direction integer not null,
      trips integer not null,
      blocked_from integer not null,
      blocked_to integer not null,
      stops_inside text not null,
      divert_stop integer,
      rejoin_stop integer,
      primary key (assessment_id, pattern_index)
    )`);
    tx.run(`create table if not exists ia_affected_vehicle (
      assessment_id text not null references ia_assessment(id),
      vehicle text not null,
      pattern_index integer not null,
      relation text not null check (relation in ('approaching', 'inside', 'past')),
      primary key (assessment_id, vehicle)
    )`);
  }

  private async onVersion(tx: Tx, event: DomainEvent): Promise<void> {
    const { versionId } = event.payload as DisruptionVersionedPayload;
    const version = this.disruptions.version(tx, versionId);
    if (!version) throw new Error(`disruption version ${versionId} not found`);
    const network = this.sources.network();
    const blocked = network ? network.edgesWithin(version.footprint) : new Set<number>();
    const patterns = network ? cutPatterns(network, blocked) : [];
    const affected = new Set(patterns.map((p) => p.patternIndex));

    // The snapshot is evidence before assessment starts (AR-001): copies of the
    // positions of every vehicle on an affected pattern, and source health.
    const snapshot = await this.ledger.freezeSnapshot(
      tx,
      {
        networkVersion: network?.version ?? "none",
        positions: this.sources.positions(tx).filter((v) => affected.has(v.pattern)) as unknown as Json,
        assignments: [],
        roadConditions: [],
        sourceHealth: this.sources.health(tx),
      },
      this.id,
      version.disruptionId,
    );
    // Vehicle relations are read from the snapshot, not from the live cache.
    const vehicles = relate(patterns, snapshot.positions as unknown as VehiclePosition[]);

    const assessment: ImpactAssessment = {
      id: newId("imp"),
      disruptionId: version.disruptionId,
      versionId,
      snapshotId: snapshot.id,
      networkVersion: snapshot.networkVersion,
      blockedEdges: [...blocked].sort((a, b) => a - b),
      patterns,
      vehicles,
      affectedTrips: patterns.reduce((n, p) => n + p.trips, 0),
      assessedAt: this.clock.now(),
    };
    this.write(tx, assessment);
    const count = (r: VehicleRelation) => vehicles.filter((v) => v.relation === r).length;
    await this.ledger.append(tx, {
      type: "impact.assessed",
      component: this.id,
      subject: version.disruptionId,
      actor: { kind: "system", id: this.id },
      snapshotId: snapshot.id,
      payload: {
        assessmentId: assessment.id,
        versionId,
        blockedEdges: assessment.blockedEdges.length,
        patterns: patterns.map((p) => p.patternId),
        affectedTrips: assessment.affectedTrips,
        vehicles: { approaching: count("approaching"), inside: count("inside"), past: count("past") },
      },
    });
    const payload: ImpactAssessedPayload = { assessmentId: assessment.id, disruptionId: version.disruptionId, versionId };
    this.bus.publish(tx, { type: IMPACT_ASSESSED, source: this.id, subject: version.disruptionId, payload });
  }

  private write(tx: Tx, a: ImpactAssessment): void {
    tx.run(
      `insert into ia_assessment (id, disruption_id, version_id, snapshot_id, network_version, blocked_edges, affected_trips, assessed_at)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.disruptionId, a.versionId, a.snapshotId, a.networkVersion, JSON.stringify(a.blockedEdges), a.affectedTrips, a.assessedAt],
    );
    for (const p of a.patterns) {
      tx.run(
        `insert into ia_affected_pattern (assessment_id, pattern_index, pattern_id, route_code, direction, trips,
           blocked_from, blocked_to, stops_inside, divert_stop, rejoin_stop)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          p.patternIndex,
          p.patternId,
          p.routeCode,
          p.direction,
          p.trips,
          p.blockedFrom,
          p.blockedTo,
          JSON.stringify(p.stopsInside),
          p.divertStop,
          p.rejoinStop,
        ],
      );
    }
    for (const v of a.vehicles) {
      tx.run("insert into ia_affected_vehicle (assessment_id, vehicle, pattern_index, relation) values (?, ?, ?, ?)", [
        a.id,
        v.vehicle,
        v.patternIndex,
        v.relation,
      ]);
    }
  }

  assessment(tx: Tx, id: string): ImpactAssessment | undefined {
    const r = tx.one<AssessmentRow>("select * from ia_assessment where id = ?", [id]);
    if (!r) return undefined;
    const patterns = tx
      .all<PatternRow>("select * from ia_affected_pattern where assessment_id = ? order by pattern_index", [id])
      .map(
        (p): AffectedPattern => ({
          patternIndex: Number(p.pattern_index),
          patternId: p.pattern_id,
          routeCode: p.route_code,
          direction: Number(p.direction),
          trips: Number(p.trips),
          blockedFrom: Number(p.blocked_from),
          blockedTo: Number(p.blocked_to),
          stopsInside: JSON.parse(p.stops_inside) as number[],
          divertStop: p.divert_stop === null ? null : Number(p.divert_stop),
          rejoinStop: p.rejoin_stop === null ? null : Number(p.rejoin_stop),
        }),
      );
    const vehicles = tx
      .all<{ vehicle: string; pattern_index: number; relation: VehicleRelation }>(
        "select vehicle, pattern_index, relation from ia_affected_vehicle where assessment_id = ? order by vehicle",
        [id],
      )
      .map((v) => ({ vehicle: v.vehicle, patternIndex: Number(v.pattern_index), relation: v.relation }));
    return {
      id: r.id,
      disruptionId: r.disruption_id,
      versionId: r.version_id,
      snapshotId: r.snapshot_id,
      networkVersion: r.network_version,
      blockedEdges: JSON.parse(r.blocked_edges) as number[],
      patterns,
      vehicles,
      affectedTrips: Number(r.affected_trips),
      assessedAt: r.assessed_at,
    };
  }
}
