import type { CoreModule } from "../../kernel/module";
import type { Actor, Clock, Json } from "../../kernel/primitives";
import { canonicalJson, newId, sha256Hex } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { Telemetry } from "../../kernel/telemetry";
import type {
  AuditInput,
  AuditLedger,
  AuditRecord,
  ChainReport,
  SnapshotInput,
  SnapshotRecord,
} from "./contract";
import { GENESIS_HASH } from "./contract";

type EventRow = {
  id: string;
  seq: number;
  at: string;
  type: string;
  component: string;
  subject: string;
  actor: string | null;
  snapshot_id: string | null;
  payload: string;
  prev_hash: string;
  hash: string;
};

type SnapshotRow = {
  id: string;
  taken_at: string;
  network_version: string;
  positions: string;
  assignments: string;
  road_conditions: string;
  source_health: string;
  content_hash: string;
};

function eventHash(e: Omit<AuditRecord, "hash">): Promise<string> {
  return sha256Hex(
    canonicalJson({
      id: e.id,
      seq: e.seq,
      at: e.at,
      type: e.type,
      component: e.component,
      subject: e.subject,
      actor: e.actor,
      snapshotId: e.snapshotId,
      payload: e.payload,
      prevHash: e.prevHash,
    }),
  );
}

function snapshotHash(s: SnapshotInput & { id: string; takenAt: string }): Promise<string> {
  return sha256Hex(
    canonicalJson({
      id: s.id,
      takenAt: s.takenAt,
      networkVersion: s.networkVersion,
      positions: s.positions,
      assignments: s.assignments,
      roadConditions: s.roadConditions,
      sourceHealth: s.sourceHealth,
    }),
  );
}

function toRecord(r: EventRow): AuditRecord {
  return {
    id: r.id,
    seq: Number(r.seq),
    at: r.at,
    type: r.type,
    component: r.component,
    subject: r.subject,
    actor: r.actor === null ? null : (JSON.parse(r.actor) as Actor),
    snapshotId: r.snapshot_id,
    payload: JSON.parse(r.payload) as Json,
    prevHash: r.prev_hash,
    hash: r.hash,
  };
}

function toSnapshot(r: SnapshotRow): SnapshotRecord {
  return {
    id: r.id,
    takenAt: r.taken_at,
    networkVersion: r.network_version,
    positions: JSON.parse(r.positions) as Json,
    assignments: JSON.parse(r.assignments) as Json,
    roadConditions: JSON.parse(r.road_conditions) as Json,
    sourceHealth: JSON.parse(r.source_health) as Json,
    contentHash: r.content_hash,
  };
}

export class AuditLedgerModule implements CoreModule, AuditLedger {
  readonly id = "AC-11";
  readonly name = "Audit Ledger";
  readonly tablePrefix = "au_";

  constructor(
    private readonly clock: Clock,
    private readonly telemetry: Telemetry,
  ) {}

  migrate(tx: Tx): void {
    // No column can hold a driver's identity (INV-12): actors are personas or system components.
    tx.run(`create table if not exists au_snapshot (
      id text primary key,
      taken_at text not null,
      network_version text not null,
      positions text not null,
      assignments text not null,
      road_conditions text not null,
      source_health text not null,
      content_hash text not null
    )`);
    tx.run(`create table if not exists au_event (
      seq integer primary key,
      id text not null unique,
      at text not null,
      type text not null,
      component text not null,
      subject text not null,
      actor text,
      snapshot_id text references au_snapshot(id),
      payload text not null,
      prev_hash text not null,
      hash text not null unique
    )`);
    tx.run("create index if not exists au_event_subject on au_event(subject)");
    // Append-only by construction, not only by policy (AR-003).
    for (const table of ["au_event", "au_snapshot"]) {
      for (const op of ["update", "delete"]) {
        tx.run(`create trigger if not exists ${table}_no_${op} before ${op} on ${table}
          begin select raise(abort, '${table} is append-only'); end`);
      }
    }
  }

