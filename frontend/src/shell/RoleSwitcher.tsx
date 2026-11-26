import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { PersonaId } from "../../../src/core/modules/ac-14-access-control/contract";
import { Icon } from "./Icon";
import { AUTHORITY, ROLE_ORDER, moveFocus, roleName } from "./roles";

type Props = {
  persona: PersonaId;
  busy: boolean;
  onSwitch: (persona: PersonaId) => void;
  onReset: () => void;
};

const CONFIRM = {
  title: "Start again?",
  body: "This deletes every incident, proposal, decision and audit event stored in this browser. The Dublin network data is not affected.",
  action: "Start again",
} as const;

/**
 * The persona being simulated, at the foot of the navigation rail. It opens the role menu:
 * switch persona, or start the demo again. Nobody is signed in (ADR-0012); the core checks
 * every action (AC-14), so this control only chooses who the page acts as.
 *
 * The menu is opaque: it is not one of the three glass surfaces in ADR-0021.
 */
export function RoleSwitcher({ persona, busy, onSwitch, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? []);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  // On opening, focus the persona already chosen, as a radio group would.
  useEffect(() => {
    if (!open) return;
    const all = items();
    (all.find((el) => el.getAttribute("aria-checked") === "true") ?? all[0])?.focus();
  }, [open]);

  // A click anywhere outside the menu or its trigger closes it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      close(false);
      return;
    }
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = moveFocus(at, e.key, all.length);
    if (next !== at && next >= 0) {
      e.preventDefault();
      all[next]?.focus();
    }
  };

  const choose = (id: PersonaId) => {
    close(true);
    if (id !== persona) onSwitch(id);
  };

  const ask = () => {
    close(false);
    dialog.current?.showModal();
  };

  return (
    <div className="role-switcher">
      <button
        ref={trigger}
        type="button"
        className="role-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="role-menu"
        aria-label={`${roleName(persona)}, simulated. Switch role`}
        title="Switch role. Simulated: nobody is signed in (ADR-0012)."
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="avatar" aria-hidden="true">
          <Icon name="person" />
          <span className="caret">
            <Icon name="caret" size={18} />
          </span>
        </span>
        <span className="role-name">{roleName(persona)}</span>
        <span className="simulated">Simulated</span>
      </button>

      {open && (
        <div ref={menu} id="role-menu" className="role-menu" role="menu" aria-label="Switch role" onKeyDown={onMenuKey}>
          <div className="role-menu-head">
            <b>Switch role</b>
            <small>Simulated: nobody is signed in. The core checks every action.</small>
          </div>
          {ROLE_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === persona}
              tabIndex={-1}
              className="role-item"
              onClick={() => choose(id)}
            >
              <span className="check" aria-hidden="true">
                {id === persona && <Icon name="check" size={20} />}
              </span>
              <span>
                <b>{roleName(id)}</b>
                <small>{AUTHORITY[id]}</small>
              </span>
            </button>
          ))}
          <button type="button" role="menuitem" tabIndex={-1} className="role-item reset" disabled={busy} onClick={ask}>
            <span className="check" aria-hidden="true" />
            <span>
              <b>Start again (reset demo)</b>
              <small>Deletes everything stored in this browser. Asks first.</small>
            </span>
          </button>
        </div>
      )}

      {/* Confirmation: a modal dialog, so Esc cancels. Focus returns to the switcher, since the menu item that opened it is gone. */}
      <dialog
        ref={dialog}
        className="confirm"
        aria-labelledby="reset-title"
        aria-describedby="reset-body"
        onClose={() => trigger.current?.focus()}
      >
        <form method="dialog">
          <h2 id="reset-title">{CONFIRM.title}</h2>
          <p id="reset-body">{CONFIRM.body}</p>
          <div className="confirm-actions">
            <button type="submit" value="cancel" className="text" autoFocus>
              Cancel
            </button>
            <button
              type="submit"
              value="reset"
              className="text danger"
              onClick={onReset}
            >
              {CONFIRM.action}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
