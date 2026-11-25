import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";
import { PERSONAS } from "../../../src/core/modules/ac-14-access-control/contract";

/** What each persona can do on this site. The core checks every action; this text only explains it. */
export const AUTHORITY: Record<PersonaId, string> = {
  controller: "Can propose a decision. Cannot decide.",
  "duty-manager": "Can approve or deny a controller's proposal.",
  administrator: "Can read the audit trail. Cannot decide.",
  "contingency-approver": "No decision authority here.",
};

/** The order of the role menu: the people who act first, then the auditor, then the role with no authority here. */
export const ROLE_ORDER: readonly PersonaId[] = ["controller", "duty-manager", "administrator", "contingency-approver"];

export const roleName = (id: PersonaId): string => PERSONAS.find((p) => p.id === id)?.name ?? id;

/**
 * Where focus goes in a menu of `count` items when `key` is pressed on item `index`.
 * Arrows wrap, Home and End jump; any other key leaves focus where it is.
 */
export function moveFocus(index: number, key: string, count: number): number {
  if (count <= 0) return -1;
  switch (key) {
    case "ArrowDown":
      return (index + 1) % count;
    case "ArrowUp":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return index;
  }
}