  async append(tx: Tx, input: AuditInput): Promise<AuditRecord> {
    const last = tx.one<{ seq: number; hash: string }>("select seq, hash from au_event order by seq desc limit 1");
    const draft: Omit<AuditRecord, "hash"> = {
      id: newId("aud"),
      seq: last ? Number(last.seq) + 1 : 1,
      at: this.clock.now(),
      type: input.type,
      component: input.component,
      subject: input.subject,
      actor: input.actor ?? null,
      snapshotId: input.snapshotId ?? null,
      payload: input.payload,
      prevHash: last?.hash ?? GENESIS_HASH,
    };
    const record: AuditRecord = { ...draft, hash: await eventHash(draft) };
    tx.run(
      `insert into au_event (seq, id, at, type, component, subject, actor, snapshot_id, payload, prev_hash, hash)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.seq,
        record.id,
        record.at,
        record.type,
        record.component,
        record.subject,
        record.actor === null ? null : JSON.stringify(record.actor),
        record.snapshotId,
        JSON.stringify(record.payload),
        record.prevHash,
        record.hash,
      ],
    );
    this.telemetry.count("audit.appended", 1, { type: record.type });
    return record;
  }

  async freezeSnapshot(tx: Tx, input: SnapshotInput, component: string, subject: string): Promise<SnapshotRecord> {
    const base = { ...input, id: newId("snap"), takenAt: this.clock.now() };
    const snapshot: SnapshotRecord = { ...base, contentHash: await snapshotHash(base) };
    tx.run(
      `insert into au_snapshot (id, taken_at, network_version, positions, assignments, road_conditions, source_health, content_hash)
       values (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.id,
        snapshot.takenAt,
        snapshot.networkVersion,
        JSON.stringify(snapshot.positions),
        JSON.stringify(snapshot.assignments),
        JSON.stringify(snapshot.roadConditions),
        JSON.stringify(snapshot.sourceHealth),
        snapshot.contentHash,
      ],
    );
    await this.append(tx, {
      type: "snapshot.frozen",
      component,
      subject,
      snapshotId: snapshot.id,
      payload: { contentHash: snapshot.contentHash, networkVersion: snapshot.networkVersion },
    });
    return snapshot;
  }

  snapshot(tx: Tx, id: string): SnapshotRecord | undefined {
    const row = tx.one<SnapshotRow>("select * from au_snapshot where id = ?", [id]);
    return row && toSnapshot(row);
  }

  events(tx: Tx, filter: { subject?: string; type?: string } = {}): AuditRecord[] {
    const where: string[] = [];
    const params: string[] = [];
    if (filter.subject !== undefined) {
      where.push("subject = ?");
      params.push(filter.subject);
    }
    if (filter.type !== undefined) {
      where.push("type = ?");
      params.push(filter.type);
    }
    const sql = `select * from au_event ${where.length ? `where ${where.join(" and ")}` : ""} order by seq`;
    return tx.all<EventRow>(sql, params).map(toRecord);
  }

  async verify(tx: Tx): Promise<ChainReport> {
    const problems: string[] = [];
    const events = this.events(tx);
    let prev = GENESIS_HASH;
    for (const [i, e] of events.entries()) {
      if (e.seq !== i + 1) problems.push(`event ${i + 1} is missing (found seq ${e.seq})`);
      if (e.prevHash !== prev) problems.push(`event ${e.seq} does not chain from its predecessor`);
      const { hash, ...rest } = e;
      if ((await eventHash(rest)) !== hash) problems.push(`event ${e.seq} does not match its hash`);
      prev = hash;
    }
    const frozen = new Map(
      events.filter((e) => e.type === "snapshot.frozen" && e.snapshotId).map((e) => [e.snapshotId, e.payload]),
    );
    const snapshots = tx.all<SnapshotRow>("select * from au_snapshot").map(toSnapshot);
    for (const s of snapshots) {
      const { contentHash, ...content } = s;
      if ((await snapshotHash(content)) !== contentHash) problems.push(`snapshot ${s.id} does not match its hash`);
      const recorded = frozen.get(s.id) as { contentHash?: string } | undefined;
      if (recorded?.contentHash !== contentHash) problems.push(`snapshot ${s.id} is not the one the audit chain recorded`);
    }
    this.telemetry.count("audit.verified", 1, { ok: problems.length === 0 });
    return { ok: problems.length === 0, events: events.length, snapshots: snapshots.length, problems };
  }
}
