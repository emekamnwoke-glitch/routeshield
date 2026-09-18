import type { DomainEvent, EventBus } from "../../kernel/events";
import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import { newId } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { SourceGateway } from "../ac-01-source-gateway/contract";
import type { DisruptionManager, DisruptionVersionedPayload } from "../ac-02-disruption-manager/contract";
import { DISRUPTION_VERSIONED } from "../ac-02-disruption-manager/contract";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { ImpactAssessedPayload, ImpactAssessment, ImpactAssessor } from "./contract";
import { IMPACT_ASSESSED } from "./contract";

type AssessmentRow = {
  id: string;
  disruption_id: string;
  version_id: string;
  snapshot_id: string;
  affected_trips: number;
  assessed_at: string;
};

export class ImpactAssessorModule implements CoreModule, ImpactAssessor {
  readonly id = "AC-04";
  readonly name = "Impact Assessor";
  readonly tablePrefix = "ia_";

  constructor(
    private readonly bus: EventBus,
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
    private readonly disruptions: DisruptionManager,
    private readonly sources: SourceGateway,
  ) {
    bus.subscribe(DISRUPTION_VERSIONED, this.id, (tx, e) => this.onVersion(tx, e));
  }

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ia_assessment (
      id text primary key,
      disruption_id text not null,
      version_id text not null unique,
      snapshot_id text not null,
      affected_trips integer not null,
      assessed_at text not null
    )`);
  }

  private async onVersion(tx: Tx, event: DomainEvent): Promise<void> {
    const { versionId } = event.payload as DisruptionVersionedPayload;
    const version = this.disruptions.version(tx, versionId);
    if (!version) throw new Error(`disruption version ${versionId} not found`);
    // The snapshot is evidence before assessment starts (AR-001). The skeleton
    // has no network or fleet loaded yet, so it freezes empty inputs and the
    // source health as it stands.
    const snapshot = await this.ledger.freezeSnapshot(
      tx,
      {
        networkVersion: "none",
        positions: [],
        assignments: [],
        roadConditions: [],
        sourceHealth: this.sources.health(tx),
      },
      this.id,
      version.disruptionId,
    );
    const assessment: ImpactAssessment = {
      id: newId("imp"),
      disruptionId: version.disruptionId,
      versionId,
      snapshotId: snapshot.id,
      affectedTrips: 0,
      assessedAt: this.clock.now(),
    };
    tx.run(
      `insert into ia_assessment (id, disruption_id, version_id, snapshot_id, affected_trips, assessed_at)
       values (?, ?, ?, ?, ?, ?)`,
      [
        assessment.id,
        assessment.disruptionId,
        assessment.versionId,
        assessment.snapshotId,
        assessment.affectedTrips,
        assessment.assessedAt,
      ],
    );
    await this.ledger.append(tx, {
      type: "impact.assessed",
      component: this.id,
      subject: version.disruptionId,
      actor: { kind: "system", id: this.id },
      snapshotId: snapshot.id,
      payload: { assessmentId: assessment.id, versionId, affectedTrips: assessment.affectedTrips },
    });
    const payload: ImpactAssessedPayload = { assessmentId: assessment.id, disruptionId: version.disruptionId, versionId };
    this.bus.publish(tx, { type: IMPACT_ASSESSED, source: this.id, subject: version.disruptionId, payload });
  }

  assessment(tx: Tx, id: string): ImpactAssessment | undefined {
    const r = tx.one<AssessmentRow>("select * from ia_assessment where id = ?", [id]);
    return (
      r && {
        id: r.id,
        disruptionId: r.disruption_id,
        versionId: r.version_id,
        snapshotId: r.snapshot_id,
        affectedTrips: Number(r.affected_trips),
        assessedAt: r.assessed_at,
      }
    );
  }
}
