/**
 * Composition root for the RouteShield core (ADR-0006). It builds every
 * component over one store, migrates their tables, and wires the event bus.
 * The core worker (ADR-0010) will call this; tests call it directly.
 *
 * AC-13 Control Workspace is presentation and lives in the UI, not here.
 */
import { EventBus } from "./kernel/events";
import type { CoreModule } from "./kernel/module";
import type { Network } from "./kernel/network";
import type { Clock } from "./kernel/primitives";
import { systemClock } from "./kernel/primitives";
import { checkSchema, writeSchema } from "./kernel/schema";
import type { Store } from "./kernel/store";
import type { Telemetry } from "./kernel/telemetry";
import { InMemoryTelemetry } from "./kernel/telemetry";
import type { FleetScene } from "./modules/ac-01-source-gateway/contract";
import { SourceGatewayModule } from "./modules/ac-01-source-gateway/module";
import { DisruptionManagerModule } from "./modules/ac-02-disruption-manager/module";
import { ImpactAssessorModule } from "./modules/ac-04-impact-assessor/module";
import { RouteOptimiserModule } from "./modules/ac-05-route-optimiser/module";
import { DecisionSupportModule } from "./modules/ac-06-decision-support/module";
import { DecisionManagerModule } from "./modules/ac-07-decision-manager/module";
import { ServiceStateModule } from "./modules/ac-08-service-state/module";
import { CommunicationHubModule } from "./modules/ac-09-communication-hub/module";
import { ContingencyLibraryModule } from "./modules/ac-10-contingency-library/module";
import { AuditLedgerModule } from "./modules/ac-11-audit-ledger/module";
import { ServiceAnalyticsModule } from "./modules/ac-12-service-analytics/module";
import { AccessControlModule } from "./modules/ac-14-access-control/module";

export type CoreOptions = {
  store: Store;
  clock?: Clock;
  telemetry?: Telemetry;
  /** The published network (DD-1). Without it, nothing is ever affected. */
  network?: Network;
  /** The synthetic fleet the vehicle platform reports. */
  fleet?: FleetScene;
};

export async function createCore({
  store,
  clock = systemClock,
  telemetry = new InMemoryTelemetry(),
  network,
  fleet,
}: CoreOptions) {
  const bus = new EventBus(store, clock, telemetry);
  const ledger = new AuditLedgerModule(clock, telemetry);
  const access = new AccessControlModule(clock, ledger);
  const sources = new SourceGatewayModule(store, bus, clock, network, fleet);
  const disruptions = new DisruptionManagerModule(bus, clock, ledger, sources);
  const impact = new ImpactAssessorModule(bus, clock, ledger, disruptions, sources);
  const contingencies = new ContingencyLibraryModule(clock);
  const optimiser = new RouteOptimiserModule(bus, ledger, contingencies, impact, sources);
  const support = new DecisionSupportModule(bus, clock, ledger, impact, optimiser);
  const decisions = new DecisionManagerModule(store, bus, clock, ledger, support, optimiser, access);
  const serviceState = new ServiceStateModule(bus, clock, ledger);
  const communications = new CommunicationHubModule(bus, clock, ledger);
  const analytics = new ServiceAnalyticsModule(store, ledger);

  const modules: CoreModule[] = [
    sources,
    disruptions,
    impact,
    optimiser,
    support,
    decisions,
    serviceState,
    communications,
    contingencies,
    ledger,
    analytics,
    access,
  ];

  // A subscriber that keeps failing is recorded in the audit chain, under its own component.
  bus.deadLetterTo(async (tx, event, subscriber, error) => {
    await ledger.append(tx, {
      type: "event.dead_lettered",
      component: subscriber,
      subject: event.subject,
      actor: { kind: "system", id: subscriber },
      payload: { eventId: event.id, eventType: event.type, error },
    });
  });

  await store.transaction(async (tx) => {
    checkSchema(tx);
    writeSchema(tx);
    EventBus.migrate(tx);
    for (const m of modules) m.migrate(tx);
    await access.seed(tx);
    sources.loadFleet(tx);
  });

  return {
    store,
    clock,
    telemetry,
    bus,
    modules,
    sources,
    disruptions,
    impact,
    optimiser,
    support,
    decisions,
    serviceState,
    communications,
    contingencies,
    ledger,
    analytics,
    access,
  };
}

export type Core = Awaited<ReturnType<typeof createCore>>;
