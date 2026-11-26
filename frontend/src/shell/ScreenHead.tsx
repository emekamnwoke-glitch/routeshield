import type { ReactNode } from "react";
import { SCENARIO_TIME } from "../incidents/incidents";

/** A screen's title, with the scenario clock at the right (Figma frames A, D and E). */
export function ScreenHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="screen-head">
      <h1>{title}</h1>
      {children ?? (
        <p className="scenario-time" title="Vehicle positions come from the timetable, not a live feed">
          <b>
            Scenario time {SCENARIO_TIME.day} {SCENARIO_TIME.time}
          </b>
          <small>Positions from timetable</small>
        </p>
      )}
    </div>
  );
}
