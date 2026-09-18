import type { Actor } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";

/**
 * Fictional personas (ADR-0012). The demonstrator switches between them; it
 * does not authenticate anyone. Authorisation over them is real.
 */
export const PERSONAS = [
  { id: "controller", name: "Controller" },
  { id: "duty-manager", name: "Duty manager" },
  { id: "contingency-approver", name: "Contingency approver" },
  { id: "administrator", name: "Administrator" },
] as const;

export type PersonaId = (typeof PERSONAS)[number]["id"];
export type Action = "decide" | "approve_contingency" | "grant_authority";

export type AuthorityDecision = { allowed: boolean; reason: string };

/** Who is acting now. An OIDC adapter would implement this in the operator profile. */
export interface IdentityPort {
  current(): Actor;
}

/** AC-14 Access Control: sole writer of DD-13. Answers "may this actor do this, now?". */
export interface AccessControl {
  authorise(tx: Tx, actor: Actor, action: Action): AuthorityDecision;
  grant(tx: Tx, by: Actor, persona: PersonaId, action: Action): Promise<void>;
  revoke(tx: Tx, by: Actor, persona: PersonaId, action: Action): Promise<void>;
}

/** Raised when an actor lacks the authority an action needs. */
export class AuthorityError extends Error {
  override readonly name = "AuthorityError";
}
