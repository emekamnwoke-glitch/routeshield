import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { DecisionMadePayload } from "../ac-07-decision-manager/contract";
import { DECISION_MADE } from "../ac-07-decision-manager/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { ServiceState, ServiceStateChangedPayload, ServiceStateStore } from "./contract";
import { SERVICE_STATE_CHANGED } from "./contract";

type StateRow = {
  id: string;
  disruption_id: string;
  decision_id: string;
  pattern_index: number;
  option_id: string;
  state: ServiceState["state"];
  since: string;
};

const STATE_FOR_OPTION: Record<string, ServiceState["state"]> = {
  hold: "held",
  reroute: "diverted",
  contingency: "diverted",
};

export class ServiceStateModule implements CoreModule, ServiceStateStore {
  readonly id = "AC-08";
  readonly name = "Service State";
  readonly tablePrefix = "ss_";

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
  ) {
    bus.subscribe(DECISION_MADE, this.id, (tx, e) => this.onDecision(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ss_state (
      id text primary key,
      disruption_id text not null,
      decision_id text not null,
      pattern_index integer not null,
      option_id text not null,
      state text not null check (state in ('planned', 'held', 'diverted')),
      since text not null,
      unique (decision_id, pattern_index)
    )`);
    tx.run("create index if not exists ss_state_disruption on ss_state(disruption_id, pattern_index, since)");
  }

  private async onDecision(tx: Tx, event: DomainEvent): Promise<void> {
    const d = event.payload as DecisionMadePayload;
    if (d.verdict !== "approve") return;
    for (const item of d.items) {
      const state = STATE_FOR_OPTION[item.optionKind];
      if (!state) throw new Error(`no service state for option kind ${item.optionKind}`);
      const record: ServiceState = {
        id: newId("svc"),
        disruptionId: d.disruptionId,
        decisionId: d.decisionId,
        patternIndex: item.patternIndex,
        optionId: item.optionId,
        state,
        since: this.clock.now(),
      };
      tx.run(
        `insert into ss_state (id, disruption_id, decision_id, pattern_index, option_id, state, since)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [record.id, record.disruptionId, record.decisionId, record.patternIndex, record.optionId, record.state, record.since],
      );
      await this.ledger.append(tx, {
        type: "service_state.changed",
        component: this.id,
        subject: d.disruptionId,
        actor: { kind: "system", id: this.id },
        payload: { stateId: record.id, decisionId: d.decisionId, pattern: item.patternIndex, state },
      });
      const payload: ServiceStateChangedPayload = {
        stateId: record.id,
        disruptionId: d.disruptionId,
        decisionId: d.decisionId,
        patternIndex: item.patternIndex,
        state,
      };
      this.bus.publish(tx, { type: SERVICE_STATE_CHANGED, source: this.id, subject: d.disruptionId, payload });
    }
  }

  current(tx: Tx, disruptionId: string): ServiceState[] {
    return tx
      .all<StateRow>(
        `select s.* from ss_state s
         where s.disruption_id = ? and s.rowid = (
           select max(rowid) from ss_state where disruption_id = s.disruption_id and pattern_index = s.pattern_index)
         order by s.pattern_index`,
        [disruptionId],
      )
      .map((r) => ({
        id: r.id,
        disruptionId: r.disruption_id,
        decisionId: r.decision_id,
        patternIndex: Number(r.pattern_index),
        optionId: r.option_id,
        state: r.state,
        since: r.since,
      }));
  }
}
