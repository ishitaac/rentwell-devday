import { useMemo, useRef, useState } from "react";

import "./roommateAI.css";
import { COMPLIANCE_RULES, complianceDisclosure, evaluateAll, resolveJurisdiction } from "./roommateAI/compliance";
import { DEMO_CANDIDATES, DEMO_ROOMMATE_TOPICS, SCENARIO_TOPIC, TOPIC_SUGGESTIONS, type DemoCandidate } from "./roommateAI/demoData";
import { applyExtractions, confirmField, describeUnresolved, extractFromText, MAX_CLARIFYING_QUESTIONS, nextClarifyingQuestion, removeField, setFieldFromUser } from "./roommateAI/intake";
import { applyJordanTurn, jordanWouldApproveFinal, MAX_HISTORY, personaFor, type ScenarioContext } from "./roommateAI/jordan";
import { requestJordanReply, type ReplySource } from "./roommateAI/jordanClient";
import { CATEGORY_LABEL, rankCandidates, type MatchResult } from "./roommateAI/matching";
import {
  ALL_TOPICS, approveFinal, approveTerm, buildSummary, createSession, editTerm, NegotiationError, openTopics, proposeTerm, rejectTerm,
  respondToInvitation, setTopicOptIn, termStatus, TOPIC_LABELS, withdraw, type NegotiationTopic, type Session, type Term, type TermStatus,
} from "./roommateAI/negotiation";
import { buildScenarios, dayTimeline, SIMULATOR_DISCLAIMER, type Scenario } from "./roommateAI/simulator";
import { FIELD_DEFS, FIELD_KEYS, normalizeValue, type FieldKey, type Priority, type RoommateProfile } from "./roommateAI/types";

type Stage = "context" | "describe" | "clarify" | "confirm" | "results" | "simulator" | "negotiator";
const STEPS: Array<{ label: string; stages: Stage[] }> = [
  { label: "Basics", stages: ["context"] },
  { label: "Your habits", stages: ["describe", "clarify"] },
  { label: "Review", stages: ["confirm"] },
  { label: "Matches", stages: ["results", "simulator", "negotiator"] },
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

type RIconName = "dollar" | "clock" | "home" | "people" | "sparkle" | "document" | "check";
const R_ICON: Record<RIconName, React.ReactNode> = {
  dollar: <><circle cx="12" cy="12" r="9" /><path d="M16 8.5c-.9-1-2-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 4 7 1.5 7 5 0 1.5-1.3 2.5-3.5 2.5-1.8 0-3.2-.6-4-1.8M12 5v14" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  sparkle: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" /></>,
  document: <><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
};
function RIcon({ name, size = 20 }: { name: RIconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {R_ICON[name]}
    </svg>
  );
}

/** Same card look as the rest of the app: icon tile, short title, one-line hint. */
function PrefCard({ icon, title, hint, wide = false, children }: { icon: RIconName; title: string; hint: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`card preference-card${wide ? " wide" : ""}`}>
      <div className="pref-icon"><RIcon name={icon} /></div>
      <div className="pref-head"><h3>{title}</h3><p>{hint}</p></div>
      {children}
    </section>
  );
}

