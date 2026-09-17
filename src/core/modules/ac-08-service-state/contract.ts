import type { Tx } from "../../kernel/store";

export const SERVICE_STATE_CHANGED = "service_state.changed";

/** DD-7: what the service is doing now, and which decision put it there. */
export type ServiceState = {
  id: string;
  disruptionId: string;
  decisionId: string;
  state: "planned" | "held" | "diverted";
  since: string;
};

export type ServiceStateChangedPayload = {
  stateId: string;
  disruptionId: string;
  decisionId: string;
  state: ServiceState["state"];
};

/** AC-08 Service State: sole writer of DD-7, the only live operational state RouteShield owns. */
export interface ServiceStateStore {
  current(tx: Tx, disruptionId: string): ServiceState | undefined;
}
