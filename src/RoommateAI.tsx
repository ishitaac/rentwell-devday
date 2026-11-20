import { useMemo, useState } from "react";

import "./roommateAI.css";
import { COMPLIANCE_RULES, complianceDisclosure, evaluateAll, resolveJurisdiction } from "./roommateAI/compliance";
import { DEMO_CANDIDATES, DEMO_ROOMMATE_COUNTER, DEMO_ROOMMATE_TOPICS, SCENARIO_TOPIC, TOPIC_SUGGESTIONS, type DemoCandidate } from "./roommateAI/demoData";
import { applyExtractions, confirmField, describeUnresolved, extractFromText, MAX_CLARIFYING_QUESTIONS, nextClarifyingQuestion, removeField, setFieldFromUser } from "./roommateAI/intake";
import { CATEGORY_LABEL, rankCandidates, type MatchResult } from "./roommateAI/matching";
import {
  ALL_TOPICS, approveFinal, approveTerm, buildSummary, createSession, editTerm, NegotiationError, openTopics, proposeTerm, rejectTerm,
  respondToInvitation, setTopicOptIn, termStatus, TOPIC_LABELS, withdraw, type NegotiationTopic, type Session, type Term, type TermStatus,
} from "./roommateAI/negotiation";
import { buildScenarios, dayTimeline, SIMULATOR_DISCLAIMER, type Scenario } from "./roommateAI/simulator";
import { FIELD_DEFS, FIELD_KEYS, normalizeValue, type FieldKey, type Priority, type RoommateProfile } from "./roommateAI/types";

/** Feature flag. Off unless VITE_ROOMMATE_AI=1 at build time. */
export const ROOMMATE_AI_ENABLED = import.meta.env?.VITE_ROOMMATE_AI === "1";

type Stage = "context" | "describe" | "clarify" | "confirm" | "results" | "simulator" | "negotiator";
const STAGES: Array<{ id: Stage; label: string }> = [
  { id: "context", label: "Housing" },
  { id: "describe", label: "Your home life" },
  { id: "clarify", label: "Follow-ups" },
  { id: "confirm", label: "Confirm" },
  { id: "results", label: "Matches" },
  { id: "simulator", label: "Simulator" },
  { id: "negotiator", label: "Agreement" },
];

const SAMPLE_TEXT = "I'm vegetarian, like having friends over, study late, and need my own bedroom. I'm fine sharing a bathroom, but I'd prefer separate cooking utensils.";

const EMPTY: RoommateProfile = { profileId: "me", demo: false, displayName: "You", hasHousing: false, location: { state: "UT" }, fields: {} };

const PRIORITY_LABEL: Record<Priority, string> = { required: "Required", preferred: "Preferred", flexible: "Flexible" };

function nextMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function valueText(key: FieldKey, value: string | number): string {
  if (key === "budgetMax") return `$${Number(value).toLocaleString()}`;
  if (key === "moveInMonth") return monthLabel(String(value));
  if (key === "quietStartHour") return Number(value) === 24 ? "midnight" : `${Number(value) - 12} PM`;
  return String(value);
}

