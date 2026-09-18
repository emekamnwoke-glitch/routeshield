import type { CoreModule } from "../../kernel/module";
import type { Clock } from "../../kernel/primitives";
import type { Tx } from "../../kernel/store";
import type { ContingencyLibrary, ContingencyRoute } from "./contract";

type RouteRow = {
  id: string;
  version: number;
  pattern_id: string;
  approved_by: string;
  expires_at: string;
};

export class ContingencyLibraryModule implements CoreModule, ContingencyLibrary {
  readonly id = "AC-10";
  readonly name = "Contingency Library";
  readonly tablePrefix = "cl_";

  constructor(private readonly clock: Clock) {}

  migrate(tx: Tx): void {
    tx.run(`create table if not exists cl_route (
      id text not null,
      version integer not null,
      pattern_id text not null,
      corridor_lat real not null,
      corridor_lon real not null,
      corridor_radius_m real not null,
      approved_by text not null,
      expires_at text not null,
      primary key (id, version)
    )`);
  }

  /**
   * Walking skeleton: the library starts empty, so this returns every
   * unexpired route. Matching routes to a footprint comes with the routing engine.
   */
  candidates(tx: Tx, _disruptionVersionId: string): ContingencyRoute[] {
    return tx
      .all<RouteRow>("select id, version, pattern_id, approved_by, expires_at from cl_route where expires_at > ?", [
        this.clock.now(),
      ])
      .map((r) => ({
        id: r.id,
        version: Number(r.version),
        patternId: r.pattern_id,
        approvedBy: r.approved_by,
        expiresAt: r.expires_at,
      }));
  }
}
