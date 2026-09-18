import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { ImpactAssessor } from "../ac-04-impact-assessor/contract";
import type { OptionsGeneratedPayload, RouteOptimiser } from "../ac-05-route-optimiser/contract";
import { OPTIONS_GENERATED } from "../ac-05-route-optimiser/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { DecisionSupport, Recommendation, RecommendationIssuedPayload } from "./contract";
import { RECOMMENDATION_ISSUED } from "./contract";

type RecommendationRow = {
  id: string;
  assessment_id: string;
  disruption_id: string;
  option_id: string;
  band: Recommendation["band"];
  confidence: Recommendation["confidence"];
  issued_at: string;
};

export class DecisionSupportModule implements CoreModule, DecisionSupport {
  readonly id = "AC-06";
  readonly name = "Decision Support";
  readonly tablePrefix = "ds_";

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly impact: ImpactAssessor,
    private readonly optimiser: RouteOptimiser,
  ) {
    bus.subscribe(OPTIONS_GENERATED, this.id, (tx, e) => this.onOptions(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ds_recommendation (
      id text primary key,
      assessment_id text not null unique,
      disruption_id text not null,
      option_id text not null,
      band text not null check (band in ('A0', 'A1', 'A2', 'A3')),
      confidence text not null check (confidence in ('high', 'medium', 'low')),
      issued_at text not null
    )`);
  }

  /**
   * Walking skeleton: recommend the option that loses fewest stops, in band A1
   * (a human decides). Confidence is low while the snapshot carries no network.
   */
  private async onOptions(tx: Tx, event: DomainEvent): Promise<void> {
    const { assessmentId, disruptionId } = event.payload as OptionsGeneratedPayload;
    const assessment = this.impact.assessment(tx, assessmentId);
    const [best] = this.optimiser.options(tx, assessmentId);
    if (!assessment || !best) throw new Error(`nothing to recommend for assessment ${assessmentId}`);
    const snapshot = this.ledger.snapshot(tx, assessment.snapshotId);
    const rec: Recommendation = {
      id: newId("rec"),
      assessmentId,
      disruptionId,
      optionId: best.id,
      band: "A1",
      confidence: snapshot?.networkVersion === "none" ? "low" : "medium",
      issuedAt: this.clock.now(),
    };
    tx.run(
      `insert into ds_recommendation (id, assessment_id, disruption_id, option_id, band, confidence, issued_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [rec.id, rec.assessmentId, rec.disruptionId, rec.optionId, rec.band, rec.confidence, rec.issuedAt],
    );
    await this.ledger.append(tx, {
      type: "recommendation.issued",
      component: this.id,
      subject: disruptionId,
      actor: { kind: "system", id: this.id },
      snapshotId: assessment.snapshotId,
      payload: { recommendationId: rec.id, optionId: rec.optionId, band: rec.band, confidence: rec.confidence },
    });
    const payload: RecommendationIssuedPayload = { recommendationId: rec.id, disruptionId, band: rec.band };
    this.bus.publish(tx, { type: RECOMMENDATION_ISSUED, source: this.id, subject: disruptionId, payload });
  }

  recommendation(tx: Tx, id: string): Recommendation | undefined {
    return this.toRecommendation(tx.one<RecommendationRow>("select * from ds_recommendation where id = ?", [id]));
  }

  forDisruption(tx: Tx, disruptionId: string): Recommendation | undefined {
    return this.toRecommendation(
      tx.one<RecommendationRow>(
        "select * from ds_recommendation where disruption_id = ? order by issued_at desc, rowid desc limit 1",
        [disruptionId],
      ),
    );
  }

  private toRecommendation(r: RecommendationRow | undefined): Recommendation | undefined {
    return (
      r && {
        id: r.id,
        assessmentId: r.assessment_id,
        disruptionId: r.disruption_id,
        optionId: r.option_id,
        band: r.band,
        confidence: r.confidence,
        issuedAt: r.issued_at,
      }
    );
  }
}
