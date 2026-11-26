import { useEffect, useMemo, useRef, useState } from "react";
import type { Circle } from "../../../src/core/kernel/primitives";
import type { LatLon, VehicleView } from "../workspace/service";
import type { SiteNetwork } from "./network";
import type { View } from "./projection";
import { placeCallout } from "./callout";
import { fit, focusView, project, toScreen, toWorld, unproject, zoomAt } from "./projection";
import { useMedia } from "../shell/useMedia";

type Props = {
  network: SiteNetwork;
  route: number | null;
  footprints: Circle[];
  /** Road edges a disruption closes. */
  blocked: LatLon[][];
  /** Suggested bypasses. */
  detours: LatLon[][];
  vehicles: VehicleView[];
  pick: { lat: number; lon: number } | null;
  /** While a report is being placed: the radius to preview around the pick, and the glass callout. */
  picking?: { radiusM: number } | null;
  /** Zoom to this closure, close enough to read the streets around it (the incident screens' map). */
  focus?: Circle | null;
  /** Route patterns a closure cuts (indexes into network.patterns), drawn as routes (Figma frames A and D). */
  cut?: number[];
  onPick: (lat: number, lon: number) => void;
};

type Colours = {
  bg: string;
  road: string;
  route: string;
  stop: string;
  footprint: string;
  pick: string;
  detour: string;
  vehicle: string;
  approaching: string;
  preview: string;
};

function colours(el: HTMLElement): Colours {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v("--map-bg"),
    road: v("--map-road"),
    route: v("--map-route"),
    stop: v("--map-stop"),
    footprint: v("--map-footprint"),
    pick: v("--map-pick"),
    detour: v("--map-detour"),
    vehicle: v("--map-vehicle"),
    approaching: v("--map-approaching"),
    preview: v("--map-preview"),
  };
}

/** "−6.26030": five places, with a true minus sign, as the prototype writes coordinates. */
export const coord = (n: number): string => n.toFixed(5).replace("-", "−");

/** Pixels the pointer may move and still count as a click, not a drag. */
const CLICK_SLOP = 4;

