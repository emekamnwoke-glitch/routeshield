import type { Actor, Json } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

/** Hash that the first audit event chains from. */
export const GENESIS_HASH = "0".repeat(64);

export interface AuditInput {
  type: string;
  /** The component recording the change, e.g. "AC-07". */
  component: string;
  subject: string;
  actor?: Actor;
  snapshotId?: string;
  payload: Json;
}

export interface AuditRecord {
  id: string;
  seq: number;
  at: string;
  type: string;
  component: string;
  subject: string;
  actor: Actor | null;
  snapshotId: string | null;
  payload: Json;
  prevHash: string;
  hash: string;
}

/** Copies of sourced inputs as they stood, scoped to a disruption's area (ADR-0004). */
export interface SnapshotInput {
  networkVersion: string;
  positions: Json;
  assignments: Json;
  roadConditions: Json;
  sourceHealth: Json;
}

export interface SnapshotRecord extends SnapshotInput {
  id: string;
  takenAt: string;
  contentHash: string;
}

export interface ChainReport {
  ok: boolean;
  events: number;
  snapshots: number;
  problems: string[];
}

/**
 * AC-11 Audit Ledger: sole writer of DD-11. Other components call append()
 * inside their own transaction, so a change and its audit event commit
 * together or not at all (AR-002, FR-D3).
 */
export interface AuditLedger {
  append(tx: Tx, input: AuditInput): Promise<AuditRecord>;
  /** Persists a snapshot and chains a snapshot.frozen event that carries its content hash. */
  freezeSnapshot(tx: Tx, input: SnapshotInput, component: string, subject: string): Promise<SnapshotRecord>;
  snapshot(tx: Tx, id: string): SnapshotRecord | undefined;
  events(tx: Tx, filter?: { subject?: string; type?: string }): AuditRecord[];
  /** Recomputes the whole chain and every snapshot hash (AR-003). */
  verify(tx: Tx): Promise<ChainReport>;
}
