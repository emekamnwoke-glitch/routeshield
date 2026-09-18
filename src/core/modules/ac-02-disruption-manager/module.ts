import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { IncidentReportedPayload, SourceGateway } from "../ac-01-source-gateway/contract";
import { INCIDENT_REPORTED } from "../ac-01-source-gateway/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type {
  DisruptionManager,
  DisruptionSummary,
  DisruptionVersion,
  DisruptionVersionedPayload,
} from "./contract";
import { DISRUPTION_VERSIONED } from "./contract";

type VersionRow = {
  id: string;
  disruption_id: string;
  version: number;
  lat: number;
  lon: number;
  radius_m: number;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
};

export class DisruptionManagerModule implements CoreModule, DisruptionManager {
  readonly id = "AC-02";
  readonly name = "Disruption Manager";
  readonly tablePrefix = "dm_";

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly sources: SourceGateway,
  ) {
    bus.subscribe(INCIDENT_REPORTED, this.id, (tx, e) => this.onIncident(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists dm_disruption (
      id text primary key,
      incident_id text not null unique,
      status text not null check (status in ('reported', 'confirmed', 'cleared')),
      created_at text not null
    )`);
    tx.run(`create table if not exists dm_disruption_version (
      id text primary key,
      disruption_id text not null references dm_disruption(id),
      version integer not null,
      lat real not null,
      lon real not null,
      radius_m real not null,
      valid_from text not null,
      valid_to text,
      created_at text not null,
      unique (disruption_id, version)
    )`);
  }

  /** Walking skeleton: every reported incident becomes a disruption at version 1. */
  private async onIncident(tx: Tx, event: DomainEvent): Promise<void> {
    const { incidentId } = event.payload as IncidentReportedPayload;
    const incident = this.sources.incident(tx, incidentId);
    if (!incident) throw new Error(`incident ${incidentId} is not in the source cache`);
    const now = this.clock.now();
    const disruptionId = newId("dis");
    const versionId = newId("disv");
    tx.run("insert into dm_disruption (id, incident_id, status, created_at) values (?, ?, 'reported', ?)", [
      disruptionId,
      incidentId,
      now,
    ]);
    tx.run(
      `insert into dm_disruption_version (id, disruption_id, version, lat, lon, radius_m, valid_from, valid_to, created_at)
       values (?, ?, 1, ?, ?, ?, ?, null, ?)`,
      [versionId, disruptionId, incident.area.lat, incident.area.lon, incident.area.radiusM, now, now],
    );
    const payload: DisruptionVersionedPayload = { disruptionId, versionId, version: 1 };
    await this.ledger.append(tx, {
      type: "disruption.declared",
      component: this.id,
      subject: disruptionId,
      actor: { kind: "system", id: this.id },
      payload: { ...payload, incidentId, footprint: incident.area },
    });
    this.bus.publish(tx, { type: DISRUPTION_VERSIONED, source: this.id, subject: disruptionId, payload });
  }

  version(tx: Tx, versionId: string): DisruptionVersion | undefined {
    return this.toVersion(tx.one<VersionRow>("select * from dm_disruption_version where id = ?", [versionId]));
  }

  list(tx: Tx): DisruptionSummary[] {
    const rows = tx.all<VersionRow & { status: DisruptionSummary["status"]; disruption_created_at: string }>(
      `select v.*, d.status, d.created_at as disruption_created_at
       from dm_disruption d
       join dm_disruption_version v on v.disruption_id = d.id
         and v.version = (select max(version) from dm_disruption_version where disruption_id = d.id)
       order by d.created_at desc, d.rowid desc`,
    );
    return rows.flatMap((r) => {
      const latest = this.toVersion(r);
      return latest ? [{ id: r.disruption_id, status: r.status, createdAt: r.disruption_created_at, latest }] : [];
    });
  }

  private toVersion(r: VersionRow | undefined): DisruptionVersion | undefined {
    return (
      r && {
        id: r.id,
        disruptionId: r.disruption_id,
        version: Number(r.version),
        footprint: { lat: r.lat, lon: r.lon, radiusM: r.radius_m },
        validFrom: r.valid_from,
        validTo: r.valid_to,
        createdAt: r.created_at,
      }
    );
  }
}
