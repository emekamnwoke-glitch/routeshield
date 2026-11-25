/**
 * What went wrong, in words a controller can act on. Every command runs in one store transaction
 * (AR-002), so a failed command changed nothing; a failed load changed nothing either.
 */
export type FailureKind = "network" | "state" | "command";

export type Failure = { kind: FailureKind; detail: string };

export function failureText(f: Failure): { title: string; body: string; retry: string | null } {
  switch (f.kind) {
    case "network":
      return {
        title: "The Dublin network could not be loaded.",
        body: "The map and reporting need it. Nothing was changed.",
        retry: "Try again",
      };
    case "state":
      return {
        title: "The workspace could not be read.",
        body: "Incidents and proposals are not shown. Nothing was changed.",
        retry: "Try again",
      };
    case "command":
      return {
        title: "That did not go through.",
        body: `${f.detail.replace(/\.?$/, ".")} Nothing was changed.`,
        retry: null,
      };
  }
}

/** Index of the element Tab (or Shift+Tab) should move to, wrapping inside a focus trap of `count` elements. */
export function trapIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}
