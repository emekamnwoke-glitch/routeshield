import type { SiteNetwork } from "./network";
import { NetworkMap } from "./NetworkMap";
import type { DisruptionView, VehicleView } from "../workspace/service";
import { DEFAULT_INCIDENT } from "../workspace/service";

type Props = {
  network: SiteNetwork | null;
  /** Every open disruption is drawn; the selected one is zoomed to. */
  disruptions: DisruptionView[];
  /** Zoomed to, even when declined and no longer drawn (prototype P10). */
  selected: DisruptionView | null;
  vehicles: VehicleView[];
  /** While a report is being placed (prototype P2): the closure point and its radius. */
  picking?: { lat: number; lon: number; radiusM: number } | null;
  onPick: (lat: number, lon: number) => void;
};

/** The map under an incident list: zoomed to the selected closure, with its bypasses dashed. */
export function MiniMap({ network, disruptions, selected, vehicles, picking = null, onPick }: Props) {
  if (!network) {
    return (
      <div className="mini-map loading" aria-busy="true">
        <p>Loading the Dublin network…</p>
      </div>
    );
  }
  // With nothing selected, the map rests on O'Connell Street, where a report starts (prototype P1).
  const focus = picking
    ? { lat: picking.lat, lon: picking.lon, radiusM: picking.radiusM }
    : (selected?.footprint ?? { lat: DEFAULT_INCIDENT.lat, lon: DEFAULT_INCIDENT.lon, radiusM: DEFAULT_INCIDENT.radiusM });
  return (
    <section className="mini-map" aria-label="Map of the selected incident">
      <NetworkMap
        network={network}
        route={null}
        footprints={disruptions.map((d) => d.footprint)}
        blocked={disruptions.flatMap((d) => d.impact?.blockedLines ?? [])}
        detours={disruptions.flatMap((d) => d.recommendation?.items.flatMap((i) => (i.detour.length ? [i.detour] : [])) ?? [])}
        vehicles={vehicles}
        pick={picking}
        picking={picking}
        focus={focus}
        cut={disruptions.flatMap((d) => d.impact?.patterns.map((p) => p.patternIndex) ?? [])}
        onPick={onPick}
      />
      {/* With nothing open, the map says how to start (prototype P1, P10c and P11). */}
      {disruptions.length === 0 && !picking && <p className="map-hint">Click the map, or press Enter on it, to place a closure. It starts on O'Connell Street.</p>}
      <small className="attribution">{network.attribution.join(" · ")}</small>
    </section>
  );
}
