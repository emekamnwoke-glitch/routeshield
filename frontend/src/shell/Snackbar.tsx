import { useEffect, useRef } from "react";

/** A message, and at most one action (prototype P4, P7, P10: "Continue as duty manager", "See the controller's view"). */
export type Snack = { text: string; action?: { label: string; run: () => void } };

/**
 * The snackbar at the foot of the list column (prototype P4, P7, P10 and P1r). It stays until the next command or
 * role switch. The text is a live region. An action is the next step of the story, so focus moves to it when it
 * appears: otherwise it would be the last stop on the page (Jane's review, 26 Nov 2026).
 */
export function Snackbar({ snack }: { snack: Snack | null }) {
  const action = useRef<HTMLButtonElement>(null);
  const label = snack?.action?.label;

  useEffect(() => {
    if (label) action.current?.focus();
  }, [snack, label]);

  return (
    <div className={snack ? "status shown" : "status"} role="status" aria-live="polite">
      {snack && (
        <>
          <p>{snack.text}</p>
          {snack.action && (
            <button ref={action} type="button" className="text" onClick={snack.action.run}>
              {snack.action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
