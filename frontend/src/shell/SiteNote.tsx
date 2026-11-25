const REPO = "https://github.com/emekamnwoke-glitch/routeshield";
const DOCS = `${REPO}/blob/main/docs`;
const ARCHITECTURE = `${DOCS}/02-stage-two-reference-implementation/solution-design/architecture-v1.2.0.md`;

/**
 * The fiction notice, at the foot of every screen: the network is real, everything else is invented,
 * and no operator's system is connected. It also says where the data is stored.
 */
export function SiteNote({ storage }: { storage: "opfs" | "memory" | null }) {
  return (
    <footer className="site-note">
      <p>
        <b>Fictional reference implementation.</b> The bus network is real (NTA GTFS, OpenStreetMap). Incidents, decisions,
        notices and fleet positions are invented, and no operator's system is connected.{" "}
        <a href={`${DOCS}/02-stage-two-reference-implementation/fact-vs-assumption-model.md`}>Why this matters ↗</a>
      </p>
      <p>
        <a href={ARCHITECTURE}>Architecture</a> · <a href={REPO}>Source on GitHub</a> · Independent portfolio project, not
        affiliated with Dublin Bus or the National Transport Authority.
        {storage &&
          (storage === "opfs"
            ? " Stored in this browser (OPFS): it survives a reload."
            : " Stored in memory: this browser refused OPFS, so a reload starts again.")}
      </p>
    </footer>
  );
}
