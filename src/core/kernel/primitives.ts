/** Small shared building blocks: time, identifiers, actors, canonical JSON and hashing. */

/** Time is always UTC ISO 8601 (technology standards). */
export interface Clock {
  now(): string;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };

/** A clock that only moves when told to, for tests and seeded scenarios. */
export class ManualClock implements Clock {
  private ms: number;

  constructor(start = "2026-09-21T08:00:00.000Z") {
    this.ms = Date.parse(start);
  }

  now(): string {
    return new Date(this.ms).toISOString();
  }

  advance(seconds: number): void {
    this.ms += seconds * 1000;
  }
}

/** Opaque, immutable, globally unique identifiers, prefixed for readability in the audit record. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Who did something. Personas are fictional roles (ADR-0012); nothing here can
 * hold a driver's identity (INV-12).
 */
export type Actor = { kind: "persona"; id: string } | { kind: "system"; id: string };

/** A circular area in WGS 84 (EPSG:4326), radius in metres. */
export type Circle = { lat: number; lon: number; radiusM: number };

export type Json =null | boolean | number | string | Json[] | { [key: string]: Json };

/** JSON with object keys sorted, so equal values always hash equally. */
export function canonicalJson(value: Json): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("canonical JSON cannot hold a non-finite number");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k] as Json)}`).join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
