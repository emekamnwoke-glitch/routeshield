import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";

/** The screens of the site. Each role lands on its own work (Figma frames A, D and E) and shares the map. */
export type Screen = "incidents" | "proposals" | "review" | "audit" | "map";

/** The rail for each role, home screen first. The core still checks every action: this only arranges the screens. */
export const SCREENS: Record<PersonaId, readonly Screen[]> = {
  controller: ["incidents", "proposals", "map"],
  "duty-manager": ["review", "incidents", "map"],
  administrator: ["audit", "incidents", "map"],
  "contingency-approver": ["incidents", "map"],
};

export const SCREEN_META: Record<Screen, { label: string; icon: string; title: string }> = {
  incidents: { label: "Incidents", icon: "!", title: "Incidents" },
  proposals: { label: "Proposals", icon: "▤", title: "My proposals" },
  review: { label: "Review", icon: "▥", title: "Review queue" },
  audit: { label: "Audit", icon: "▥", title: "Audit trail" },
  map: { label: "Map", icon: "⌖", title: "Network map" },
};

/** Where a role lands: switching role always opens the new role's home screen. */
export const homeScreen = (persona: PersonaId): Screen => SCREENS[persona][0] ?? "map";
