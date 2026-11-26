import type { ReactNode } from "react";
import { routeStatuses } from "../routeStatus";
import { RouteStatusCard } from "../RouteStatusCard";
import { ScreenHead } from "../shell/ScreenHead";
import type { WorkspaceState } from "../workspace/service";
import type { SiteNetwork } from "./network";
import { NetworkMap } from "./NetworkMap";

type Props = {
  network: SiteNetwork | null;
  networkFailed: string | null;
  onRetryNetwork: () => void;
  state: WorkspaceState | null;
  route: number | null;
  onRoute: (route: number | null) => void;
  pick: { lat: number; lon: number };
  reporting: boolean;
  radiusM: number;
  onPick: (lat: number, lon: number) => void;
  onReport: () => void;
  /** The fiction notice at the foot of the list. */
  note?: ReactNode;
};

/** The whole network, shared by every role: where incidents are placed and every closure and bypass is drawn. */
export function MapScreen({ network, networkFailed, onRetryNetwork, state, route, onRoute, pick, reporting, radiusM, onPick, onReport, note }: Props) {
  const disruptions = state?.disruptions ?? [];
  return (
    <div className="screen map-screen">
      <section className="screen-main" aria-label="Network map">
        <ScreenHead title="Network map">
          <div className="map-tools">
            <label>
              Highlight route{" "}
              <select
                value={route ?? ""}
                onChange={(e) => onRoute(e.target.value === "" ? null : Number(e.target.value))}
                disabled={!network}
              >
                <option value="">None</option>
                {network?.routes.map((r, i) => (
                  <option key={r.code} value={i}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="primary pill-button" disabled={!state?.network.loaded} aria-expanded={reporting} onClick={onReport}>
              Report an incident…
            </button>
          </div>
        </ScreenHead>

        {network ? (
          <NetworkMap
            network={network}
            route={route}
            footprints={disruptions.map((d) => d.footprint)}
            blocked={disruptions.flatMap((d) => d.impact?.blockedLines ?? [])}
            detours={disruptions.flatMap((d) => d.recommendation?.items.flatMap((i) => (i.detour.length ? [i.detour] : [])) ?? [])}
            vehicles={state?.vehicles ?? []}
            pick={pick}
            picking={reporting ? { radiusM } : null}
            onPick={onPick}
          />
        ) : (
          <div className="loading" aria-busy={!networkFailed}>
            {networkFailed ? (
              <>
                <p>{networkFailed}</p>
                <button type="button" onClick={onRetryNetwork}>
                  Try again
                </button>
              </>
            ) : (
              <p>Loading the Dublin network…</p>
            )}
          </div>
        )}
        <p className="map-note">Click the map, or focus it and press Enter, to place a closure. It starts on O'Connell Street.</p>
        <div className="legend" aria-label="Map legend">
          <span>
            <span className="swatch" style={{ background: "var(--map-route)" }} />
            Highlighted route
          </span>
          <span>
            <span className="swatch" style={{ background: "var(--map-footprint)" }} />
            Closed road
          </span>
          <span>
            <span
              className="swatch"
              style={{ background: "repeating-linear-gradient(90deg, var(--map-detour) 0 5px, transparent 5px 8px)" }}
            />
            Suggested bypass
          </span>
          <span>
            <span className="swatch dot" style={{ background: "var(--map-approaching)" }} />
            Vehicle approaching
          </span>
          <span>
            <span className="swatch dot" style={{ background: "var(--map-footprint)" }} />
            Vehicle inside
          </span>
          <span>
            <span className="swatch dot" style={{ background: "var(--map-vehicle)" }} />
            Other vehicle (synthetic)
          </span>
        </div>
        <RouteStatusCard routes={routeStatuses(state)} />
        {note}
      </section>
    </div>
  );
}
