import networkUrl from "../../../data/fixtures/site/network.json?url";

/** data/fixtures/site/network.json, written by pipeline/site_bundle.py. */
export type SiteNetwork = {
  format: "routeshield-site-network/1";
  attribution: string[];
  bounds: [number, number, number, number];
  edges: number[][];
  routes: { code: string; name: string }[];
  stops: { code: string; name: string; location: [number, number] }[];
  patterns: {
    id: string;
    route: number;
    direction: number;
    trips: number;
    path: number[];
    stops: number[];
    matchedShare: number;
  }[];
};

export async function loadNetwork(): Promise<SiteNetwork> {
  const res = await fetch(networkUrl);
  if (!res.ok) throw new Error(`could not load the network (${res.status})`);
  const data = (await res.json()) as SiteNetwork;
  if (data.format !== "routeshield-site-network/1") throw new Error(`unexpected network format ${String(data.format)}`);
  return data;
}
