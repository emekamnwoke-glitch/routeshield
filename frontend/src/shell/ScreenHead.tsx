import type { ReactNode } from "react";

/** A screen's title, with the scenario clock at the right (Figma frames A, D and E). */
export function ScreenHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="screen-head">
      <h1>{title}</h1>
      {children ?? (
        <p className="scenario-time" title="Vehicle positions come from the timetable, not a live feed">
          <b>Scenario time Mon 08:00</b>
          <small>Positions from timetable</small>
        </p>
      )}
    </div>
  );
}
