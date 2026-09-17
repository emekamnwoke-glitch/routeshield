import type { EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Store, Tx } from "../../kernel/store";
import type { IncidentReport, IncidentReportedPayload, SourceGateway, SourceHealth } from "./contract";
import { INCIDENT_REPORTED } from "./contract";

type IncidentRow = {
  id: string;
  source: string;
  external_ref: string;
  lat: number;
  lon: number;
  radius_m: number;
  description: string;
  received_at: string;
};

export class SourceGatewayModule implements CoreModule, SourceGateway {
  readonly id = "AC-01";
  readonly name = "Source Gateway";
  readonly tablePrefix = "sg_";

  constructor(
    private readonly store: Store,
    private readonly bus: EventBus,
    private readonly clock: Clock,
  ) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists sg_incident (
      id text primary key,
      source text not null,
      external_ref text not null,
      lat real not null,
      lon real not null,
      radius_m real not null,
      description text not null,
      received_at text not null,
      unique (source, external_ref)
    )`);
    tx.run(`create table if not exists sg_source_health (
      source text primary key,
      last_seen_at text not null,
      status text not null check (status in ('fresh', 'stale', 'unavailable'))
    )`);
  }

  reportIncident(report: IncidentReport): Promise<string> {
    return this.store.transaction((tx) => {
      const id = newId("inc");
      const now = this.clock.now();
      tx.run(
        `insert into sg_incident (id, source, external_ref, lat, lon, radius_m, description, received_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, report.source, report.externalRef, report.area.lat, report.area.lon, report.area.radiusM, report.description, now],
      );
      tx.run(
        `insert into sg_source_health (source, last_seen_at, status) values (?, ?, 'fresh')
         on conflict (source) do update set last_seen_at = excluded.last_seen_at, status = 'fresh'`,
        [report.source, now],
      );
      const payload: IncidentReportedPayload = { incidentId: id };
      this.bus.publish(tx, { type: INCIDENT_REPORTED, source: this.id, subject: id, payload });
      return id;
    });
  }

  incident(tx: Tx, id: string): (IncidentReport & { id: string; receivedAt: string }) | undefined {
    const r = tx.one<IncidentRow>("select * from sg_incident where id = ?", [id]);
    return (
      r && {
        id: r.id,
        source: r.source,
        externalRef: r.external_ref,
        area: { lat: r.lat, lon: r.lon, radiusM: r.radius_m },
        description: r.description,
        receivedAt: r.received_at,
      }
    );
  }

  health(tx: Tx): SourceHealth[] {
    return tx
      .all<{ source: string; last_seen_at: string; status: SourceHealth["status"] }>(
        "select source, last_seen_at, status from sg_source_health order by source",
      )
      .map((r) => ({ source: r.source, lastSeenAt: r.last_seen_at, status: r.status }));
  }
}