function Btn({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={secondary ? "btn-secondary" : "btn-primary"} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Stepper({ stage, go, reachable }: { stage: Stage; go: (s: Stage) => void; reachable: Stage[] }) {
  return (
    <nav className="rai-steps" aria-label="Find a Roommate progress">
      {STAGES.map((s, i) => (
        <button key={s.id} type="button" disabled={!reachable.includes(s.id)} aria-current={stage === s.id ? "step" : undefined} className={stage === s.id ? "active" : ""} onClick={() => go(s.id)}>
          <span>{i + 1}</span>
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function RoommateAI({ onExit }: { onExit: (to: "preferences" | "matches" | "home") => void }) {
  const [stage, setStage] = useState<Stage>("context");
  const [profile, setProfile] = useState<RoommateProfile>(EMPTY);
  const [text, setText] = useState("");
  const [asked, setAsked] = useState<FieldKey[]>([]);
  const [ignoredNote, setIgnoredNote] = useState(false);
  const [candidateId, setCandidateId] = useState(DEMO_CANDIDATES[0].profile.profileId);
  const [suggestedTopics, setSuggestedTopics] = useState<NegotiationTopic[]>([]);

  const candidate = DEMO_CANDIDATES.find((c) => c.profile.profileId === candidateId) ?? DEMO_CANDIDATES[0];
  const confirmedCount = FIELD_KEYS.filter((k) => profile.fields[k]?.confirmed).length;
  const reachable: Stage[] = useMemo(() => {
    const base: Stage[] = ["context", "describe", "clarify", "confirm"];
    return confirmedCount > 0 ? [...base, "results", "simulator", "negotiator"] : base;
  }, [confirmedCount]);

  const deleteProfile = () => {
    setProfile(EMPTY);
    setText("");
    setAsked([]);
    setStage("context");
  };

  return (
    <main className="app-main rai-main">
      <div className="rai-head">
        <div>
          <p className="eyebrow">Find a Roommate · Beta</p>
          <h1>Describe how you live. Find people you could live with.</h1>
          <p>Housing needs and everyday habits only. Nothing here is saved to a server, and you can delete everything at any time.</p>
        </div>
        <span className="demo-tag">FICTIONAL ROOMMATES</span>
      </div>
      <Stepper stage={stage} go={setStage} reachable={reachable} />

      {stage === "context" && <ContextStep profile={profile} setProfile={setProfile} next={() => setStage("describe")} back={() => onExit("preferences")} />}
      {stage === "describe" && (
        <DescribeStep
          text={text}
          setText={setText}
          ignoredNote={ignoredNote}
          back={() => setStage("context")}
          analyze={() => {
            const result = extractFromText(text);
            setProfile((p) => applyExtractions(p, result.accepted, "user-text"));
            setIgnoredNote(result.sensitiveLanguageIgnored);
            setStage(nextClarifyingQuestion(applyExtractions(profile, result.accepted, "user-text"), asked) ? "clarify" : "confirm");
          }}
        />
      )}
      {stage === "clarify" && <ClarifyStep profile={profile} setProfile={setProfile} asked={asked} setAsked={setAsked} done={() => setStage("confirm")} />}
      {stage === "confirm" && <ConfirmStep profile={profile} setProfile={setProfile} onDelete={deleteProfile} next={() => setStage("results")} back={() => setStage("clarify")} />}
      {stage === "results" && (
        <ResultsStep
          profile={profile}
          select={(id, to) => {
            setCandidateId(id);
            setStage(to);
          }}
          back={() => setStage("confirm")}
        />
      )}
      {stage === "simulator" && (
        <SimulatorStep
          profile={profile}
          candidate={candidate}
          back={() => setStage("results")}
          negotiate={(topics) => {
            setSuggestedTopics(topics);
            setStage("negotiator");
          }}
        />
      )}
      {stage === "negotiator" && <NegotiatorDemo candidate={candidate} suggested={suggestedTopics} back={() => setStage("simulator")} />}

      <div className="prototype-note">
        <span>
          <b>A decision aid, not a screening service.</b> {complianceDisclosure()}
        </span>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Step 1: location & objective housing requirements
// ---------------------------------------------------------------------------

function ContextStep({ profile, setProfile, next, back }: { profile: RoommateProfile; setProfile: (fn: (p: RoommateProfile) => RoommateProfile) => void; next: () => void; back: () => void }) {
  const decisions = evaluateAll({ state: profile.location.state, city: profile.location.city });
  const chain = resolveJurisdiction(profile.location.state, profile.location.city);
  const setLoc = (patch: Partial<RoommateProfile["location"]>) => setProfile((p) => ({ ...p, location: { ...p.location, ...patch } }));
  const setHousing = (key: FieldKey, raw: string, priority?: Priority) =>
    setProfile((p) => {
      if (raw === "") return removeField(p, key);
      const existing = p.fields[key];
      return setFieldFromUser(p, key, FIELD_DEFS[key].kind === "number" ? Number(raw) : raw, priority ?? existing?.priority ?? "preferred");
    });
  const months = nextMonths(8);
  const choice = (key: FieldKey, label: string, options: Array<[string, string]>) => (
    <div className="rai-field">
      <label htmlFor={`h-${key}`}>{label}</label>
      <div className="rai-inline">
        <select id={`h-${key}`} value={String(profile.fields[key]?.value ?? "")} onChange={(e) => setHousing(key, e.target.value)}>
          <option value="">No preference yet</option>
          {options.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select aria-label={`${label} importance`} disabled={!profile.fields[key]} value={profile.fields[key]?.priority ?? "preferred"} onChange={(e) => setHousing(key, String(profile.fields[key]?.value ?? ""), e.target.value as Priority)}>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((pr) => (
            <option key={pr} value={pr}>{PRIORITY_LABEL[pr]}</option>
          ))}
        </select>
      </div>
    </div>
  );
  return (
    <section className="rai-panel">
      <h2>Where and what kind of home?</h2>
      <p className="rai-sub">Location picks which housing rules apply; it is never used to target people by background.</p>
      <div className="rai-grid">
        <div className="rai-field"><label htmlFor="loc-state">State</label><input id="loc-state" maxLength={2} value={profile.location.state ?? ""} onChange={(e) => setLoc({ state: e.target.value.toUpperCase() })} /></div>
        <div className="rai-field"><label htmlFor="loc-city">City</label><input id="loc-city" value={profile.location.city ?? ""} onChange={(e) => setLoc({ city: e.target.value })} placeholder="Salt Lake City" /></div>
        <div className="rai-field"><label htmlFor="loc-zip">ZIP code</label><input id="loc-zip" inputMode="numeric" maxLength={5} value={profile.location.zip ?? ""} onChange={(e) => setLoc({ zip: e.target.value.replace(/\D/g, "") })} /></div>
        <div className="rai-field">
          <label htmlFor="has-housing">Your situation</label>
          <select id="has-housing" value={profile.hasHousing ? "yes" : "no"} onChange={(e) => setProfile((p) => ({ ...p, hasHousing: e.target.value === "yes" }))}>
            <option value="no">I'm searching with future roommates</option>
            <option value="yes">I already have housing with space to share</option>
          </select>
        </div>
        <div className="rai-field">
          <label htmlFor="h-budgetMax">Monthly budget (your share)</label>
          <div className="rai-inline">
            <input id="h-budgetMax" type="number" min={300} max={5000} step={50} value={profile.fields.budgetMax?.value ?? ""} onChange={(e) => setHousing("budgetMax", e.target.value)} />
            <select aria-label="Budget importance" disabled={!profile.fields.budgetMax} value={profile.fields.budgetMax?.priority ?? "preferred"} onChange={(e) => setHousing("budgetMax", String(profile.fields.budgetMax?.value ?? ""), e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((pr) => <option key={pr} value={pr}>{PRIORITY_LABEL[pr]}</option>)}
            </select>
          </div>
        </div>
        {choice("moveInMonth", "Move-in month", months.map((m) => [m, monthLabel(m)]))}
        {choice("leaseMonths", "Lease length", [["6", "6 months"], ["12", "12 months"], ["24", "24 months"]])}
        {choice("bedroom", "Bedroom", [["private", "Private"], ["shared", "Shared is fine"]])}
        {choice("bathroom", "Bathroom", [["private", "Private"], ["shared", "Shared is fine"]])}
        {choice("roommateCount", "Number of roommates", [["1", "1"], ["2", "2"], ["3", "3"]])}
        {choice("furnished", "Furnished", [["yes", "Yes"], ["no", "No"], ["either", "Either"]])}
        {choice("parking", "Parking", [["yes", "Needed"], ["no", "Not needed"], ["either", "Either"]])}
      </div>
      <div className="rai-compliance" role="note">
        <b>Policy check for {profile.location.state || "your area"}{profile.location.city ? `, ${profile.location.city}` : ""}</b>
        <p>Applicable levels considered: {chain.levels.join(" → ")}. Not evaluated: {chain.notEvaluated.join("; ")}.</p>
        <ul>
          {decisions.filter((d) => d.behavior === "filter-by-gender" || d.behavior === "exclude-assistance-animal" || d.behavior === "filter-by-religion").map((d) => (
            <li key={d.behavior}><span className={`rai-status ${d.status.toLowerCase()}`}>{d.status}</span> {d.behavior.replace(/-/g, " ")} — {d.enabled ? "enabled" : "disabled"}</li>
          ))}
        </ul>
        <small>{COMPLIANCE_RULES.length} sensitive behaviors are tracked; none is enabled. No rule has had legal review.</small>
      </div>
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back to preferences</Btn>
        <Btn onClick={next}>Continue</Btn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 2-3: natural-language intake and one-at-a-time clarification
// ---------------------------------------------------------------------------

function DescribeStep({ text, setText, analyze, back, ignoredNote }: { text: string; setText: (t: string) => void; analyze: () => void; back: () => void; ignoredNote: boolean }) {
  return (
    <section className="rai-panel">
      <h2>Describe your ideal living environment</h2>
      <p className="rai-sub">Write it the way you'd tell a friend: schedule, noise, cleaning, cooking, guests, shared costs. We read the practical household details only.</p>
      <label htmlFor="rai-text" className="rai-sr">Your living preferences</label>
      <textarea id="rai-text" rows={6} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_TEXT} />
      <div className="rai-row">
        <button type="button" className="text-button" onClick={() => setText(SAMPLE_TEXT)}>Use an example</button>
        <small>{text.length}/1500</small>
      </div>
      {ignoredNote && <p className="rai-warn">Part of your text mentioned personal characteristics. RentWell doesn't use those for matching, so that part was ignored.</p>}
      <p className="rai-note">Reading your text happens on this device with built-in rules. Claude-assisted reading is prepared on the server but not connected in this build.</p>
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back</Btn>
        <Btn onClick={analyze}>{text.trim() ? "Find my preferences" : "Skip to follow-ups"}</Btn>
      </div>
    </section>
  );
}

function ClarifyStep({ profile, setProfile, asked, setAsked, done }: { profile: RoommateProfile; setProfile: (fn: (p: RoommateProfile) => RoommateProfile) => void; asked: FieldKey[]; setAsked: (a: FieldKey[]) => void; done: () => void }) {
  const [free, setFree] = useState("");
  const q = nextClarifyingQuestion(profile, asked);
  if (!q) {
    return (
      <section className="rai-panel">
        <h2>That's enough to get started</h2>
        <p className="rai-sub">You can adjust everything on the next screen.</p>
        <div className="bottom-actions"><Btn onClick={done}>Review my profile</Btn></div>
      </section>
    );
  }
  const answer = (value: string | number) => {
    setProfile((p) => setFieldFromUser(p, q.key, value, "preferred"));
    setAsked([...asked, q.key]);
    setFree("");
  };
  const skip = () => {
    setAsked([...asked, q.key]);
    setFree("");
  };
  return (
    <section className="rai-panel">
      <p className="eyebrow">Question {asked.length + 1} of up to {MAX_CLARIFYING_QUESTIONS}</p>
      <h2>{q.question}</h2>
      <div className="chips">
        {q.options.map((o) => <button key={String(o.value)} type="button" onClick={() => answer(o.value)}>{o.label}</button>)}
      </div>
      <div className="rai-inline">
        <label className="rai-sr" htmlFor="rai-free">Or answer in your own words</label>
        <input id="rai-free" value={free} onChange={(e) => setFree(e.target.value)} placeholder="Or say it in your own words" maxLength={200} />
        <Btn secondary disabled={!free.trim()} onClick={() => {
          const r = extractFromText(free).accepted.find((a) => a.key === q.key);
          if (r) answer(r.value);
          else {
            const v = normalizeValue(q.key, free.trim().toLowerCase());
            if (v !== null) answer(v);
          }
        }}>Use my answer</Btn>
      </div>
      <p className="rai-note">We'll only use what you answer. Skipping is fine — unknown never counts against a match.</p>
      <div className="bottom-actions">
        <Btn secondary onClick={skip}>Skip this question</Btn>
        <Btn secondary onClick={done}>I'm done</Btn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 4: editable, confirmable profile
// ---------------------------------------------------------------------------

function ValueEditor({ k, value, onChange }: { k: FieldKey; value: string | number; onChange: (v: string) => void }) {
  const def = FIELD_DEFS[k];
  const id = `v-${k}`;
  if (def.kind === "categorical" || def.kind === "ordinal") {
    return <select id={id} aria-label={def.label} value={String(value)} onChange={(e) => onChange(e.target.value)}>{def.values.map((v) => <option key={v} value={v}>{v}</option>)}</select>;
  }
  if (def.kind === "scale") {
    return <select id={id} aria-label={def.label} value={String(value)} onChange={(e) => onChange(e.target.value)}>{Array.from({ length: def.max - def.min + 1 }, (_, i) => def.min + i).map((n) => <option key={n} value={n}>{n}</option>)}</select>;
  }
  if (def.kind === "month") {
    return <select id={id} aria-label={def.label} value={String(value)} onChange={(e) => onChange(e.target.value)}>{[...new Set([String(value), ...nextMonths(10)])].map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>;
  }
  return <input id={id} aria-label={def.label} type="number" min={def.min} max={def.max} value={String(value)} onChange={(e) => onChange(e.target.value)} />;
}

function ConfirmStep({ profile, setProfile, onDelete, next, back }: { profile: RoommateProfile; setProfile: (fn: (p: RoommateProfile) => RoommateProfile) => void; onDelete: () => void; next: () => void; back: () => void }) {
  const keys = FIELD_KEYS.filter((k) => profile.fields[k]);
  const unresolved = describeUnresolved(profile);
  const confirmedKeys = keys.filter((k) => profile.fields[k]?.confirmed);
  const required = confirmedKeys.filter((k) => profile.fields[k]?.priority === "required");
  const flexible = confirmedKeys.filter((k) => profile.fields[k]?.priority === "flexible");
  const summary = confirmedKeys.length === 0 ? "Nothing is confirmed yet." : `You confirmed ${confirmedKeys.length} preference${confirmedKeys.length === 1 ? "" : "s"}: ${required.length} required, ${confirmedKeys.length - required.length - flexible.length} preferred and ${flexible.length} flexible.`;
  return (
    <section className="rai-panel">
      <h2>Confirm your compatibility profile</h2>
      <p className="rai-sub">Only confirmed items are used. Suggested items from your description start as "Preferred", never "Required", until you decide.</p>
      {keys.length === 0 && <p className="rai-warn">No preferences yet. Go back and add a few, or answer a follow-up.</p>}
      <div className="rai-table" role="table" aria-label="Your preferences">
        {keys.map((k) => {
          const f = profile.fields[k]!;
          return (
            <div className={`rai-row-card ${f.confirmed ? "ok" : ""}`} role="row" key={k}>
              <div role="cell"><b>{FIELD_DEFS[k].label}</b><small>{f.source === "user-form" ? "You entered" : "Suggested from your words"}{f.uncertainty === "high" ? " · uncertain" : ""}</small></div>
              <div role="cell"><ValueEditor k={k} value={f.value} onChange={(v) => setProfile((p) => confirmField(p, k, { value: FIELD_DEFS[k].kind === "number" || FIELD_DEFS[k].kind === "scale" ? Number(v) : v }))} /></div>
              <div role="cell">
                <select aria-label={`${FIELD_DEFS[k].label} importance`} value={f.priority} onChange={(e) => setProfile((p) => confirmField(p, k, { priority: e.target.value as Priority }))}>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((pr) => <option key={pr} value={pr}>{PRIORITY_LABEL[pr]}</option>)}
                </select>
                {f.suggestedRequired && !f.confirmed && <small>You mentioned a need — set "Required" if it's a dealbreaker.</small>}
              </div>
              <div role="cell" className="rai-actions">
                {f.confirmed ? <span className="rai-chip ok">Confirmed</span> : <button type="button" className="btn-secondary" onClick={() => setProfile((p) => confirmField(p, k))}>Confirm</button>}
                <button type="button" className="text-button" aria-label={`Remove ${FIELD_DEFS[k].label}`} onClick={() => setProfile((p) => removeField(p, k))}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="rai-summary">
        <h3>Summary</h3>
        <p>{summary}</p>
        <small>Generated from your confirmed fields only.</small>
        {unresolved.length > 0 && (
          <details>
            <summary>{unresolved.length} open item{unresolved.length === 1 ? "" : "s"}</summary>
            <ul>{unresolved.map((u) => <li key={u}>{u}</li>)}</ul>
          </details>
        )}
      </div>
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back</Btn>
        <button type="button" className="text-button" onClick={onDelete}>Delete my profile</button>
        <Btn onClick={() => { setProfile((p) => keys.reduce((acc, k) => (acc.fields[k]?.confirmed ? acc : confirmField(acc, k)), p)); next(); }}>Confirm all & see matches</Btn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Step 5: compatibility results
// ---------------------------------------------------------------------------

function ResultsStep({ profile, select, back }: { profile: RoommateProfile; select: (id: string, to: "simulator" | "negotiator") => void; back: () => void }) {
  const results = useMemo(() => rankCandidates(profile, DEMO_CANDIDATES.map((c) => c.profile)), [profile]);
  return (
    <section className="rai-panel">
      <h2>Your matches</h2>
      <p className="rai-sub">All profiles below are fictional demo data. A required need that doesn't line up is shown plainly and can't be outweighed by a good overall score.</p>
      <div className="rai-matches">
        {results.map((r) => <MatchCard key={r.candidateId} result={r} candidate={DEMO_CANDIDATES.find((c) => c.profile.profileId === r.candidateId)!} select={select} />)}
      </div>
      <div className="bottom-actions"><Btn secondary onClick={back}>Edit my profile</Btn></div>
    </section>
  );
}

function MatchCard({ result, candidate, select }: { result: MatchResult; candidate: DemoCandidate; select: (id: string, to: "simulator" | "negotiator") => void }) {
  const blocked = result.category === "requirement-conflict";
  return (
    <article className={`rai-match ${result.category}`}>
      <header>
        <div className="rai-avatar" aria-hidden="true">{candidate.profile.displayName[0]}</div>
        <div><h3>{candidate.profile.displayName}</h3><small>{candidate.tagline}</small></div>
        <div className="rai-score">
          {result.score !== null ? <><strong>{result.score}</strong><span>overlap</span></> : <span className="rai-chip warn">—</span>}
        </div>
      </header>
      <p className={`rai-category ${result.category}`}>{CATEGORY_LABEL[result.category]}</p>
      {result.score !== null && <div className="rai-meter" role="img" aria-label={`Overlap ${result.score} out of 100`}><i style={{ width: `${result.score}%` }} /></div>}
      {result.hardConflicts.map((c) => <p className="rai-warn" key={c.key}>{c.reason}</p>)}
      <div className="rai-cols">
        <div><h4>Shared strengths</h4>{result.strengths.length ? <ul>{result.strengths.slice(0, 4).map((s) => <li key={s}>{s}</li>)}</ul> : <p className="rai-muted">None confirmed on both sides yet.</p>}</div>
        <div><h4>Potential friction</h4>{result.friction.length ? <ul>{result.friction.slice(0, 4).map((s) => <li key={s}>{s}</li>)}</ul> : <p className="rai-muted">None found in what's shared.</p>}</div>
        <div><h4>Worth asking</h4>{result.unknowns.length ? <ul>{result.unknowns.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ul> : <p className="rai-muted">Nothing outstanding.</p>}</div>
      </div>
      <div className="rai-breakdown">{result.breakdown.map((b) => <span key={b.group}>{b.group}: {b.score === null ? "unknown" : `${Math.round(b.score * 100)}%`} <small>({b.knownKeys}/{b.totalKeys} known)</small></span>)}</div>
      <small className="rai-muted">{result.disclaimer}</small>
      <div className="rai-actions">
        <Btn disabled={blocked} onClick={() => select(candidate.profile.profileId, "simulator")}>See What Living Together Could Look Like</Btn>
        <Btn secondary disabled={blocked} onClick={() => select(candidate.profile.profileId, "negotiator")}>Start Roommate Agreement (demo)</Btn>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Living Together Simulator
// ---------------------------------------------------------------------------

function clock(label: string): number {
  const m = label.match(/(\d+):(\d+) (AM|PM)/);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3] === "PM") h += 12;
  return h + Number(m[2]) / 60;
}

function SimulatorStep({ profile, candidate, back, negotiate }: { profile: RoommateProfile; candidate: DemoCandidate; back: () => void; negotiate: (topics: NegotiationTopic[]) => void }) {
  const [useShared, setUseShared] = useState(true);
  const [selected, setSelected] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const consent = useMemo(() => ({ fromMatch: useShared ? candidate.sharedKeys : [] }), [useShared, candidate]);
  const scenarios: Scenario[] = useMemo(() => buildScenarios(profile, useShared ? candidate.profile : null, consent, 6), [profile, candidate, useShared, consent]);
  const timeline = useMemo(() => dayTimeline(profile, useShared ? candidate.profile : null, consent), [profile, candidate, useShared, consent]);
  const current = scenarios[Math.min(selected, scenarios.length - 1)];
  const name = candidate.profile.displayName;
  return (
    <section className="rai-panel">
      <h2>What living together could look like</h2>
      <p className="rai-sub">Hypothetical situations built from confirmed preferences. They are conversation starters, not predictions.</p>
      <div className="rai-consent">
        <label>
          <input type="checkbox" checked={useShared} onChange={(e) => { setUseShared(e.target.checked); setSelected(0); }} />
          Use the preferences {name} shared ({candidate.sharedKeys.length} items)
        </label>
        <small>{useShared ? `Demo: ${name} is fictional, so these shared items are fixture data, not a real person's consent.` : "Single-user preview: only your own preferences are used; the other person appears as an unknown."}</small>
      </div>
      {scenarios.length === 0 ? (
        <p className="rai-warn">Not enough confirmed preferences to build scenarios yet. Add a few on the profile screen.</p>
      ) : (
        <div className="rai-sim">
          <div className="rai-sim-list" role="tablist" aria-label="Scenarios">
            {scenarios.map((s, i) => (
              <button key={s.id} role="tab" aria-selected={i === selected} className={i === selected ? "active" : ""} onClick={() => setSelected(i)}>
                <b>{s.title}</b>
                <small>{s.category}</small>
                <span className={`rai-chip ${s.mode === "shared" ? "ok" : "warn"}`}>{s.mode === "shared" ? (s.agreement !== null && s.agreement < 0.8 ? "Worth discussing" : "Looks aligned") : "Preview"}</span>
              </button>
            ))}
          </div>
          {current && (
            <article className="rai-sim-detail" role="tabpanel">
              <h3>{current.title}</h3>
              <p className="rai-situation">{current.situation}</p>
              <div className="rai-pills">
                {current.relevantPreferences.map((p) => <span key={`${p.who}-${p.key}`} className={p.who}>{p.who === "you" ? "You" : name.split(" ")[0]} · {p.label}: {valueText(p.key, p.value)}</span>)}
              </div>
              {current.id === "quiet-hours" && timeline && <Timeline rows={timeline} name={name.split(" ")[0]} />}
              <div className="rai-two">
                <div className="rai-friction"><h4>Potential friction</h4><p>{current.friction}</p></div>
                <div className="rai-compromise"><h4>Possible compromise</h4><p>{current.compromise}</p></div>
              </div>
              <h4>What if…?</h4>
              <div className="chips">
                {current.whatIf.map((w, i) => <button key={w.label} type="button" className={picked[current.id] === i ? "selected" : ""} aria-pressed={picked[current.id] === i} onClick={() => setPicked({ ...picked, [current.id]: i })}>{w.label}</button>)}
              </div>
              {picked[current.id] !== undefined && <p className="rai-outcome" role="status">{current.whatIf[picked[current.id]].outcome}</p>}
              <div className="rai-question"><b>Question to talk through:</b> {current.discussionQuestion}</div>
              <div className="rai-actions">
                <Btn secondary onClick={() => setFlagged((f) => (f.includes(current.id) ? f.filter((x) => x !== current.id) : [...f, current.id]))}>{flagged.includes(current.id) ? "Marked to negotiate ✓" : "Mark as worth negotiating"}</Btn>
              </div>
              <small className="rai-muted">{SIMULATOR_DISCLAIMER} Exploring a scenario does not change your saved preferences.</small>
            </article>
          )}
        </div>
      )}
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back to matches</Btn>
        <Btn onClick={() => negotiate(flagged.map((id) => SCENARIO_TOPIC[id]).filter(Boolean))}>{flagged.length ? `Negotiate ${flagged.length} marked topic${flagged.length === 1 ? "" : "s"}` : "Continue to roommate agreement"}</Btn>
      </div>
    </section>
  );
}

function Timeline({ rows, name }: { rows: Array<{ label: string; you: string; match: string }>; name: string }) {
  const start = 5;
  const span = 21;
  const bar = (wake: string, wind: string) => {
    const a = clock(wake);
    let b = clock(wind);
    if (b < a) b += 24;
    return { left: `${((a - start) / span) * 100}%`, width: `${((Math.min(b, start + span) - a) / span) * 100}%` };
  };
  const mk = (who: "you" | "match") => {
    const wake = rows[0][who];
    const wind = rows[1][who];
    return wake === "not shared" ? null : bar(wake, wind);
  };
  const you = mk("you");
  const them = mk("match");
  return (
    <figure className="rai-timeline" aria-label="Illustrative daily rhythm">
      <figcaption>Illustrative daily rhythm (awake window, from the schedules shown)</figcaption>
      <div className="rai-axis"><span>5 AM</span><span>12 PM</span><span>6 PM</span><span>2 AM</span></div>
      <div className="rai-track"><em>You</em>{you && <i className="you" style={you} />}</div>
      <div className="rai-track"><em>{name}</em>{them ? <i className="match" style={them} /> : <small>not shared</small>}</div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Step 7: Negotiator — isolated demo with a scripted FICTIONAL roommate
// ---------------------------------------------------------------------------

const ME = "you";

function NegotiatorDemo({ candidate, suggested, back }: { candidate: DemoCandidate; suggested: NegotiationTopic[]; back: () => void }) {
  const DEMO = candidate.profile.profileId;
  const first = candidate.profile.displayName.split(" ")[0];
  const names = { [ME]: "You", [DEMO]: `${first} (fictional)` };
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [myTopics, setMyTopics] = useState<NegotiationTopic[]>(suggested);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const run = (fn: (s: Session) => Session) => {
    if (!session) return;
    try {
      setSession(fn(session));
      setError(null);
    } catch (e) {
      setError(e instanceof NegotiationError ? e.message : "Something went wrong.");
    }
  };
  const rev = session?.revision ?? 0;

  return (
    <section className="rai-panel">
      <div className="rai-demo-banner" role="note">
        <b>DEMO — scripted fictional roommate.</b> {first} is not a real person. Nothing happens on their side unless you press a button marked "Play {first}". In the real product, invitations, consent and approvals would come from a signed-in second person and be enforced on a server; that backend is not built yet.
      </div>
      <h2>Roommate agreement</h2>
      <p className="rai-sub">Neutral household expectations you both agree to, one term at a time. It is not a lease or a legal contract.</p>
      {error && <p className="rai-warn" role="alert">{error}</p>}

      {!session && (
        <div className="rai-box">
          <label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I consent to invite {first} and to share only what I approve here.</label>
          <Btn disabled={!consent} onClick={() => { try { setSession(createSession("demo-session", ME, DEMO, consent)); setError(null); } catch (e) { setError((e as Error).message); } }}>Start Roommate Agreement</Btn>
        </div>
      )}

      {session?.status === "invited" && (
        <div className="rai-box">
          <p>Invitation sent to {first} (fictional). They must accept before anything is shared.</p>
          <div className="rai-actions">
            <Btn secondary onClick={() => run((s) => respondToInvitation(s, DEMO, true, rev))}>Play {first}: accepts</Btn>
            <Btn secondary onClick={() => run((s) => respondToInvitation(s, DEMO, false, rev))}>Play {first}: declines</Btn>
            <Btn secondary onClick={() => run((s) => withdraw(s, ME))}>Cancel invitation</Btn>
          </div>
        </div>
      )}

      {session && (session.status === "declined" || session.status === "withdrawn") && (
        <div className="rai-box"><p>{session.status === "declined" ? `${first} declined.` : "Participation was withdrawn."} Nothing was shared or saved.</p><Btn secondary onClick={() => { setSession(null); setReview(false); }}>Start over</Btn></div>
      )}

      {session && (session.status === "active" || session.status === "finalized") && !review && (
        <>
          <div className="rai-box">
            <h3>Topics I'm comfortable discussing</h3>
            <div className="chips">
              {ALL_TOPICS.map((t) => <button key={t} type="button" aria-pressed={myTopics.includes(t)} className={myTopics.includes(t) ? "selected" : ""} onClick={() => setMyTopics((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}>{TOPIC_LABELS[t]}</button>)}
            </div>
            <div className="rai-actions">
              <Btn secondary onClick={() => run((s) => setTopicOptIn(s, ME, myTopics, s.revision))}>Save my topics</Btn>
              <Btn secondary onClick={() => run((s) => setTopicOptIn(s, DEMO, DEMO_ROOMMATE_TOPICS, s.revision))}>Play {first}: opts in to 5 topics</Btn>
            </div>
            <small>A topic opens only when you both opt in.</small>
          </div>
          {openTopics(session).length === 0 && <p className="rai-muted">No topics are open yet.</p>}
          <div className="rai-topics">
            {openTopics(session).map((topic) => (
              <TopicCard key={topic} topic={topic} session={session} names={names} me={ME} demo={DEMO} first={first} draft={drafts[topic] ?? ""} setDraft={(v) => setDrafts({ ...drafts, [topic]: v })} run={run} />
            ))}
          </div>
          <ProgressBar session={session} />
          <div className="bottom-actions">
            <Btn secondary onClick={back}>Back to simulator</Btn>
            <Btn secondary onClick={() => run((s) => withdraw(s, ME))}>Leave this discussion</Btn>
            <Btn onClick={() => setReview(true)}>Review Shared Household Expectations</Btn>
          </div>
        </>
      )}

      {session && review && (session.status === "active" || session.status === "finalized") && (() => {
        const summary = buildSummary(session, names, today);
        return (
          <article className="rai-summary-doc">
            <h3>{summary.title}</h3>
            <p><b>Participants:</b> {summary.participants.map((p) => p.name).join(" and ")} · <b>Date:</b> {summary.date}</p>
            <h4>Agreed by both</h4>
            {summary.agreed.length ? <ul>{summary.agreed.map((a) => <li key={a.topic}><b>{a.topic}:</b> {a.text}</li>)}</ul> : <p className="rai-muted">Nothing is agreed by both people yet.</p>}
            <h4>Still unresolved</h4>
            {summary.unresolved.length ? <ul>{summary.unresolved.map((a) => <li key={a.topic + a.text}><b>{a.topic}:</b> {a.text} <em>({a.status.replace(/-/g, " ")})</em></li>)}</ul> : <p className="rai-muted">None.</p>}
            <h4>Confirmation</h4>
            <ul>{summary.participants.map((p) => <li key={p.id}>{p.name}: {summary.confirmation[p.id] === "approved" ? "approved this version ✓" : "has not approved this version"}</li>)}</ul>
            <p className="rai-muted">{summary.disclaimer}</p>
            {session.status === "finalized" && <p className="rai-ok" role="status">Both of you approved this version.</p>}
            <div className="rai-actions">
              <Btn secondary onClick={() => setReview(false)}>Keep editing</Btn>
              <Btn disabled={session.status === "finalized"} onClick={() => run((s) => approveFinal(s, ME, summary.digest, names, today, s.revision))}>I approve this version</Btn>
              <Btn secondary disabled={session.status === "finalized"} onClick={() => run((s) => approveFinal(s, DEMO, summary.digest, names, today, s.revision))}>Play {first}: approves this version</Btn>
            </div>
          </article>
        );
      })()}
    </section>
  );
}

const STATUS_LABEL: Record<TermStatus, string> = {
  proposed: "Proposed", "under-discussion": "Under discussion", "accepted-by-one": "Accepted by one", "accepted-by-both": "Accepted by both", rejected: "Rejected", revised: "Revised",
};

function ProgressBar({ session }: { session: Session }) {
  const total = session.terms.length;
  const done = session.terms.filter((t) => termStatus(t, session.participants) === "accepted-by-both").length;
  return (
    <div className="rai-progress" role="img" aria-label={`${done} of ${total} terms accepted by both`}>
      <i style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
      <span>{done} of {total} terms agreed by both</span>
    </div>
  );
}

function TopicCard({ topic, session, names, me, demo, first, draft, setDraft, run }: { topic: NegotiationTopic; session: Session; names: Record<string, string>; me: string; demo: string; first: string; draft: string; setDraft: (v: string) => void; run: (fn: (s: Session) => Session) => void }) {
  const terms = session.terms.filter((t) => t.topic === topic);
  return (
    <article className="rai-topic">
      <h3>{TOPIC_LABELS[topic]}</h3>
      {terms.map((t) => <TermRow key={t.id} term={t} session={session} names={names} me={me} demo={demo} first={first} run={run} />)}
      <div className="rai-propose">
        <label htmlFor={`d-${topic}`} className="rai-sr">Propose wording for {TOPIC_LABELS[topic]}</label>
        <textarea id={`d-${topic}`} rows={2} maxLength={500} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Describe the habit or rule you'd like to agree on" />
        <div className="rai-suggest" role="group" aria-label="Neutral suggested wording"><small>Neutral suggestions — tap one to use it, then edit if you like:</small>{TOPIC_SUGGESTIONS[topic].map((s) => <button key={s} type="button" onClick={() => setDraft(s)}>{s}</button>)}</div>
        <div className="rai-actions">
          <Btn secondary disabled={!draft.trim()} onClick={() => { run((s) => proposeTerm(s, me, topic, draft, s.revision)); setDraft(""); }}>Propose</Btn>
          {DEMO_ROOMMATE_COUNTER[topic] && <Btn secondary onClick={() => run((s) => proposeTerm(s, demo, topic, DEMO_ROOMMATE_COUNTER[topic] as string, s.revision))}>Play {first}: proposes their wording</Btn>}
        </div>
      </div>
    </article>
  );
}

function TermRow({ term, session, names, me, demo, first, run }: { term: Term; session: Session; names: Record<string, string>; me: string; demo: string; first: string; run: (fn: (s: Session) => Session) => void }) {
  const status = termStatus(term, session.participants);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(term.text);
  const approved = (id: string) => term.approvals[id] === term.version;
  return (
    <div className={`rai-term ${status}`}>
      <p>{term.text}</p>
      <div className="rai-term-meta">
        <span className={`rai-chip st-${status}`}>{STATUS_LABEL[status]}</span>
        <span className={approved(me) ? "rai-ok" : "rai-muted"}>You {approved(me) ? "✓" : "—"}</span>
        <span className={approved(demo) ? "rai-ok" : "rai-muted"}>{names[demo]} {approved(demo) ? "✓" : "—"}</span>
        <small>v{term.version} · proposed by {names[term.proposedBy]}</small>
      </div>
      {editing ? (
        <div>
          <label className="rai-sr" htmlFor={`e-${term.id}`}>Edit wording</label>
          <textarea id={`e-${term.id}`} rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="rai-actions">
            <Btn secondary onClick={() => { run((s) => editTerm(s, me, term.id, text, s.revision)); setEditing(false); }}>Save edit (clears approvals)</Btn>
            <Btn secondary onClick={() => setEditing(false)}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div className="rai-actions">
          <Btn secondary onClick={() => run((s) => approveTerm(s, me, term.id, term.version, s.revision))}>I accept</Btn>
          <Btn secondary onClick={() => run((s) => rejectTerm(s, me, term.id, s.revision))}>I reject</Btn>
          <Btn secondary onClick={() => { setText(term.text); setEditing(true); }}>Edit</Btn>
          <Btn secondary onClick={() => run((s) => approveTerm(s, demo, term.id, term.version, s.revision))}>Play {first}: accepts</Btn>
          <Btn secondary onClick={() => run((s) => rejectTerm(s, demo, term.id, s.revision))}>Play {first}: rejects</Btn>
        </div>
      )}
    </div>
  );
}

