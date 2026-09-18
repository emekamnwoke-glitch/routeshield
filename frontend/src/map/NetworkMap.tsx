import { useEffect, useMemo, useRef, useState } from "react";
import type { Circle } from "../../../src/core/kernel/primitives";
import type { SiteNetwork } from "./network";
import type { View } from "./projection";
import { fit, project, toScreen, toWorld, unproject, zoomAt } from "./projection";

type Props = {
  network: SiteNetwork;
  route: number | null;
  footprints: Circle[];
  pick: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
};

type Colours = { bg: string; road: string; route: string; stop: string; footprint: string; pick: string };

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
  };
}

/** Pixels the pointer may move and still count as a click, not a drag. */
const CLICK_SLOP = 4;

export function NetworkMap({ network, route, footprints, pick, onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    if (route === null) return new Set<number>();
    return new Set(network.patterns.filter((p) => p.route === route).flatMap((p) => p.path.map((de) => de >> 1)));
  }, [network, route]);

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
    stroke(routeEdges, c.route, 3);

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
      ctx.fillStyle = c.footprint;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.footprint;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (pick) {
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
  }, [view, size, lines, routeEdges, routeStops, footprints, pick]);

  const local = (e: React.PointerEvent | React.WheelEvent): [number, number] => {
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
        aria-label="Map of the sample Dublin bus network. Arrow keys pan, plus and minus zoom; click to place an incident."
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
        onWheel={(e) => zoom(e.deltaY < 0 ? 1.25 : 0.8, local(e))}
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
          };
          const act = actions[e.key];
          if (act) {
            e.preventDefault();
            act();
          }
        }}
      />
      <div className="map-controls">
        <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => setView(fit(network.bounds, size.width, size.height))}>
          Fit
        </button>
      </div>
    </div>
  );
}
