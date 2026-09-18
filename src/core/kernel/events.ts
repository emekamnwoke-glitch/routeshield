/**
 * In-process domain events delivered from a transactional outbox (ADR-0007).
 *
 * An event is written in the same transaction as the change that raised it.
 * After commit, dispatch() hands each event to its subscribers. A subscriber's
 * work and its delivery record commit together, so replaying the outbox never
 * repeats work. A subscriber that keeps failing is dead-lettered, and the
 * dead letter is itself recorded (via onDeadLetter, which writes the audit).
 */
import type { Clock, Json } from "./primitives";
import { newId } from "./primitives";
import type { Store, Tx } from "./store";
import type { Telemetry } from "./telemetry";

export interface DomainEvent {
  id: string;
  type: string;
  /** The component that raised it, e.g. "AC-02". */
  source: string;
  subject: string;
  payload: Json;
  occurredAt: string;
}

export type NewEvent = Omit<DomainEvent, "id" | "occurredAt">;
export type Handler = (tx: Tx, event: DomainEvent) => Promise<void> | void;
export type DeadLetter = (tx: Tx, event: DomainEvent, subscriber: string, error: string) => Promise<void>;

export interface Publisher {
  publish(tx: Tx, event: NewEvent): DomainEvent;
}

interface Subscription {
  type: string;
  subscriber: string;
  handler: Handler;
}

type OutboxRow = {
  id: string;
  type: string;
  source: string;
  subject: string;
  payload: string;
  occurred_at: string;
};

export const MAX_ATTEMPTS = 3;
const MAX_ROUNDS = 1000;

export class EventBus implements Publisher {
  private readonly subscriptions: Subscription[] = [];
  private onDeadLetter: DeadLetter = async () => {};

  constructor(
    private readonly store: Store,
    private readonly clock: Clock,
    private readonly telemetry: Telemetry,
  ) {}

  static migrate(tx: Tx): void {
    tx.run(`create table if not exists kn_outbox (
      seq integer primary key autoincrement,
      id text not null unique,
      type text not null,
      source text not null,
      subject text not null,
      payload text not null,
      occurred_at text not null
    )`);
    tx.run(`create table if not exists kn_delivery (
      event_id text not null references kn_outbox(id),
      subscriber text not null,
      status text not null check (status in ('pending', 'done', 'dead')),
      attempts integer not null default 0,
      last_error text,
      primary key (event_id, subscriber)
    )`);
  }

  deadLetterTo(handler: DeadLetter): void {
    this.onDeadLetter = handler;
  }

  subscribe(type: string, subscriber: string, handler: Handler): void {
    if (this.subscriptions.some((s) => s.type === type && s.subscriber === subscriber)) {
      throw new Error(`${subscriber} is already subscribed to ${type}`);
    }
    this.subscriptions.push({ type, subscriber, handler });
  }

  publish(tx: Tx, event: NewEvent): DomainEvent {
    const full: DomainEvent = { ...event, id: newId("evt"), occurredAt: this.clock.now() };
    tx.run(
      "insert into kn_outbox (id, type, source, subject, payload, occurred_at) values (?, ?, ?, ?, ?, ?)",
      [full.id, full.type, full.source, full.subject, JSON.stringify(full.payload), full.occurredAt],
    );
    return full;
  }

  /** Delivers every pending event, including events raised by handlers, until none remain. */
  async dispatch(): Promise<number> {
    let delivered = 0;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const work = await this.pending();
      if (work.length === 0) return delivered;
      for (const [event, sub] of work) {
        if (await this.deliver(event, sub)) delivered++;
      }
    }
    throw new Error(`event dispatch did not settle after ${MAX_ROUNDS} rounds`);
  }

  private async pending(): Promise<[DomainEvent, Subscription][]> {
    const rows = await this.store.read((tx) => ({
      events: tx.all<OutboxRow>("select id, type, source, subject, payload, occurred_at from kn_outbox order by seq"),
      settled: tx.all<{ key: string }>(
        "select event_id || '|' || subscriber as key from kn_delivery where status in ('done', 'dead')",
      ),
    }));
    const settled = new Set(rows.settled.map((r) => r.key));
    const work: [DomainEvent, Subscription][] = [];
    for (const r of rows.events) {
      for (const sub of this.subscriptions) {
        if (sub.type === r.type && !settled.has(`${r.id}|${sub.subscriber}`)) {
          const event: DomainEvent = {
            id: r.id,
            type: r.type,
            source: r.source,
            subject: r.subject,
            payload: JSON.parse(r.payload) as Json,
            occurredAt: r.occurred_at,
          };
          work.push([event, sub]);
        }
      }
    }
    return work;
  }

  private async deliver(event: DomainEvent, sub: Subscription): Promise<boolean> {
    const attrs = { "event.type": event.type, subscriber: sub.subscriber };
    try {
      await this.telemetry.span("event.deliver", attrs, () =>
        this.store.transaction(async (tx) => {
          await sub.handler(tx, event);
          tx.run(
            `insert into kn_delivery (event_id, subscriber, status, attempts) values (?, ?, 'done', 1)
             on conflict (event_id, subscriber) do update set status = 'done', attempts = attempts + 1`,
            [event.id, sub.subscriber],
          );
        }),
      );
      this.telemetry.count("event.delivered", 1, attrs);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const attempts = await this.store.transaction((tx) => {
        tx.run(
          `insert into kn_delivery (event_id, subscriber, status, attempts, last_error) values (?, ?, 'pending', 1, ?)
           on conflict (event_id, subscriber) do update set attempts = attempts + 1, last_error = excluded.last_error`,
          [event.id, sub.subscriber, error],
        );
        return Number(
          tx.one<{ attempts: number }>("select attempts from kn_delivery where event_id = ? and subscriber = ?", [
            event.id,
            sub.subscriber,
          ])?.attempts ?? 0,
        );
      });
      this.telemetry.log("warn", "event delivery failed", { ...attrs, attempts, error });
      if (attempts >= MAX_ATTEMPTS) {
        await this.store.transaction(async (tx) => {
          await this.onDeadLetter(tx, event, sub.subscriber, error);
          tx.run("update kn_delivery set status = 'dead' where event_id = ? and subscriber = ?", [
            event.id,
            sub.subscriber,
          ]);
        });
        this.telemetry.count("event.dead_lettered", 1, attrs);
      }
      return false;
    }
  }
}
