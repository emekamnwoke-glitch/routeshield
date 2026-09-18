import type { CoreModule } from "../../kernel/module";
import type { Actor, Clock } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { AuditLedger } from "../ac-11-audit-ledger/contract";
import type { AccessControl, Action, AuthorityDecision, PersonaId } from "./contract";
import { AuthorityError, PERSONAS } from "./contract";

/** Initial grants. The administrator can grant authority but not decide: separation of duties. */
const INITIAL_GRANTS: [PersonaId, Action][] = [
  ["controller", "decide"],
  ["duty-manager", "decide"],
  ["contingency-approver", "approve_contingency"],
  ["administrator", "grant_authority"],
];

export class AccessControlModule implements CoreModule, AccessControl {
  readonly id = "AC-14";
  readonly name = "Access Control";
  readonly tablePrefix = "ax_";

  constructor(
    private readonly clock: Clock,
    private readonly ledger: AuditLedger,
  ) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists ax_grant (
      persona_id text not null,
      action text not null,
      granted_at text not null,
      granted_by text not null,
      revoked_at text,
      primary key (persona_id, action)
    )`);
  }

  /** Records the initial grants once, as the system, on a fresh store. */
  async seed(tx: Tx): Promise<void> {
    if (tx.one("select 1 from ax_grant limit 1")) return;
    const system: Actor = { kind: "system", id: this.id };
    for (const [persona, action] of INITIAL_GRANTS) await this.write(tx, system, persona, action);
  }

  authorise(tx: Tx, actor: Actor, action: Action): AuthorityDecision {
    if (actor.kind !== "persona") return { allowed: false, reason: `a ${actor.kind} actor cannot ${action}` };
    if (!PERSONAS.some((p) => p.id === actor.id)) return { allowed: false, reason: `unknown persona ${actor.id}` };
    const grant = tx.one("select 1 from ax_grant where persona_id = ? and action = ? and revoked_at is null", [
      actor.id,
      action,
    ]);
    return grant
      ? { allowed: true, reason: `${actor.id} holds ${action}` }
      : { allowed: false, reason: `${actor.id} does not hold ${action}` };
  }

  async grant(tx: Tx, by: Actor, persona: PersonaId, action: Action): Promise<void> {
    this.requireGrantAuthority(tx, by);
    await this.write(tx, by, persona, action);
  }

  async revoke(tx: Tx, by: Actor, persona: PersonaId, action: Action): Promise<void> {
    this.requireGrantAuthority(tx, by);
    tx.run("update ax_grant set revoked_at = ? where persona_id = ? and action = ? and revoked_at is null", [
      this.clock.now(),
      persona,
      action,
    ]);
    await this.ledger.append(tx, {
      type: "authority.revoked",
      component: this.id,
      subject: persona,
      actor: by,
      payload: { persona, action },
    });
  }

  private requireGrantAuthority(tx: Tx, by: Actor): void {
    const decision = this.authorise(tx, by, "grant_authority");
    if (!decision.allowed) throw new AuthorityError(decision.reason);
  }

  private async write(tx: Tx, by: Actor, persona: PersonaId, action: Action): Promise<void> {
    tx.run(
      `insert into ax_grant (persona_id, action, granted_at, granted_by, revoked_at) values (?, ?, ?, ?, null)
       on conflict (persona_id, action) do update set granted_at = excluded.granted_at,
         granted_by = excluded.granted_by, revoked_at = null`,
      [persona, action, this.clock.now(), `${by.kind}:${by.id}`],
    );
    await this.ledger.append(tx, {
      type: "authority.granted",
      component: this.id,
      subject: persona,
      actor: by,
      payload: { persona, action },
    });
  }
}
