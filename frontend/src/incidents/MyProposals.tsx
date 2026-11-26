import type { Chip, ProposalLine } from "./incidents";
import { Icon } from "../shell/Icon";

/** A status chip: tone, icon and label; the label always carries the meaning. */
export function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span className={`chip tone-${chip.tone}`}>
      <Icon name={chip.icon} size={14} />
      {chip.label}
    </span>
  );
}

type Props = {
  lines: ProposalLine[];
  /** A denial's "Report again": reopens the report sheet at the declined incident. */
  onReportAgain: (at: { lat: number; lon: number }) => void;
};

/**
 * The controller's proposals (prototype P4, P9 and P11): each one with the duty manager's decision and,
 * for a denial, the reason and a way to report the incident again.
 */
export function MyProposals({ lines, onReportAgain }: Props) {
  return (
    <section className="noticeboard" aria-labelledby="my-proposals-title">
      <h2 id="my-proposals-title">My proposals</h2>
      {lines.length === 0 ? (
        <p className="hint">
          Nothing yet. Each proposal you make appears here with the duty manager's decision and, for a denial, the
          reason.
        </p>
      ) : (
        <ol>
          {lines.map((l) => (
            <li key={l.id}>
              <p className="line">
                <StatusChip chip={l.chip} />
                <span>{l.text}</span>
              </p>
              {l.reason && (
                <>
                  <p className="reason">{l.reason}</p>
                  <button
                    type="button"
                    className="text"
                    onClick={() => onReportAgain({ lat: l.disruption.footprint.lat, lon: l.disruption.footprint.lon })}
                  >
                    Report again
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
