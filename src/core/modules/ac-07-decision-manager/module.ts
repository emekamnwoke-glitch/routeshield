import type { EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Actor, Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Store, Tx } from "../../kernel/store";
import type { RouteOptimiser } from "../ac-05-route-optimiser/contract";
import type { DecisionSupport } from "../ac-06-decision-support/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { AccessControl } from "../ac-14-access-control/contract";
import type { Decision, DecisionMadePayload, DecisionManager, Verdict } from "./contract";
import { DECISION_MADE, DecisionRefused } from "./contract";

type DecisionRow = {
  id: string;
  recommendation_id: string;
  disruption_id: string;
  verdict: Verdict;
  option_id: string;
  decided_by: string;
  decided_at: string;
};

export class DecisionManagerModule implements CoreModule, DecisionManager {
  readonly id = "AC-07";
  readonly name = "Decision Manager";
  readonly tablePrefix = "dc_";

  constructor(
    private readonly store: Store,
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly support: DecisionSupport,
    private readonly optimiser: RouteOptimiser,
    private readonly access: AccessControl,
  ) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists dc_decision (
      id text primary key,
      recommendation_id text not null unique,
      disruption_id text not null,
      verdict text not null check (verdict in ('approve', 'reject')),
      option_id text not null,
      decided_by text not null,
      decided_at text not null
    )`);
  }

  async decide(actor: Actor, recommendationId: string, verdict: Verdict, reason: string): Promise<Decision> {
    const outcome = await this.store.transaction(async (tx): Promise<Decision | { refused: string }> => {
      const rec = this.support.recommendation(tx, recommendationId);
      if (!rec) return { refused: `recommendation ${recommendationId} not found` };
      if (tx.one("select 1 from dc_decision where recommendation_id = ?", [recommendationId])) {
        return { refused: `recommendation ${recommendationId} has already been decided` };
      }
      // Authority is checked now, not when the recommendation was issued (AR-006).
      const authority = this.access.authorise(tx, actor, "decide");
      if (!authority.allowed) {
        await this.ledger.append(tx, {
          type: "decision.refused",
          component: this.id,
          subject: rec.disruptionId,
          actor,
          payload: { recommendationId, verdict, reason: authority.reason },
        });
        return { refused: authority.reason };
      }
      const option = this.optimiser.options(tx, rec.assessmentId).find((o) => o.id === rec.optionId);
      if (!option) throw new Error(`option ${rec.optionId} not found`);
      const decision: Decision = {
        id: newId("dec"),
        recommendationId,
        disruptionId: rec.disruptionId,
        verdict,
        optionId: rec.optionId,
        decidedBy: actor,
        decidedAt: this.clock.now(),
      };
      tx.run(
        `insert into dc_decision (id, recommendation_id, disruption_id, verdict, option_id, decided_by, decided_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [
          decision.id,
          decision.recommendationId,
          decision.disruptionId,
          decision.verdict,
          decision.optionId,
          JSON.stringify(actor),
          decision.decidedAt,
        ],
      );
      await this.ledger.append(tx, {
        type: "decision.made",
        component: this.id,
        subject: rec.disruptionId,
        actor,
        payload: { decisionId: decision.id, recommendationId, verdict, optionId: option.id, reason },
      });
      const payload: DecisionMadePayload = {
        decisionId: decision.id,
        disruptionId: rec.disruptionId,
        verdict,
        optionId: option.id,
        optionKind: option.kind,
      };
      this.bus.publish(tx, { type: DECISION_MADE, source: this.id, subject: rec.disruptionId, payload });
      return decision;
    });
    // A refusal is committed to the audit record before it is raised.
    if ("refused" in outcome) throw new DecisionRefused(outcome.refused);
    return outcome;
  }

  decision(tx: Tx, id: string): Decision | undefined {
    const r = tx.one<DecisionRow>("select * from dc_decision where id = ?", [id]);
    return (
      r && {
        id: r.id,
        recommendationId: r.recommendation_id,
        disruptionId: r.disruption_id,
        verdict: r.verdict,
        optionId: r.option_id,
        decidedBy: JSON.parse(r.decided_by) as Actor,
        decidedAt: r.decided_at,
      }
    );
  }
}
