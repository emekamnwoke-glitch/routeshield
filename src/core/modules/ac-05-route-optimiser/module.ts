import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { ImpactAssessedPayload } from "../ac-04-impact-assessor/contract";
import { IMPACT_ASSESSED } from "../ac-04-impact-assessor/contract";
import type { ContingencyLibrary } from "../ac-10-contingency-library/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { OptionsGeneratedPayload, ResponseOption, RouteOptimiser } from "./contract";
import { OPTIONS_GENERATED } from "./contract";

type OptionRow = {
  id: string;
  assessment_id: string;
  kind: ResponseOption["kind"];
  stops_lost: number;
  contingency_route_id: string | null;
};

export class RouteOptimiserModule implements CoreModule, RouteOptimiser {
  readonly id = "AC-05";
  readonly name = "Route Optimiser";
  readonly tablePrefix = "ro_";

  constructor(
    private readonly bus: EventBus,
    private readonly ledger: AuditLedger,
    private readonly contingencies: ContingencyLibrary,
  ) {
    bus.subscribe(IMPACT_ASSESSED, this.id, (tx, e) => this.onAssessed(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ro_option (
      id text primary key,
      assessment_id text not null,
      kind text not null check (kind in ('hold', 'reroute', 'contingency')),
      stops_lost integer not null,
      contingency_route_id text
    )`);
    tx.run("create index if not exists ro_option_assessment on ro_option(assessment_id)");
  }

  /** Walking skeleton: "hold" is always an option, plus any contingency route on offer. */
  private async onAssessed(tx: Tx, event: DomainEvent): Promise<void> {
    const { assessmentId, disruptionId, versionId } = event.payload as ImpactAssessedPayload;
    const options: ResponseOption[] = [
      { id: newId("opt"), assessmentId, kind: "hold", stopsLost: 0, contingencyRouteId: null },
      ...this.contingencies.candidates(tx, versionId).map(
        (route): ResponseOption => ({
          id: newId("opt"),
          assessmentId,
          kind: "contingency",
          stopsLost: 0,
          contingencyRouteId: route.id,
        }),
      ),
    ];
    for (const o of options) {
      tx.run("insert into ro_option (id, assessment_id, kind, stops_lost, contingency_route_id) values (?, ?, ?, ?, ?)", [
        o.id,
        o.assessmentId,
        o.kind,
        o.stopsLost,
        o.contingencyRouteId,
      ]);
    }
    await this.ledger.append(tx, {
      type: "options.generated",
      component: this.id,
      subject: disruptionId,
      actor: { kind: "system", id: this.id },
      payload: { assessmentId, options: options.map((o) => ({ id: o.id, kind: o.kind, stopsLost: o.stopsLost })) },
    });
    const payload: OptionsGeneratedPayload = { assessmentId, disruptionId, options: options.length };
    this.bus.publish(tx, { type: OPTIONS_GENERATED, source: this.id, subject: disruptionId, payload });
  }

  options(tx: Tx, assessmentId: string): ResponseOption[] {
    return tx
      .all<OptionRow>("select * from ro_option where assessment_id = ? order by stops_lost, kind", [assessmentId])
      .map((r) => ({
        id: r.id,
        assessmentId: r.assessment_id,
        kind: r.kind,
        stopsLost: Number(r.stops_lost),
        contingencyRouteId: r.contingency_route_id,
      }));
  }
}
