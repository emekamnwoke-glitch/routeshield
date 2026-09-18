import type { Tx } from "../../kernel/store";

export const SERVICE_STATE_CHANGED = "service_state.changed";

/** DD-7: what a pattern's service is doing now, and which decision put it there. */
export type ServiceState = {
  id: string;
  disruptionId: string;
  decisionId: string;
  patternIndex: number;
  optionId: string;
  state: "planned" | "held" | "diverted";
  since: string;
};

export type ServiceStateChangedPayload = {
  stateId: string;
  disruptionId: string;
  decisionId: string;
  patternIndex: number;
  state: ServiceState["state"];
};

/** AC-08 Service State: sole writer of DD-7, the only live operational state RouteShield owns. */
export interface ServiceStateStore {
  /** The current state of every pattern a disruption's decisions have changed. */
  current(tx: Tx, disruptionId: string): ServiceState[];
}
