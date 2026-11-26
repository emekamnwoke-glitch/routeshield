import { useEffect, useRef } from "react";
import { coord } from "./NetworkMap";

export const RADII = [100, 150, 300, 500];

type Props = {
  pick: { lat: number; lon: number };
  /** The street the point is on (prototype P2: "53.34980, −6.26030 · O'Connell St Upper"). */
  place: string | null;
  radiusM: number;
  description: string;
  busy: boolean;
  disabled: boolean;
  onRadius: (m: number) => void;
  onDescription: (text: string) => void;
  onCancel: () => void;
  onReport: () => void;
};

/**
 * Report an incident: opens beside the map when a point is picked. It is opaque (ADR-0021): reporting starts
 * the decision flow, so it is not glass. Clicking the map again moves the point; Esc or Cancel closes the sheet.
 */
export function ReportSheet({ pick, place, radiusM, description, busy, disabled, onRadius, onDescription, onCancel, onReport }: Props) {
  const sheet = useRef<HTMLFormElement>(null);

  useEffect(() => {
    sheet.current?.querySelector<HTMLElement>("select")?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <form
      ref={sheet}
      className="sheet"
      role="dialog"
      aria-modal="false"
      aria-labelledby="report-title"
      onSubmit={(e) => {
        e.preventDefault();
        onReport();
      }}
    >
      <div className="sheet-body">
        <h2 id="report-title">Report an incident</h2>
        <p className="hint">Click the map, or press Enter on it, to move the closure. It starts on O'Connell Street.</p>
        <div className="field readonly-field">
          <span>Location</span>
          <output aria-live="polite">
            {coord(pick.lat)}, {coord(pick.lon)}
            {place ? ` · ${place}` : ""}
          </output>
        </div>
        <label className="field">
          <span>Radius</span>
          <select value={radiusM} onChange={(e) => onRadius(Number(e.target.value))}>
            {RADII.map((r) => (
              <option key={r} value={r}>
                {r} m
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(e) => onDescription(e.target.value)} maxLength={120} />
        </label>
      </div>
      <div className="sheet-actions">
        <button type="button" className="text" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={busy || disabled}>
          Report incident
        </button>
      </div>
    </form>
  );
}