export function NetworkMap({ network, route, footprints, blocked, detours, vehicles, pick, picking = null, focus = null, cut = [], onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The colours come from CSS: a change of light or dark theme redraws the map in the new ones.
  const dark = useMedia("(prefers-color-scheme: dark)");
  const cutKey = cut.join(",");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; view: View } | null>(null);

  // Project every edge once.
  const lines = useMemo(
    () =>
      network.edges.map((edge) => {
        const out = new Float64Array(edge.length);
        for (let i = 0; i < edge.length; i += 2) {
          const [x, y] = project(edge[i] ?? 0, edge[i + 1] ?? 0);
          out[i] = x;
          out[i + 1] = y;
        }
        return out;
      }),
    [network],
  );

  const routeEdges = useMemo(() => {
    const cutSet = new Set(cut);
    return new Set(
      network.patterns.filter((p, i) => p.route === route || cutSet.has(i)).flatMap((p) => p.path.map((de) => de >> 1)),
    );
  }, [network, route, cutKey]);

  const routeStops = useMemo(() => {
    if (route === null) return [];
    const ids = new Set(network.patterns.filter((p) => p.route === route).flatMap((p) => p.stops));
    return [...ids].map((i) => network.stops[i]).filter((s) => s !== undefined);
  }, [network, route]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width > 0 && view === null) setView(fit(network.bounds, size.width, size.height));
  }, [size, view, network]);

  // A new incident to focus on re-centres the map; panning and zooming after that are the person's own.
  const focusKey = focus ? `${focus.lat},${focus.lon},${focus.radiusM}` : "";
  useEffect(() => {
    if (!focus || size.width === 0) return;
    setView(focusView(focus, size.width, size.height));
  }, [focusKey, size.width, size.height]); // re-centre only when the incident or the map size changes

  const home = () => setView(focus ? focusView(focus, size.width, size.height) : fit(network.bounds, size.width, size.height));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view || size.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = colours(canvas);
    const { width, height } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const stroke = (edges: Iterable<number>, colour: string, lineWidth: number) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      for (const i of edges) {
        const line = lines[i];
        if (!line) continue;
        for (let j = 0; j < line.length; j += 2) {
          const [sx, sy] = toScreen(view, width, height, line[j] ?? 0, line[j + 1] ?? 0);
          if (j === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    };

    stroke(lines.keys(), c.road, 1);
    stroke(routeEdges, c.route, focus ? 4 : 3);

    ctx.fillStyle = c.stop;
    for (const s of routeStops) {
      const [sx, sy] = toScreen(view, width, height, ...project(s.location[0], s.location[1]));
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const f of footprints) {
      const [sx, sy] = toScreen(view, width, height, ...project(f.lat, f.lon));
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(4, f.radiusM * view.scale), 0, Math.PI * 2);
      if (focus) {
        // Zoomed to an incident (Figma frames A and D): the closure is a dashed ring, so the streets show through.
        ctx.setLineDash([5, 4]);
      } else {
        ctx.fillStyle = c.footprint;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = c.footprint;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const polyline = (lines: LatLon[][], colour: string, lineWidth: number, dash: number[] = []) => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (const line of lines) {
        line.forEach(([lat, lon], j) => {
          const [sx, sy] = toScreen(view, width, height, ...project(lat, lon));
          if (j === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    polyline(detours, c.detour, 3, [7, 5]);
    polyline(blocked, c.footprint, 4);

    for (const v of vehicles) {
      const [sx, sy] = toScreen(view, width, height, ...project(v.lat, v.lon));
      const affected = v.relation === "approaching" || v.relation === "inside";
      ctx.beginPath();
      if (focus && affected) {
        // Zoomed to an incident: a bus heading for the closure is a triangle in the bypass's tone (Figma frame D).
        ctx.fillStyle = v.relation === "inside" ? c.footprint : c.detour;
        ctx.moveTo(sx, sy - 5);
        ctx.lineTo(sx + 5, sy + 4);
        ctx.lineTo(sx - 5, sy + 4);
        ctx.closePath();
        ctx.fill();
        continue;
      }
      ctx.fillStyle = v.relation === "inside" ? c.footprint : v.relation === "approaching" ? c.approaching : c.vehicle;
      ctx.arc(sx, sy, affected ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (affected) {
        ctx.strokeStyle = c.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // The closure being placed: a dashed preview of its radius, in the bypass's attention tone.
    if (pick && picking) {
      const [sx, sy] = toScreen(view, width, height, ...project(pick.lat, pick.lon));
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(6, picking.radiusM * view.scale), 0, Math.PI * 2);
      ctx.fillStyle = c.preview;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = c.preview;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (pick && picking && focus) {
      // Zoomed in to place a closure (prototype P2): a pin at the point, in the bypass's attention tone.
      const [sx, sy] = toScreen(view, width, height, ...project(pick.lat, pick.lon));
      ctx.strokeStyle = c.preview;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy - 9, 6, Math.PI * 0.8, Math.PI * 2.2);
      ctx.lineTo(sx, sy);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, sy - 9, 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pick) {
      const [sx, sy] = toScreen(view, width, height, ...project(pick.lat, pick.lon));
      ctx.strokeStyle = c.pick;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy);
      ctx.lineTo(sx + 8, sy);
      ctx.moveTo(sx, sy - 8);
      ctx.lineTo(sx, sy + 8);
      ctx.stroke();
    }
  }, [view, size, lines, routeEdges, routeStops, footprints, blocked, detours, vehicles, pick, picking, focus, dark]);

  // Wheel zoom needs a non-passive listener: React's is passive, so the page would scroll too.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const at: [number, number] = [e.clientX - rect.left, e.clientY - rect.top];
      setView((v) => v && zoomAt(v, rect.width, rect.height, ...at, e.deltaY < 0 ? 1.25 : 0.8));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // The glass callout sits below the pin, kept inside the map.
  const callout = useMemo((): [number, number] | null => {
    if (!pick || !view || size.width === 0) return null;
    return placeCallout(...toScreen(view, size.width, size.height, ...project(pick.lat, pick.lon)), size.width, size.height);
  }, [pick, view, size]);

  const local = (e: React.PointerEvent): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const zoom = (factor: number, at?: [number, number]) =>
    setView((v) => v && zoomAt(v, size.width, size.height, ...(at ?? [size.width / 2, size.height / 2]), factor));

  const pan = (dx: number, dy: number) => setView((v) => v && { ...v, cx: v.cx + dx / v.scale, cy: v.cy + dy / v.scale });

  return (
    <div className="map">
      <canvas
        ref={canvasRef}
        className="map-canvas"
        tabIndex={0}
        role="img"
        aria-label="Map of the sample Dublin bus network. Arrow keys pan, plus and minus zoom. Click, or press Enter for the centre, to place a closure."
        onPointerDown={(e) => {
          if (!view) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, moved: false, view };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > CLICK_SLOP) d.moved = true;
          if (d.moved) setView({ ...d.view, cx: d.view.cx - dx / d.view.scale, cy: d.view.cy - dy / d.view.scale });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved || !view) return;
          const [sx, sy] = local(e);
          const [lat, lon] = unproject(...toWorld(view, size.width, size.height, sx, sy));
          onPick(lat, lon);
        }}
        onKeyDown={(e) => {
          const step = 60;
          const actions: Record<string, () => void> = {
            ArrowLeft: () => pan(-step, 0),
            ArrowRight: () => pan(step, 0),
            ArrowUp: () => pan(0, -step),
            ArrowDown: () => pan(0, step),
            "+": () => zoom(1.25),
            "=": () => zoom(1.25),
            "-": () => zoom(0.8),
            // Keyboard placement: Enter puts the closure at the centre of the view.
            Enter: () => view && onPick(...unproject(view.cx, view.cy)),
          };
          const act = actions[e.key];
          if (act) {
            e.preventDefault();
            act();
          }
        }}
      />
      {pick && picking && callout && (
        <div className="glass callout" style={{ left: callout[0], top: callout[1] }}>
          <b>Closure point</b>
          <span>
            {coord(pick.lat)}, {coord(pick.lon)} · {picking.radiusM} m radius
          </span>
          <small>Click again to move it</small>
        </div>
      )}
      <div className="map-controls">
        <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={home}>
          Fit
        </button>
      </div>
    </div>
  );
}
