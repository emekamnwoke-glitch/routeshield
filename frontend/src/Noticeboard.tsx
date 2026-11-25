import type { NoticeItem } from "./workspace/service";

const LABEL: Record<NoticeItem["tone"], string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

type Props = {
  items: NoticeItem[];
  /** When the list is cut short: opens the full list on the Proposals screen. */
  more?: (() => void) | undefined;
};

/** The controller's noticeboard: the outcome of each proposal, including a denial and its reason. */
export function Noticeboard({ items, more }: Props) {
  return (
    <section className="noticeboard" aria-labelledby="noticeboard-title">
      <h2 id="noticeboard-title">My proposals</h2>
      {items.length === 0 ? (
        <p className="hint">
          Nothing yet. Each proposal you make appears here with the duty manager's decision and, for a denial, the reason.
        </p>
      ) : (
        <ol>
          {items.map((n) => (
            <li key={n.id} className={`tone-${n.tone}`}>
              <b>{LABEL[n.tone]}</b> {n.text}
            </li>
          ))}
        </ol>
      )}
      {more && (
        <button type="button" className="text" onClick={more}>
          All proposals
        </button>
      )}
    </section>
  );
}
