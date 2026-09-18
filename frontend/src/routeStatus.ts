import type { WorkspaceState } from "./workspace/service";

/**
 * One status per bus route, across every disruption:
 * - "recommended": the route is cut and a response awaits a person (yellow);
 * - "diverted" or "held": a person approved it and it is in effect (red).
 * A route whose recommendation was rejected stays "recommended": it is
 * still cut, and nothing has been put in place.
 */
export type RouteStatus = { routeCode: string; status: "recommended" | "diverted" | "held" };

const RANK = { recommended: 0, held: 1, diverted: 2 } as const;

export function routeStatuses(state: WorkspaceState | null): RouteStatus[] {
  const out = new Map<string, RouteStatus["status"]>();
  const raise = (routeCode: string, status: RouteStatus["status"]) => {
    const current = out.get(routeCode);
    if (current === undefined || RANK[status] > RANK[current]) out.set(routeCode, status);
  };
  for (const d of state?.disruptions ?? []) {
    for (const p of d.impact?.patterns ?? []) raise(p.routeCode, "recommended");
    for (const s of d.serviceStates) {
      if (s.state === "diverted" || s.state === "held") raise(s.routeCode, s.state);
    }
  }
  return [...out].map(([routeCode, status]) => ({ routeCode, status })).sort((a, b) => a.routeCode.localeCompare(b.routeCode, "en", { numeric: true }));
}

export const STATUS_TEXT: Record<RouteStatus["status"], string> = {
  recommended: "bypass recommended, awaiting approval",
  diverted: "bypass approved and in effect",
  held: "hold approved and in effect",
};
