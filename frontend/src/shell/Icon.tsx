import type { IconName } from "./icons";
import { ICON_PATHS } from "./icons";

/** A Material Symbol, sized as the rail uses it. */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}
