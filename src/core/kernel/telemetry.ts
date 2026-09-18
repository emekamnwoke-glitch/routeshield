/**
 * Telemetry shaped on the OpenTelemetry data model (ADR-0013): spans, metrics
 * and logs. The reference profile exports to memory for a diagnostics panel.
 * Telemetry is separate from the audit record and never replaces it.
 */

export type Attributes = Record<string, string | number | boolean>;

export interface SpanRecord {
  name: string;
  attributes: Attributes;
  startedAt: number;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
}

export interface LogRecord {
  severity: "debug" | "info" | "warn" | "error";
  body: string;
  attributes: Attributes;
}

export interface Telemetry {
  span<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T>;
  count(name: string, value?: number, attributes?: Attributes): void;
  log(severity: LogRecord["severity"], body: string, attributes?: Attributes): void;
}

export class InMemoryTelemetry implements Telemetry {
  readonly spans: SpanRecord[] = [];
  readonly logs: LogRecord[] = [];
  readonly counters = new Map<string, number>();

  async span<T>(name: string, attributes: Attributes, fn: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await fn();
      this.spans.push({ name, attributes, startedAt, durationMs: performance.now() - startedAt, status: "ok" });
      return result;
    } catch (err) {
      this.spans.push({
        name,
        attributes,
        startedAt,
        durationMs: performance.now() - startedAt,
        status: "error",
        error: String(err),
      });
      throw err;
    }
  }

  count(name: string, value = 1, attributes: Attributes = {}): void {
    const key = Object.keys(attributes).length ? `${name}${JSON.stringify(attributes)}` : name;
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  log(severity: LogRecord["severity"], body: string, attributes: Attributes = {}): void {
    this.logs.push({ severity, body, attributes });
  }
}
