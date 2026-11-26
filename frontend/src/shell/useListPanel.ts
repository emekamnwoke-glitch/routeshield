import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { moveSelection } from "../review/queue";
import { useMedia } from "./useMedia";

/**
 * A list with a detail panel beside it (Figma frames A, D and E).
 *
 * Wider than 1280 px the panel sits beside the list and follows the selection: J and K (or the arrows)
 * move it, Enter moves focus into the panel, and Esc or ✕ closes it until the next selection.
 * At 1280 px and below the panel is a modal sheet that opens only on Enter or a click.
 */
export function useListPanel<T extends { id: string }>(
  shown: T[],
  canOpen: (row: T) => boolean = () => true,
  /** A row to start on, opened (another screen's "Open incident"). */
  initialId: string | null = null,
) {
  const modal = useMedia("(max-width: 1280px)");
  const [selected, setSelected] = useState(() => Math.max(0, shown.findIndex((r) => r.id === initialId)));
  const [openId, setOpenId] = useState<string | null>(initialId);
  const [closed, setClosed] = useState(false);
  const [takeFocus, setTakeFocus] = useState(false);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const list = useRef<HTMLElement>(null);

  // Keep the selection inside the list as rows arrive and leave.
  useEffect(() => {
    if (selected > shown.length - 1) setSelected(Math.max(shown.length - 1, 0));
  }, [shown.length, selected]);

  const current = shown[selected];
  const openRow = shown.find((r) => r.id === openId);
  const panelRow: T | null = modal ? (openRow ?? null) : closed || !current || !canOpen(current) ? null : current;

  // Return focus to the selected row, or to the active filter when the list is now empty.
  const refocus = () =>
    (rowRefs.current[selected] ?? list.current?.querySelector<HTMLElement>(".filter-chip[aria-pressed=true]"))?.focus();

  const select = (i: number) => {
    setSelected(i);
    setClosed(false);
    setTakeFocus(false);
  };

  const open = (i: number) => {
    const row = shown[i];
    if (!row || !canOpen(row)) return;
    setSelected(i);
    setClosed(false);
    setOpenId(row.id);
    setTakeFocus(true);
  };

  const close = () => {
    setOpenId(null);
    setClosed(true);
    setTakeFocus(false);
    refocus();
  };

  // An opened row that leaves the list (a denial closes its incident) closes the modal panel with it.
  useEffect(() => {
    if (modal && openId && !openRow) {
      setOpenId(null);
      refocus();
    }
  }, [modal, openId, openRow]);

  const onKey = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    const next = moveSelection(selected, e.key, shown.length);
    if (next !== selected) {
      e.preventDefault();
      select(next);
      rowRefs.current[next]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(selected);
    }
  };

  /** Props for row i of the table. */
  const rowProps = (i: number) => ({
    ref: (el: HTMLTableRowElement | null) => {
      rowRefs.current[i] = el;
    },
    tabIndex: i === selected ? 0 : -1,
    "aria-selected": i === selected,
    // Wide, a click selects and the panel beside follows; in the modal layout a click opens the sheet.
    onClick: () => (modal ? open(i) : select(i)),
    onFocus: () => {
      if (i !== selected) select(i);
    },
  });

  const resetSelection = () => select(0);

  /** Reopens the panel on the selected row: Enter or a click on it (prototype P3c and the like). */
  const reopen = () => {
    setClosed(false);
    setTakeFocus(true);
  };

  return {
    modal,
    list,
    selected,
    panelRow,
    takeFocus,
    /** Closed with × or Esc: the list takes the whole width until a row is chosen again (prototype P3c). */
    closed: closed && !modal,
    close,
    reopen,
    onKey,
    rowProps,
    resetSelection,
  };
}
