/**
 * The demonstrator's IdentityPort (ADR-0012): whoever the persona switcher
 * says is acting. It authenticates no one; the UI says so wherever a persona
 * is shown. An OIDC adapter would implement the same port.
 */
import type { Actor } from "../../core/kernel/primitives";
import type { IdentityPort, PersonaId } from "../../core/modules/ac-14-access-control/contract";
import { PERSONAS } from "../../core/modules/ac-14-access-control/contract";

export class PersonaSwitcher implements IdentityPort {
  constructor(private persona: PersonaId = "controller") {}

  current(): Actor {
    return { kind: "persona", id: this.persona };
  }

  switchTo(persona: PersonaId): void {
    if (!PERSONAS.some((p) => p.id === persona)) throw new Error(`unknown persona ${persona}`);
    this.persona = persona;
  }
}
