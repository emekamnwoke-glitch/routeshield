import type { ReactNode } from "react";

/** The panel beside a list when nothing is selected: it keeps the layout still and says what goes there. */
export function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="drawer empty-panel" aria-label="Details">
      <p>{children}</p>
    </aside>
  );
}
