/** A message, and at most one action (prototype P4, P7, P10: "Continue as duty manager", "See the controller's view"). */
export type Snack = { text: string; action?: { label: string; run: () => void } };

/**
 * The snackbar at the foot of the list column (prototype P4, P7, P10 and P1r). It stays until the next command or
 * role switch. The text is a live region; the action is a button, reached with Tab.
 */
export function Snackbar({ snack }: { snack: Snack | null }) {
  return (
    <div className={snack ? "status shown" : "status"} role="status" aria-live="polite">
      {snack && (
        <>
          <p>{snack.text}</p>
          {snack.action && (
            <button type="button" className="text" onClick={snack.action.run}>
              {snack.action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
