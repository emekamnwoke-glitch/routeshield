import type { ReactNode } from "react";

type Props = {
  /** "NO INCIDENT SELECTED". */
  eyebrow: string;
  /** "Nothing to propose yet". */
  title: string;
  /** What goes here, and how to get it. */
  children: ReactNode;
};

/** The panel beside a list when nothing is selected (prototype P1 and P11): it keeps the layout still and says what goes there. */
export function EmptyPanel({ eyebrow, title, children }: Props) {
  return (
    <aside className="drawer empty-panel" aria-label="Details">
      <header className="drawer-head">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          <small>{children}</small>
        </div>
      </header>
    </aside>
  );
}
