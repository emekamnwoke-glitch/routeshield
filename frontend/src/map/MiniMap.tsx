import type { SiteNetwork } from "./network";
import { NetworkMap } from "./NetworkMap";
import type { DisruptionView, VehicleView } from "../workspace/service";

type Props = {
  network: SiteNetwork | null;
  /** Every open disruption is drawn; the selected one is zoomed to. */
  disruptions: DisruptionView[];
  selected: DisruptionView | null;
  vehicles: VehicleView[];
  onPick: (lat: number, lon: number) => void;
};

/** The map under an incident list: zoomed to the selected closure, with its bypasses dashed. */
export function MiniMap({ network, disruptions, selected, vehicles, onPick }: Props) {
  if (!network) {
    return (
      <div className="mini-map loading" aria-busy="true">
        <p>Loading the Dublin network…</p>
      </div>
    );
  }
  return (
    <section className="mini-map" aria-label="Map of the selected incident">
      <NetworkMap
        network={network}
        route={null}
        footprints={disruptions.map((d) => d.footprint)}
        blocked={disruptions.flatMap((d) => d.impact?.blockedLines ?? [])}
        detours={disruptions.flatMap((d) => d.recommendation?.items.flatMap((i) => (i.detour.length ? [i.detour] : [])) ?? [])}
        vehicles={vehicles}
        pick={null}
        focus={selected?.footprint ?? null}
        onPick={onPick}
      />
      <small className="attribution">{network.attribution.join(" · ")}</small>
    </section>
  );
}
