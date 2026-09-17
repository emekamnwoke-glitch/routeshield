/**
 * The storage port (ADR-0010). The core worker is the only writer, so every
 * transaction runs to completion before the next one starts.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, SqlValue>;

export interface Tx {
  run(sql: string, params?: readonly SqlValue[]): void;
  all<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): T[];
  one<T extends Row = Row>(sql: string, params?: readonly SqlValue[]): T | undefined;
}

export interface Store {
  /**
   * Runs fn in one transaction: commits if it returns, rolls back if it throws.
   * Transactions never interleave, even when fn awaits.
   */
  transaction<T>(fn: (tx: Tx) => Promise<T> | T): Promise<T>;
  /** Read access, queued behind any open transaction; the handle stays valid until fn settles. */
  read<T>(fn: (tx: Tx) => Promise<T> | T): Promise<T>;
  close(): void;
}