function StepHead({ icon, title, hint }: { icon: RIconName; title: string; hint?: string }) {
  return (
    <div className="rai-stephead">
      <div className="pref-icon"><RIcon name={icon} /></div>
      <div className="pref-head"><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
    </div>
  );
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
      {STEPS.map((s, i) => {
        const active = s.stages.includes(stage);
        return (
          <button key={s.label} type="button" disabled={!s.stages.some((x) => reachable.includes(x))} aria-current={active ? "step" : undefined} className={active ? "active" : ""} onClick={() => go(s.stages[0])}>
            <span>{i + 1}</span>
            {s.label}
          </button>
        );
      })}
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
  const [chatScenario, setChatScenario] = useState<ScenarioContext | undefined>(undefined);

  const candidate = DEMO_CANDIDATES.find((c) => c.profile.profileId === candidateId) ?? DEMO_CANDIDATES[0];
  const compatibility = useMemo(() => {
    const r = rankCandidates(profile, [candidate.profile])[0];
    return [r.score !== null ? `Overlap ${r.score} out of 100 (fictional demo data)` : "Overlap not scored", ...r.strengths.slice(0, 2).map((x) => `Strength: ${x}`), ...r.friction.slice(0, 3).map((x) => `Friction: ${x}`)];
  }, [profile, candidate]);
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
      <div className="page-heading rai-head">
        <p className="eyebrow">Roommate planning</p>
        <h1>Describe how you live</h1>
        <p>Find roommates who fit your routine. Nothing is saved to a server.</p>
        <span className="demo-tag">FICTIONAL ROOMMATES</span>
      </div>
      <Stepper stage={stage} go={setStage} reachable={reachable} />

      {stage === "context" && <ContextStep profile={profile} setProfile={setProfile} next={() => setStage("describe")} back={() => onExit("home")} />}
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
          negotiate={(topics, scenario) => {
            setSuggestedTopics(topics);
            setChatScenario(scenario);
            setStage("negotiator");
          }}
        />
      )}
      {stage === "negotiator" && <NegotiatorDemo candidate={candidate} suggested={suggestedTopics} chat={{ scenario: chatScenario, flagged: suggestedTopics, compatibility }} back={() => setStage("simulator")} />}

      <details className="rai-about">
        <summary>A decision aid, not a screening service</summary>
        <p>{complianceDisclosure()}</p>
      </details>
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
  const setHousing = (key: FieldKey, raw: string) =>
    setProfile((p) => {
      if (raw === "") return removeField(p, key);
      return setFieldFromUser(p, key, FIELD_DEFS[key].kind === "number" ? Number(raw) : raw, p.fields[key]?.priority ?? "preferred");
    });
  const months = nextMonths(3);
  const budget = Number(profile.fields.budgetMax?.value ?? 1250);
  /** Tap to choose, tap again to clear. Importance is set later, on the review step. */
  const chips = (key: FieldKey, label: string, options: Array<[string, string]>) => (
    <div className="chips compact" role="group" aria-label={label}>
      {options.map(([v, l]) => {
        const on = String(profile.fields[key]?.value ?? "") === v;
        return (
          <button key={v} type="button" aria-pressed={on} className={on ? "selected" : ""} onClick={() => setHousing(key, on ? "" : v)}>
            {l}
          </button>
        );
      })}
    </div>
  );
  return (
    <>
      <div className="preferences-grid">
        <PrefCard icon="dollar" title="Monthly budget" hint="Your share, all-in">
          <div className="budget-display">
            Up to <strong>${budget.toLocaleString()}</strong> <span>/ month</span>
          </div>
          <input id="h-budgetMax" aria-label="Monthly budget" className="range" type="range" min="500" max="2500" step="50" value={budget} onChange={(e) => setHousing("budgetMax", e.target.value)} style={{ "--range": `${((budget - 500) / 2000) * 100}%` } as React.CSSProperties} />
          <div className="range-labels"><span>$500</span><span>$2,500+</span></div>
        </PrefCard>
        <PrefCard icon="clock" title="Move-in" hint="When do you need a place?">
          {chips("moveInMonth", "Move-in month", months.map((m) => [m, monthLabel(m)]))}
        </PrefCard>
        <PrefCard icon="home" title="Bedroom" hint="Your own, or shared?">
          {chips("bedroom", "Bedroom", [["private", "Private"], ["shared", "Shared is fine"]])}
        </PrefCard>
        <PrefCard icon="home" title="Bathroom" hint="Your own, or shared?">
          {chips("bathroom", "Bathroom", [["private", "Private"], ["shared", "Shared is fine"]])}
        </PrefCard>
        <PrefCard icon="people" title="Roommates" hint="How many do you want?" wide>
          {chips("roommateCount", "Number of roommates", [["1", "1"], ["2", "2"], ["3", "3"]])}
        </PrefCard>
      </div>
      <details className="rai-more">
        <summary>More options</summary>
        <div className="rai-grid">
          <div className="rai-field"><label htmlFor="loc-state">State</label><input id="loc-state" maxLength={2} value={profile.location.state ?? ""} onChange={(e) => setLoc({ state: e.target.value.toUpperCase() })} /></div>
          <div className="rai-field"><label htmlFor="loc-city">City</label><input id="loc-city" value={profile.location.city ?? ""} onChange={(e) => setLoc({ city: e.target.value })} placeholder="Salt Lake City" /></div>
          <div className="rai-field"><label htmlFor="loc-zip">ZIP code</label><input id="loc-zip" inputMode="numeric" maxLength={5} value={profile.location.zip ?? ""} onChange={(e) => setLoc({ zip: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="rai-field">
            <label htmlFor="has-housing">Your situation</label>
            <select id="has-housing" value={profile.hasHousing ? "yes" : "no"} onChange={(e) => setProfile((p) => ({ ...p, hasHousing: e.target.value === "yes" }))}>
              <option value="no">Searching with future roommates</option>
              <option value="yes">I have housing to share</option>
            </select>
          </div>
          <div className="rai-field"><span className="rai-label">Lease length</span>{chips("leaseMonths", "Lease length", [["6", "6 mo"], ["12", "12 mo"], ["24", "24 mo"]])}</div>
          <div className="rai-field"><span className="rai-label">Furnished</span>{chips("furnished", "Furnished", [["yes", "Yes"], ["no", "No"], ["either", "Either"]])}</div>
          <div className="rai-field"><span className="rai-label">Parking</span>{chips("parking", "Parking", [["yes", "Needed"], ["no", "Not needed"], ["either", "Either"]])}</div>
        </div>
      </details>
      <details className="rai-more">
        <summary>Policy check for {profile.location.state || "your area"}</summary>
        <div className="rai-compliance" role="note">
          <b>Policy check for {profile.location.state || "your area"}{profile.location.city ? `, ${profile.location.city}` : ""}</b>
          <p>Levels considered: {chain.levels.join(" → ")}. Not evaluated: {chain.notEvaluated.join("; ")}.</p>
          <ul>
            {decisions.filter((d) => d.behavior === "filter-by-gender" || d.behavior === "exclude-assistance-animal" || d.behavior === "filter-by-religion").map((d) => (
              <li key={d.behavior}><span className={`rai-status ${d.status.toLowerCase()}`}>{d.status}</span> {d.behavior.replace(/-/g, " ")} — {d.enabled ? "enabled" : "disabled"}</li>
            ))}
          </ul>
          <small>{COMPLIANCE_RULES.length} sensitive behaviors are tracked; none is enabled. No rule has had legal review.</small>
        </div>
      </details>
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back</Btn>
        <Btn onClick={next}>Continue</Btn>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2-3: natural-language intake and one-at-a-time clarification
// ---------------------------------------------------------------------------

function DescribeStep({ text, setText, analyze, back, ignoredNote }: { text: string; setText: (t: string) => void; analyze: () => void; back: () => void; ignoredNote: boolean }) {
  return (
    <section className="rai-panel">
      <StepHead icon="sparkle" title="How do you like to live?" hint="A sentence or two is plenty: schedule, noise, cleaning, guests." />
      <label htmlFor="rai-text" className="rai-sr">Your living preferences</label>
      <textarea id="rai-text" rows={6} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE_TEXT} />
      <div className="rai-row">
        <button type="button" className="text-button" onClick={() => setText(SAMPLE_TEXT)}>Use an example</button>
        <small>{text.length}/1500</small>
      </div>
      {ignoredNote && <p className="rai-warn">Personal characteristics aren't used for matching, so that part was ignored.</p>}
      <p className="rai-note">Read on this device with built-in rules.</p>
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back</Btn>
        <Btn onClick={analyze}>{text.trim() ? "Continue" : "Skip"}</Btn>
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
        <h2>That's enough to start</h2>
        <p className="rai-sub">You can adjust everything next.</p>
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
      <p className="eyebrow">Quick question {asked.length + 1} of {MAX_CLARIFYING_QUESTIONS}</p>
      <h2>{q.question}</h2>
      <div className="chips">
        {q.options.map((o) => <button key={String(o.value)} type="button" onClick={() => answer(o.value)}>{o.label}</button>)}
      </div>
      <div className="rai-inline">
        <label className="rai-sr" htmlFor="rai-free">Or answer in your own words</label>
        <input id="rai-free" value={free} onChange={(e) => setFree(e.target.value)} placeholder="Or type your own answer" maxLength={200} />
        <Btn secondary disabled={!free.trim()} onClick={() => {
          const r = extractFromText(free).accepted.find((a) => a.key === q.key);
          if (r) answer(r.value);
          else {
            const v = normalizeValue(q.key, free.trim().toLowerCase());
            if (v !== null) answer(v);
          }
        }}>Use my answer</Btn>
      </div>
      <p className="rai-note">Skipping is fine. Unknown never counts against a match.</p>
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
      <StepHead icon="document" title="Review your preferences" hint='Only confirmed items are used. Mark dealbreakers as "Required".' />
      {keys.length === 0 && <p className="rai-warn">No preferences yet. Go back and add a few.</p>}
      <div className="rai-table" role="table" aria-label="Your preferences">
        {keys.map((k) => {
          const f = profile.fields[k]!;
          return (
            <div className={`rai-row-card ${f.confirmed ? "ok" : ""}`} role="row" key={k}>
              <div role="cell"><b>{FIELD_DEFS[k].label}</b><small>{f.source === "user-form" ? "You entered" : "From your words"}{f.uncertainty === "high" ? " · uncertain" : ""}</small></div>
              <div role="cell"><ValueEditor k={k} value={f.value} onChange={(v) => setProfile((p) => confirmField(p, k, { value: FIELD_DEFS[k].kind === "number" || FIELD_DEFS[k].kind === "scale" ? Number(v) : v }))} /></div>
              <div role="cell">
                <select aria-label={`${FIELD_DEFS[k].label} importance`} value={f.priority} onChange={(e) => setProfile((p) => confirmField(p, k, { priority: e.target.value as Priority }))}>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((pr) => <option key={pr} value={pr}>{PRIORITY_LABEL[pr]}</option>)}
                </select>
                {f.suggestedRequired && !f.confirmed && <small>Set "Required" if it's a dealbreaker.</small>}
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
        <Btn onClick={() => { setProfile((p) => keys.reduce((acc, k) => (acc.fields[k]?.confirmed ? acc : confirmField(acc, k)), p)); next(); }}>See matches</Btn>
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
      <StepHead icon="people" title="Your matches" hint="Fictional demo profiles. A high score never hides a missed requirement." />
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
      </div>
      <details className="rai-more">
        <summary>More detail</summary>
        <div className="rai-cols"><div><h4>Worth asking</h4>{result.unknowns.length ? <ul>{result.unknowns.slice(0, 3).map((s) => <li key={s}>{s}</li>)}</ul> : <p className="rai-muted">Nothing outstanding.</p>}</div></div>
        <div className="rai-breakdown">{result.breakdown.map((b) => <span key={b.group}>{b.group}: {b.score === null ? "unknown" : `${Math.round(b.score * 100)}%`} <small>({b.knownKeys}/{b.totalKeys} known)</small></span>)}</div>
        <small className="rai-muted">{result.disclaimer}</small>
      </details>
      <div className="rai-actions">
        <Btn disabled={blocked} onClick={() => select(candidate.profile.profileId, "simulator")}>Try a day together</Btn>
        <Btn secondary disabled={blocked} onClick={() => select(candidate.profile.profileId, "negotiator")}>Draft an agreement (demo)</Btn>
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

function SimulatorStep({ profile, candidate, back, negotiate }: { profile: RoommateProfile; candidate: DemoCandidate; back: () => void; negotiate: (topics: NegotiationTopic[], scenario?: ScenarioContext) => void }) {
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
      <p className="rai-sub">Conversation starters from your preferences, not predictions.</p>
      <div className="rai-consent">
        <label>
          <input type="checkbox" checked={useShared} onChange={(e) => { setUseShared(e.target.checked); setSelected(0); }} />
          Use the preferences {name} shared ({candidate.sharedKeys.length} items)
        </label>
        <small>{useShared ? `${name} is fictional, so this is demo data, not real consent.` : "Preview with only your own preferences."}</small>
      </div>
      {scenarios.length === 0 ? (
        <p className="rai-warn">Not enough confirmed preferences yet. Add a few on the review step.</p>
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
              <small className="rai-muted">{SIMULATOR_DISCLAIMER}</small>
            </article>
          )}
        </div>
      )}
      <div className="bottom-actions">
        <Btn secondary onClick={back}>Back to matches</Btn>
        {current && <Btn secondary onClick={() => negotiate(flagged.map((id) => SCENARIO_TOPIC[id]).filter(Boolean), { id: current.id, title: current.title, situation: current.situation, friction: current.friction })}>Talk to {name.split(" ")[0]}</Btn>}
        <Btn onClick={() => negotiate(flagged.map((id) => SCENARIO_TOPIC[id]).filter(Boolean), current ? { id: current.id, title: current.title, situation: current.situation, friction: current.friction } : undefined)}>{flagged.length ? `Negotiate ${flagged.length} marked topic${flagged.length === 1 ? "" : "s"}` : "Continue to roommate agreement"}</Btn>
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

interface ChatContext {
  scenario?: ScenarioContext;
  flagged: NegotiationTopic[];
  compatibility: string[];
}

function NegotiatorDemo({ candidate, suggested, chat, back }: { candidate: DemoCandidate; suggested: NegotiationTopic[]; chat: ChatContext; back: () => void }) {
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
        <b>DEMO — AI-simulated fictional roommate.</b> {first} is not a real person, and any "acceptance" from {first} is simulated. Nothing here is real consent or a binding agreement. Please don't enter personal information.
      </div>
      <h2>Roommate agreement</h2>
      <p className="rai-sub">Household expectations, agreed one at a time. Not a lease or legal contract.</p>
      {error && <p className="rai-warn" role="alert">{error}</p>}

      {!session && (
        <div className="rai-box">
          <label><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I consent to invite {first} and to share only what I approve here.</label>
          <Btn disabled={!consent} onClick={() => { try { { const invited = createSession("demo-session", ME, DEMO, consent); const joined = respondToInvitation(invited, DEMO, true, invited.revision); setSession(setTopicOptIn(joined, DEMO, DEMO_ROOMMATE_TOPICS, joined.revision)); } setError(null); } catch (e) { setError((e as Error).message); } }}>Start Roommate Agreement</Btn>
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
            </div>
            <small>A topic opens when you both opt in. {first} (fictional) opted in automatically for this demo.</small>
          </div>
          <ChatPanel session={session} setSession={setSession} me={ME} demo={DEMO} first={first} chat={chat} />
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
            <p className="rai-demo-banner" role="note"><b>SIMULATED DEMO SUMMARY.</b> {first} is a fictional AI roommate. Their "approval" is simulated, it is not real consent, and this is not a lease or a legally binding agreement.</p>
            <h3>{summary.title}</h3>
            <p><b>Participants:</b> {summary.participants.map((p) => p.name).join(" and ")} · <b>Date:</b> {summary.date}</p>
            <h4>Agreed by both</h4>
            {summary.agreed.length ? <ul>{summary.agreed.map((a) => <li key={a.topic}><b>{a.topic}:</b> {a.text}</li>)}</ul> : <p className="rai-muted">Nothing is agreed by both people yet.</p>}
            <h4>Still unresolved</h4>
            {summary.unresolved.length ? <ul>{summary.unresolved.map((a) => <li key={a.topic + a.text}><b>{a.topic}:</b> {a.text} <em>({a.status.replace(/-/g, " ")})</em></li>)}</ul> : <p className="rai-muted">None.</p>}
            <h4>Confirmation</h4>
            <ul>{summary.participants.map((p) => <li key={p.id}>{p.name}: {summary.confirmation[p.id] === "approved" ? "approved this version ✓" : "has not approved this version"}</li>)}</ul>
            <p className="rai-muted">{summary.disclaimer}</p>
            {session.status === "finalized" && <p className="rai-ok" role="status">Both of you approved this version (simulated: {first} is fictional).</p>}
            {summary.unresolved.length > 0 && session.finalApprovals[ME] && session.status !== "finalized" && <p className="rai-muted">{first} (fictional) would like to settle the unresolved items before approving.</p>}
            <div className="rai-actions">
              <Btn secondary onClick={() => setReview(false)}>Keep editing</Btn>
              <Btn disabled={session.status === "finalized"} onClick={() => run((s) => {
                const mine = approveFinal(s, ME, summary.digest, names, today, s.revision);
                // Simulated: the fictional roommate "approves" only when everything proposed is already agreed by both.
                return jordanWouldApproveFinal(mine, summary.unresolved.length, summary.agreed.length) ? approveFinal(mine, DEMO, summary.digest, names, today, mine.revision) : mine;
              })}>I approve this version</Btn>
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
        </div>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Chat with the fictional AI roommate (Claude via the restricted demo endpoint, else deterministic fallback)
// ---------------------------------------------------------------------------

interface ChatMsg {
  role: "user" | "jordan";
  text: string;
  source?: ReplySource;
  notes?: string[];
  overridden?: boolean;
}

const STARTERS = ["How about quiet hours start at 11:30 PM on weeknights?", "Can we have overnight guests up to 3 nights in a row?", "What if we rotate dishes and bathroom cleaning weekly?"];

function ChatPanel({ session, setSession, me, demo, first, chat }: { session: Session; setSession: (s: Session) => void; me: string; demo: string; first: string; chat: ChatContext }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef(session);
  latest.current = session;
  const persona = personaFor(demo);
  if (!persona) return null;
  const last = [...messages].reverse().find((m) => m.role === "jordan");
  const status = last?.source === "ai" ? "Replies: Claude (live AI)" : last?.source === "scripted-fallback" && code ? "Replies: scripted fallback (live AI unavailable)" : "Replies: scripted (enter the presenter access code for live Claude)";

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    const history = messages.slice(-MAX_HISTORY).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: message }]);
    try {
      const result = await requestJordanReply({ personaId: demo, message, history, openTopics: openTopics(latest.current), scenario: chat.scenario, flaggedTopics: chat.flagged, compatibility: chat.compatibility }, { code: code.trim() || undefined });
      const applied = applyJordanTurn(latest.current, me, demo, result.reply);
      setSession(applied.session);
      setMessages((m) => [...m, { role: "jordan", text: result.reply.message, source: result.source, notes: applied.notes, overridden: result.reply.overridden }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rai-box rai-chat">
      <h3>Chat with {first} (fictional AI roommate)</h3>
      <p className="rai-muted">{first} is an AI character. Propose a house rule in your own words; {first} may agree, disagree or counter.</p>
      <details>
        <summary>About {first} (fictional)</summary>
        <ul>{persona.about.map((a) => <li key={a}>{a}</li>)}</ul>
      </details>
      {chat.scenario && <p className="rai-muted"><b>From the simulator:</b> {chat.scenario.title}. {chat.scenario.friction}</p>}
      <div className="rai-chatlog" role="log" aria-live="polite" aria-label={`Conversation with ${first}`}>
        {messages.length === 0 && <p className="rai-muted">No messages yet. Try one of the starters or write your own.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`rai-msg ${m.role}`}>
            <b>{m.role === "user" ? "You" : first}</b>
            {m.role === "jordan" && <><span className="rai-chip warn">FICTIONAL AI</span><span className="rai-chip">{m.source === "ai" ? "Claude" : "Scripted fallback"}</span></>}
            <p>{m.text}</p>
            {m.overridden && <small className="rai-muted">Reply adjusted by the demo's safety rules to stay within {first}'s boundaries.</small>}
            {m.notes?.map((n) => <small key={n} className="rai-muted">{n}</small>)}
          </div>
        ))}
        {busy && <p className="rai-muted" role="status">{first} is typing…</p>}
      </div>
      <div className="rai-suggest" role="group" aria-label="Conversation starters">
        {STARTERS.map((s) => <button key={s} type="button" onClick={() => setInput(s)}>{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <label htmlFor="rai-chat-input" className="rai-sr">Message to {first}</label>
        <input id="rai-chat-input" value={input} maxLength={400} onChange={(e) => setInput(e.target.value)} placeholder={`Say something to ${first}`} disabled={busy} />
        <div className="rai-actions">
          <button type="submit" className="btn-primary" disabled={busy || !input.trim()}>Send</button>
        </div>
      </form>
      <small className="rai-muted" role="status">{status}</small>
      <div className="rai-field">
        <label htmlFor="rai-demo-code">Presenter access code (optional)</label>
        <input id="rai-demo-code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
        <small>Demo operator only. Kept in memory and sent only to RentWell's server.</small>
      </div>
    </div>
  );
}
