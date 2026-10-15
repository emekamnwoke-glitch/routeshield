import type { NoticeItem } from "./workspace/service";

const LABEL: Record<NoticeItem["tone"], string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

/** The controller's dashboard: the outcome of each proposal, including a denial and its reason. */
export function Noticeboard({ items }: { items: NoticeItem[] }) {
  return (
    <section className="noticeboard" aria-label="Noticeboard">
      <p>NOTICEBOARD</p>
      <h3>Your proposals</h3>
      {items.length === 0 ? (
        <p className="hint">Nothing yet. Propose a decision on a suggested bypass to see its outcome here.</p>
      ) : (
        <ol>
          {items.map((n) => (
            <li key={n.id} className={`tone-${n.tone}`}>
              <b>{LABEL[n.tone]}</b> {n.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
