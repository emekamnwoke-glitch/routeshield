import type { CoreModule } from "../../kernel/module";
import type { Store, Tx } from "../../kernel/store";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { EventCount, ServiceAnalytics } from "./contract";

export class ServiceAnalyticsModule implements CoreModule, ServiceAnalytics {
  readonly id = "AC-12";
  readonly name = "Service Analytics";
  readonly tablePrefix = "an_";

  constructor(
    private readonly store: Store,
    private readonly ledger: AuditLedger,
  ) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists an_event_count (
      type text not null,
      component text not null,
      count integer not null,
      primary key (type, component)
    )`);
  }

  /** Rebuilds the derived counts from DD-11; nothing else is read. */
  refresh(): Promise<void> {
    return this.store.transaction((tx) => {
      const counts = new Map<string, EventCount>();
      for (const e of this.ledger.events(tx)) {
        const key = `${e.type}|${e.component}`;
        const c = counts.get(key) ?? { type: e.type, component: e.component, count: 0 };
        c.count++;
        counts.set(key, c);
      }
      tx.run("delete from an_event_count");
      for (const c of counts.values()) {
        tx.run("insert into an_event_count (type, component, count) values (?, ?, ?)", [c.type, c.component, c.count]);
      }
    });
  }

  eventCounts(tx: Tx): EventCount[] {
    return tx
      .all<{ type: string; component: string; count: number }>(
        "select type, component, count from an_event_count order by component, type",
      )
      .map((r) => ({ type: r.type, component: r.component, count: Number(r.count) }));
  }
}
