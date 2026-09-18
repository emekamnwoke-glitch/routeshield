import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { ServiceStateChangedPayload } from "../ac-08-service-state/contract";
import { SERVICE_STATE_CHANGED } from "../ac-08-service-state/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { CommunicationHub, Notice } from "./contract";

type NoticeRow = {
  id: string;
  idempotency_key: string;
  disruption_id: string;
  channel: Notice["channel"];
  kind: Notice["kind"];
  created_at: string;
};

const NOTICE_FOR_STATE: Record<string, Notice["kind"]> = {
  held: "not_served",
  diverted: "diverted",
  planned: "resumed",
};

export class CommunicationHubModule implements CoreModule, CommunicationHub {
  readonly id = "AC-09";
  readonly name = "Communication Hub";
  readonly tablePrefix = "ch_";

  constructor(
    bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
  ) {
    bus.subscribe(SERVICE_STATE_CHANGED, this.id, (tx, e) => this.onStateChanged(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ch_notice (
      id text primary key,
      idempotency_key text not null unique,
      disruption_id text not null,
      channel text not null check (channel in ('passenger', 'driver')),
      kind text not null check (kind in ('not_served', 'diverted', 'resumed')),
      created_at text not null
    )`);
  }

  /** Walking skeleton: one passenger notice per service state change. */
  private async onStateChanged(tx: Tx, event: DomainEvent): Promise<void> {
    const s = event.payload as ServiceStateChangedPayload;
    const kind = NOTICE_FOR_STATE[s.state];
    if (!kind) throw new Error(`no notice for service state ${s.state}`);
    const key = `passenger:${s.stateId}`;
    if (tx.one("select 1 from ch_notice where idempotency_key = ?", [key])) return;
    const notice: Notice = {
      id: newId("ntc"),
      idempotencyKey: key,
      disruptionId: s.disruptionId,
      channel: "passenger",
      kind,
      createdAt: this.clock.now(),
    };
    tx.run(
      "insert into ch_notice (id, idempotency_key, disruption_id, channel, kind, created_at) values (?, ?, ?, ?, ?, ?)",
      [notice.id, notice.idempotencyKey, notice.disruptionId, notice.channel, notice.kind, notice.createdAt],
    );
    await this.ledger.append(tx, {
      type: "notice.issued",
      component: this.id,
      subject: s.disruptionId,
      actor: { kind: "system", id: this.id },
      payload: { noticeId: notice.id, channel: notice.channel, kind, stateId: s.stateId },
    });
  }

  notices(tx: Tx, disruptionId: string): Notice[] {
    return tx
      .all<NoticeRow>("select * from ch_notice where disruption_id = ? order by created_at, rowid", [disruptionId])
      .map((r) => ({
        id: r.id,
        idempotencyKey: r.idempotency_key,
        disruptionId: r.disruption_id,
        channel: r.channel,
        kind: r.kind,
        createdAt: r.created_at,
      }));
  }
}
