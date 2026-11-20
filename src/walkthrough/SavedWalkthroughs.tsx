import type { SavedWalkthrough } from "./lib/profile";
import "./walkthrough.css";

interface SavedWalkthroughsProps {
  items: SavedWalkthrough[];
  justSaved: boolean;
  onOpenWalkthrough: () => void;
}

/** My Plan card: walkthroughs saved to the renter's profile (findings and questions, no photos). */
export function SavedWalkthroughs({ items, justSaved, onOpenWalkthrough }: SavedWalkthroughsProps) {
  if (items.length === 0) return null;
  const [latest, ...older] = items;
  const counts = latest.counts;
  return (
    <section className="wt-saved" aria-labelledby="wt-saved-title">
      {justSaved && (
        <p className="wt-saved-toast" role="status">
          ✓ Walkthrough saved to your profile.
        </p>
      )}
      <div className="wt-saved-head">
        <div>
          <p className="wt-eyebrow">
            Walkthrough · saved {new Date(latest.savedAt).toLocaleString()}
          </p>
          <h2 id="wt-saved-title">
            {latest.statusLabel}
            {latest.rentalName ? ` · ${latest.rentalName}` : ""}
          </h2>
          <p className="wt-muted">
            {latest.unitTypeLabel} · {latest.coverageText}
            {latest.isSample ? " · Sample" : ""}
          </p>
        </div>
        <button className="wt-btn" onClick={onOpenWalkthrough}>
          Open Walkthrough
        </button>
      </div>
      <ul className="wt-chips" aria-label="Counts">
        {counts.stopAndVerify > 0 && (
          <li className="wt-chip is-stop">■ {counts.stopAndVerify} Stop and verify</li>
        )}
        {counts.priority > 0 && (
          <li className="wt-chip is-priority">▲ {counts.priority} Priority</li>
        )}
        {counts.followUp > 0 && (
          <li className="wt-chip is-follow">● {counts.followUp} Follow up</li>
        )}
        {counts.youNoticed > 0 && (
          <li className="wt-chip is-you">✋ {counts.youNoticed} you noticed</li>
        )}
        <li className="wt-chip is-none">○ {counts.notChecked} not checked</li>
      </ul>
      <div className="wt-saved-cols">
        {latest.findings.length > 0 && (
          <div>
            <h3>Flagged</h3>
            <ul className="wt-compact">
              {latest.findings.map((f, i) => (
                <li key={i}>
                  <strong>{f.headline}</strong> · {f.severity} · {f.where}
                </li>
              ))}
            </ul>
          </div>
        )}
        {latest.mustHaves.length > 0 && (
          <div>
            <h3>Your must-haves</h3>
            <ul className="wt-compact">
              {latest.mustHaves.map((m) => (
                <li key={m.label}>
                  {m.label}: <strong>{m.answer}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3>Ask the landlord ({latest.questions.length})</h3>
          <ul className="wt-compact">
            {latest.questions.slice(0, 4).map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="wt-micro">
        Possible observations from photos, not an inspection. Photos are not stored in your
        profile; use Download ZIP in Walkthrough to keep them.
        {older.length > 0
          ? ` ${older.length} earlier walkthrough${older.length > 1 ? "s" : ""} also saved.`
          : ""}
      </p>
    </section>
  );
}
