import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { routeCodes } from "../review/queue";
import { trapIndex } from "../shell/failure";
import type { DisruptionView } from "../workspace/service";
import { incidentTitle } from "./incidents";

type Props = {
  d: DisruptionView;
  eyebrow: string;
  subtitle: string;
  /** The line above the table: what is suggested, or what the controller proposes. */
  ask: string;
  /**
   * At 1280 px and below the panel covers the list: a modal side sheet, with focus kept inside.
   * Wider, it sits beside the list and follows the selection.
   */
  modal: boolean;
  /** Move focus into the panel when it opens or changes incident (modal, or opened with Enter). */
  takeFocus: boolean;
  onClose: () => void;
  /** Pauses Esc and the focus trap while a dialog inside the panel is open. */
  dialogOpen?: () => boolean;
  /** The actions at the foot of the panel. */
  footer: ReactNode;
  /** Anything that must live inside the panel's focus scope, such as a confirmation dialog. */
  children?: ReactNode;
};

const metres = (m: number) => (m >= 0 ? `+${m.toLocaleString("en-IE")}` : `−${Math.abs(m).toLocaleString("en-IE")}`);

/**
 * An incident's evidence: what the closure cuts and the bypass suggested for each route pattern (BR-019).
 * It is always opaque (ADR-0021): map colours must not bleed into the figures a person decides on.
 * Esc closes it; the screen returns focus to the row that opened it.
 */
export function IncidentPanel({ d, eyebrow, subtitle, ask, modal, takeFocus, onClose, dialogOpen, footer, children }: Props) {
  const panel = useRef<HTMLElement>(null);
  const items = new Map(d.recommendation?.items.map((i) => [i.patternId, i]));
  const impact = d.impact;

  useEffect(() => {
    if (takeFocus) panel.current?.focus();
  }, [d.id, takeFocus]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && !dialogOpen?.() && !e.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, dialogOpen]);

  // Modal: Tab and Shift+Tab cycle inside the panel.
  const trap = (e: React.KeyboardEvent) => {
    if (!modal || e.key !== "Tab" || dialogOpen?.()) return;
    const focusable = Array.from(
      panel.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea, [tabindex='0']") ?? [],
    );
    const next = trapIndex(focusable.indexOf(document.activeElement as HTMLElement), focusable.length, e.shiftKey);
    if (next >= 0) {
      e.preventDefault();
      focusable[next]?.focus();
    }
  };

  return (
    <aside
      ref={panel}
      id="incident-panel"
      className={modal ? "drawer modal" : "drawer"}
      role={modal ? "dialog" : "region"}
      aria-modal={modal || undefined}
      aria-labelledby="drawer-title"
      tabIndex={-1}
      onKeyDown={trap}
    >
      <header className="drawer-head">
        <div>
          <p>{eyebrow}</p>
          <h2 id="drawer-title">{incidentTitle(d)}</h2>
          <small>{subtitle}</small>
        </div>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>

      <div className="drawer-body">
        {!impact ? (
          <p className="hint">Being assessed…</p>
        ) : (
          <>
            <dl className="stats">
              <div className="lead">
                <dt>Patterns cut</dt>
                <dd>{impact.patterns.length}</dd>
              </div>
              <div>
                <dt>Routes{routeCodes(d).length ? `: ${routeCodes(d).join(" ")}` : ""}</dt>
                <dd>{routeCodes(d).length}</dd>
              </div>
              <div>
                <dt>Trips a day</dt>
                <dd>{impact.affectedTrips.toLocaleString("en-IE")}</dd>
              </div>
              <div>
                <dt>Vehicles approaching</dt>
                <dd>{impact.vehicles.approaching}</dd>
              </div>
              <div>
                <dt>Vehicles inside</dt>
                <dd>{impact.vehicles.inside}</dd>
              </div>
            </dl>

            <p className="ask">{ask}</p>
            {d.recommendation && (
              <p className="hint">
                Recommendation band {d.recommendation.band}: a person decides. Confidence is {d.recommendation.confidence},
                because vehicle positions come from the timetable, not a live feed.
              </p>
            )}

            {impact.patterns.length > 0 && (
              <div className="table-wrap">
                <table className="bypass-table">
                  <thead>
                    <tr>
                      <th scope="col">Route</th>
                      <th scope="col">Pattern</th>
                      <th scope="col">Towards</th>
                      <th scope="col">Stop missed</th>
                      <th scope="col" className="num">
                        Appr.
                      </th>
                      <th scope="col" className="num">
                        Inside
                      </th>
                      <th scope="col">Bypass</th>
                      <th scope="col" className="num">
                        Extra m
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.patterns.map((p) => {
                      const item = items.get(p.patternId);
                      return (
                        <tr key={p.patternId}>
                          <th scope="row">{p.routeCode}</th>
                          <td className="muted">{p.patternId}</td>
                          <td>{p.towards}</td>
                          <td>{item?.stopsLost.join(", ") || p.stopsInside.join(", ") || "None"}</td>
                          <td className="num">{p.approaching}</td>
                          <td className="num">{p.inside}</td>
                          <td>
                            {item?.kind === "reroute"
                              ? `${item.divertStop ?? "?"} → ${item.rejoinStop ?? "?"}`
                              : item?.kind === "contingency"
                                ? "Pre-approved contingency"
                                : "Hold until reopened"}
                          </td>
                          <td className="num">{item?.kind === "reroute" ? metres(item.extraM) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="drawer-actions">{footer}</footer>
      {children}
    </aside>
  );
}
