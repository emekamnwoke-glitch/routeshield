import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { ImpactAssessor } from "../ac-04-impact-assessor/contract";
import type { OptionsGeneratedPayload, ResponseOption, RouteOptimiser } from "../ac-05-route-optimiser/contract";
import { OPTIONS_GENERATED } from "../ac-05-route-optimiser/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { DecisionSupport, Recommendation, RecommendationIssuedPayload, RecommendationItem } from "./contract";
import { RECOMMENDATION_ISSUED } from "./contract";

type RecommendationRow = {
  id: string;
  assessment_id: string;
  disruption_id: string;
  band: Recommendation["band"];
  confidence: Recommendation["confidence"];
  issued_at: string;
};

/**
 * v1.2.0 choice rule, per pattern: take a bypass when one exists, the one
 * that loses fewest stops and then adds least distance; otherwise hold.
 * v1.3.0 replaces this with the weighted service-loss objective (ADR-0015).
 */
export function choose(options: ResponseOption[]): ResponseOption | undefined {
  const reroutes = options
    .filter((o) => o.kind === "reroute")
    .sort((x, y) => x.stopsLost.length - y.stopsLost.length || x.extraM - y.extraM);
  return reroutes[0] ?? options.find((o) => o.kind === "hold");
}

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
      band text not null check (band in ('A0', 'A1', 'A2', 'A3')),
      confidence text not null check (confidence in ('high', 'medium', 'low')),
      issued_at text not null
    )`);
    tx.run(`create table if not exists ds_recommendation_item (
      recommendation_id text not null references ds_recommendation(id),
      pattern_index integer not null,
      option_id text not null,
      primary key (recommendation_id, pattern_index)
    )`);
  }

  private async onOptions(tx: Tx, event: DomainEvent): Promise<void> {
    const { assessmentId, disruptionId } = event.payload as OptionsGeneratedPayload;
    const assessment = this.impact.assessment(tx, assessmentId);
    if (!assessment) throw new Error(`assessment ${assessmentId} not found`);
    const options = this.optimiser.options(tx, assessmentId);
    const items: RecommendationItem[] = assessment.patterns.flatMap((p) => {
      const best = choose(options.filter((o) => o.patternIndex === p.patternIndex));
      return best ? [{ patternIndex: p.patternIndex, optionId: best.id }] : [];
    });
    const rec: Recommendation = {
      id: newId("rec"),
      assessmentId,
      disruptionId,
      // Nothing affected: observe only (A0). Otherwise a person decides (A1).
      band: items.length === 0 ? "A0" : "A1",
      // Positions are a timetable-derived scene, so confidence stays below high.
      confidence: assessment.networkVersion === "none" ? "low" : "medium",
      items,
      issuedAt: this.clock.now(),
    };
    tx.run(
      `insert into ds_recommendation (id, assessment_id, disruption_id, band, confidence, issued_at)
       values (?, ?, ?, ?, ?, ?)`,
      [rec.id, rec.assessmentId, rec.disruptionId, rec.band, rec.confidence, rec.issuedAt],
    );
    for (const item of items) {
      tx.run("insert into ds_recommendation_item (recommendation_id, pattern_index, option_id) values (?, ?, ?)", [
        rec.id,
        item.patternIndex,
        item.optionId,
      ]);
    }
    await this.ledger.append(tx, {
      type: "recommendation.issued",
      component: this.id,
      subject: disruptionId,
      actor: { kind: "system", id: this.id },
      snapshotId: assessment.snapshotId,
      payload: { recommendationId: rec.id, band: rec.band, confidence: rec.confidence, items },
    });
    const payload: RecommendationIssuedPayload = { recommendationId: rec.id, disruptionId, band: rec.band };
    this.bus.publish(tx, { type: RECOMMENDATION_ISSUED, source: this.id, subject: disruptionId, payload });
  }

  recommendation(tx: Tx, id: string): Recommendation | undefined {
    return this.toRecommendation(tx, tx.one<RecommendationRow>("select * from ds_recommendation where id = ?", [id]));
  }

  forDisruption(tx: Tx, disruptionId: string): Recommendation | undefined {
    return this.toRecommendation(
      tx,
      tx.one<RecommendationRow>(
        "select * from ds_recommendation where disruption_id = ? order by issued_at desc, rowid desc limit 1",
        [disruptionId],
      ),
    );
  }

  private toRecommendation(tx: Tx, r: RecommendationRow | undefined): Recommendation | undefined {
    if (!r) return undefined;
    const items = tx
      .all<{ pattern_index: number; option_id: string }>(
        "select pattern_index, option_id from ds_recommendation_item where recommendation_id = ? order by pattern_index",
        [r.id],
      )
      .map((i) => ({ patternIndex: Number(i.pattern_index), optionId: i.option_id }));
    return {
      id: r.id,
      assessmentId: r.assessment_id,
      disruptionId: r.disruption_id,
      band: r.band,
      confidence: r.confidence,
      items,
      issuedAt: r.issued_at,
    };
  }
}
