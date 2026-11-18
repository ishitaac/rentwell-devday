import { useState } from "react";

export type AdvisorScreen = "advisor" | "lease" | "truecost" | "decision";

type AdvisorIconName =
  | "alert"
  | "arrow"
  | "check"
  | "document"
  | "info"
  | "lock"
  | "message"
  | "sparkle"
  | "upload";

const iconPaths: Record<AdvisorIconName, React.ReactNode> = {
  alert: (
    <>
      <path d="M12 9v4m0 4h.01" />
      <path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  document: (
    <>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5M9 12h6M9 16h6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  message: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" />
      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-4 4 4-4 4 4" />
      <path d="M4 15v5h16v-5" />
    </>
  ),
};

function AdvisorIcon({ name, size = 20 }: { name: AdvisorIconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function AdvisorButton({
  children,
  onClick,
  secondary = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`${secondary ? "advisor-button secondary" : "advisor-button"} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const advisorScreens: AdvisorScreen[] = ["advisor", "lease", "truecost", "decision"];
const advisorLabels = ["Ask", "Lease", "Costs", "Decision"];

function AdvisorProgress({
  current,
  go,
}: {
  current: AdvisorScreen;
  go: (screen: AdvisorScreen) => void;
}) {
  const active = advisorScreens.indexOf(current);
  return (
    <div className="advisor-progress">
      <div className="premium-lockup">
        <span>
          <AdvisorIcon name="sparkle" size={15} />
        </span>
        <b>RentWell Advisor</b>
        <em>PREMIUM PREVIEW</em>
      </div>
      <div className="advisor-steps">
        {advisorScreens.map((screen, index) => (
          <button
            key={screen}
            className={index <= active ? "active" : ""}
            onClick={() => index <= active && go(screen)}
          >
            <span>{index < active ? <AdvisorIcon name="check" size={12} /> : index + 1}</span>
            {advisorLabels[index]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdvisorNotice() {
  return (
    <div className="advisor-notice">
      <AdvisorIcon name="info" size={16} />
      <p>
        <b>Simulated AI guidance.</b> Informational assistance only—not legal advice, lease
        verification, or external document processing.
      </p>
    </div>
  );
}

function MobilePanelTabs({
  panel,
  setPanel,
}: {
  panel: "document" | "assistant";
  setPanel: (panel: "document" | "assistant") => void;
}) {
  return (
    <div className="advisor-mobile-tabs">
      <button className={panel === "document" ? "active" : ""} onClick={() => setPanel("document")}>
        <AdvisorIcon name="document" size={16} /> Document
      </button>
      <button
        className={panel === "assistant" ? "active" : ""}
        onClick={() => setPanel("assistant")}
      >
        <AdvisorIcon name="sparkle" size={16} /> Assistant
      </button>
    </div>
  );
}

function LeasePaper({ focus = "" }: { focus?: string }) {
  return (
    <div className="lease-paper">
      <div className="lease-paper-heading">
        <span className="lease-seal">RW</span>
        <div>
          <small>FICTIONAL SAMPLE DOCUMENT</small>
          <h2>Residential Lease Agreement</h2>
          <p>Wasatch View Apartments · Salt Lake City, Utah</p>
        </div>
      </div>
      <div className="lease-parties">
        <span>
          LANDLORD
          <b>Wasatch View Properties, LLC</b>
        </span>
        <span>
          TENANT
          <b>Sample Renter</b>
        </span>
        <span>
          PREMISES
          <b>742 E 3rd Ave, Unit 4B</b>
        </span>
      </div>
      <div className={`lease-clause ${focus === "2.1" ? "focused" : ""}`}>
        <b>§ 2.1 TERM & RENT</b>
        <p>
          The lease begins August 15, 2025 and ends August 14, 2026. Tenant shall pay monthly rent
          of <mark>$2,100.00</mark>, due on the first day of each month.
        </p>
      </div>
      <div className={`lease-clause ${focus === "3.2" ? "focused" : ""}`}>
        <b>§ 3.2 SECURITY DEPOSIT</b>
        <p>
          Tenant shall pay a <mark>$1,000.00 refundable security deposit</mark>, subject to lawful
          deductions for damage beyond ordinary wear.
        </p>
      </div>
      <div className={`lease-clause ${focus === "4.1" ? "focused" : ""}`}>
        <b>§ 4.1 FEES & UTILITIES</b>
        <p>
          Monthly charges include water/sewer $65, parking $75, utility administration $35, and
          required renter’s insurance estimated at $25. A <mark>$250 nonrefundable admin fee</mark>{" "}
          is due at signing.
        </p>
      </div>
      <div className={`lease-clause ${focus === "6.3" ? "focused" : ""}`}>
        <b>§ 6.3 LATE PAYMENT</b>
        <p>
          Rent received after the fifth calendar day is subject to a $75 late fee plus $10 per day,
          not to exceed applicable law.
        </p>
      </div>
      <div className={`lease-clause ${focus === "9.2" ? "focused" : ""}`}>
        <b>§ 9.2 EARLY TERMINATION</b>
        <p>
          Tenant may request early termination with 60 days’ written notice and a fee equal to two
          months’ base rent. Approval is not guaranteed.
        </p>
      </div>
      <div className={`lease-clause ${focus === "12.4" ? "focused" : ""}`}>
        <b>§ 12.4 OCCUPANTS, ROOMMATES & SUBLETTING</b>
        <p>
          Additional occupants, replacement roommates, assignments, and subleases require the
          landlord’s <mark>prior written approval</mark>. No approval standard is stated.
        </p>
      </div>
      <div className="lease-signatures">
        <span>Landlord signature</span>
        <span>Tenant signature</span>
      </div>
    </div>
  );
}

const suggestedQuestions = [
  "Are there hidden fees in this lease?",
  "Can I have roommates?",
  "What HOA rules should I know?",
  "What will this apartment actually cost me?",
];

const simulatedAnswers: Record<string, string> = {
  "Are there hidden fees in this lease?":
    "The sample lease explicitly lists $200 in estimated monthly charges and a $250 nonrefundable admin fee. It does not state application, renewal, or move-out cleaning fees, so those need clarification.",
  "Can I have roommates?":
    "Yes, but §12.4 says additional occupants and replacement roommates need prior written landlord approval. The approval criteria are not stated.",
  "What HOA rules should I know?":
    "I can’t confirm any HOA rules because no HOA addendum is included in this sample. Ask whether an HOA governs the unit and request its rules before signing.",
  "What will this apartment actually cost me?":
    "Based only on stated sample terms: $3,550 at move-in, including a $1,000 refundable deposit, then about $2,300 per month before variable usage costs.",
};

export function AdvisorHome({ go }: { go: (screen: AdvisorScreen) => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploaded, setUploaded] = useState(false);

  const ask = (text: string) => {
    if (!text.trim()) return;
    setQuestion(text);
    setAnswer(
      simulatedAnswers[text] ??
        "I can help explain that, but I would need an explicit clause in the sample document to answer with confidence. I’ll label anything unsupported as needing clarification.",
    );
  };

  return (
    <main className="advisor-main advisor-landing">
      <AdvisorProgress current="advisor" go={go} />
      <section className="advisor-hero">
        <div>
          <span className="advisor-kicker">
            <AdvisorIcon name="sparkle" size={15} /> PREMIUM AI RENTAL ADVISOR
          </span>
          <h1>
            Understand the lease.
            <br />
            See the real cost.
            <br />
            <i>Decide with confidence.</i>
          </h1>
          <p>
            Clear, evidence-backed explanations for complicated rental decisions—grounded only in
            the document you provide.
          </p>
        </div>
        <div className="advisor-trust">
          <span>
            <AdvisorIcon name="document" />
            <b>Clause-level citations</b>
          </span>
          <span>
            <AdvisorIcon name="alert" />
            <b>Ambiguity called out</b>
          </span>
          <span>
            <AdvisorIcon name="lock" />
            <b>Simulated processing</b>
          </span>
        </div>
      </section>

      <div className="advisor-start-grid">
        <section className="advisor-chat-card">
          <div className="assistant-message">
            <span className="assistant-avatar">
              <AdvisorIcon name="sparkle" size={19} />
            </span>
            <div>
              <small>RENTWELL ADVISOR · SIMULATED AI</small>
              <p>
                Hi! I&apos;m your RentWell rental advisor. What would you like help understanding?
              </p>
            </div>
          </div>
          {answer && (
            <>
              <div className="user-message">{question}</div>
              <div className="assistant-message compact-message">
                <span className="assistant-avatar">
                  <AdvisorIcon name="sparkle" size={16} />
                </span>
                <div>
                  <small>BASED ON SAMPLE LEASE</small>
                  <p>{answer}</p>
                </div>
              </div>
            </>
          )}
          <div className="suggested-questions">
            <small>SUGGESTED QUESTIONS</small>
            <div>
              {suggestedQuestions.map((item) => (
                <button key={item} onClick={() => ask(item)}>
                  {item}
                  <AdvisorIcon name="arrow" size={14} />
                </button>
              ))}
            </div>
          </div>
          <form
            className="advisor-composer"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              aria-label="Ask the rental advisor"
              placeholder="Ask about rent, fees, rules, or roommates..."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="submit" aria-label="Send question">
              <AdvisorIcon name="arrow" size={18} />
            </button>
          </form>
        </section>

        <aside className="upload-card">
          <div className="upload-heading">
            <span>
              <AdvisorIcon name="document" />
            </span>
            <div>
              <h2>Analyze a rental document</h2>
              <p>Lease, addendum, or rules document</p>
            </div>
          </div>
          <label className={`upload-dropzone ${uploaded ? "uploaded" : ""}`}>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(event) => setUploaded(Boolean(event.target.files?.length))}
            />
            <span>
              <AdvisorIcon name={uploaded ? "check" : "upload"} size={25} />
            </span>
            <b>{uploaded ? "Document ready for demo" : "Drop a document here"}</b>
            <p>
              {uploaded
                ? "No file was transmitted or processed."
                : "or click to choose a PDF or DOC"}
            </p>
            <small>PROTOTYPE · NO EXTERNAL UPLOAD OCCURS</small>
          </label>
          <div className="sample-divider">
            <span>TRY THE GUIDED EXPERIENCE</span>
          </div>
          <button className="sample-lease-button" onClick={() => go("lease")}>
            <span>
              <AdvisorIcon name="document" />
            </span>
            <div>
              <b>Open fictional sample lease</b>
              <small>12-month apartment lease · 7 findings</small>
            </div>
            <AdvisorIcon name="arrow" size={17} />
          </button>
          <AdvisorNotice />
        </aside>
      </div>
    </main>
  );
}

type Finding = {
  label: string;
  value: string;
  citation: string;
  status?: "stated" | "ambiguous";
  detail: string;
};

const findings: Finding[] = [
  {
    label: "Base rent",
    value: "$2,100 / month",
    citation: "§ 2.1",
    status: "stated",
    detail: "Due on the first of each month.",
  },
  {
    label: "Security deposit",
    value: "$1,000 refundable",
    citation: "§ 3.2",
    status: "stated",
    detail: "Subject to lawful damage deductions.",
  },
  {
    label: "Recurring fees",
    value: "$200 estimated",
    citation: "§ 4.1",
    status: "stated",
    detail: "Water, parking, admin, and insurance.",
  },
  {
    label: "Late fees",
    value: "$75 + $10 / day",
    citation: "§ 6.3",
    status: "stated",
    detail: "Applies after the fifth calendar day.",
  },
  {
    label: "Lease duration",
    value: "12 months",
    citation: "§ 2.1",
    status: "stated",
    detail: "Aug 15, 2025 through Aug 14, 2026.",
  },
  {
    label: "Early termination",
    value: "60 days + $4,200",
    citation: "§ 9.2",
    status: "stated",
    detail: "Request only; approval is not guaranteed.",
  },
  {
    label: "Roommates / subletting",
    value: "Written approval required",
    citation: "§ 12.4",
    status: "ambiguous",
    detail: "Approval criteria are not defined.",
  },
];

function FindingCard({
  finding,
  onCitation,
}: {
  finding: Finding;
  onCitation: (citation: string) => void;
}) {
  return (
    <article className="finding-card">
      <div className="finding-status">
        <span className={finding.status === "ambiguous" ? "ambiguous" : ""}>
          <AdvisorIcon name={finding.status === "ambiguous" ? "alert" : "check"} size={12} />
          {finding.status === "ambiguous" ? "NEEDS CLARIFICATION" : "EXPLICITLY STATED"}
        </span>
        <button onClick={() => onCitation(finding.citation)}>{finding.citation}</button>
      </div>
      <h3>{finding.label}</h3>
      <strong>{finding.value}</strong>
      <p>{finding.detail}</p>
    </article>
  );
}

export function LeaseAnalysis({ go }: { go: (screen: AdvisorScreen) => void }) {
  const [panel, setPanel] = useState<"document" | "assistant">("assistant");
  const [focus, setFocus] = useState("2.1");
  const showCitation = (citation: string) => {
    setFocus(citation.replace("§ ", ""));
    setPanel("document");
  };

  return (
    <main className="advisor-main advisor-workspace">
      <AdvisorProgress current="lease" go={go} />
      <div className="workspace-heading">
        <div>
          <p>LEASE ANALYSIS · FICTIONAL SAMPLE</p>
          <h1>Seven findings, with the evidence attached.</h1>
        </div>
        <span className="analysis-complete">
          <AdvisorIcon name="check" size={14} /> SIMULATED ANALYSIS COMPLETE
        </span>
      </div>
      <MobilePanelTabs panel={panel} setPanel={setPanel} />
      <div className="advisor-split">
        <section className={`document-panel ${panel === "document" ? "mobile-active" : ""}`}>
          <div className="panel-toolbar">
            <span>
              <AdvisorIcon name="document" size={16} /> Sample_Lease_Avenues.pdf
            </span>
            <em>1 of 1</em>
          </div>
          <div className="paper-scroll">
            <LeasePaper focus={focus} />
          </div>
        </section>
        <section className={`explanation-panel ${panel === "assistant" ? "mobile-active" : ""}`}>
          <div className="explanation-header">
            <span className="assistant-avatar">
              <AdvisorIcon name="sparkle" size={18} />
            </span>
            <div>
              <small>RENTWELL ADVISOR · SIMULATED AI</small>
              <h2>Here’s what the sample lease says</h2>
            </div>
          </div>
          <p className="explanation-intro">
            Every result below points to a clause. When the document is incomplete or unclear, I
            won’t fill in the blanks.
          </p>
          <div className="finding-grid">
            {findings.map((finding) => (
              <FindingCard key={finding.label} finding={finding} onCitation={showCitation} />
            ))}
          </div>
          <div className="missing-terms">
            <div>
              <AdvisorIcon name="alert" />
              <span>
                <b>Terms not found</b>
                <p>
                  No application fee, renewal terms, move-out cleaning fee, or HOA addendum appears
                  in this sample.
                </p>
              </span>
            </div>
            <strong>NEEDS CLARIFICATION</strong>
          </div>
          <AdvisorNotice />
          <div className="advisor-actions">
            <AdvisorButton secondary onClick={() => go("advisor")}>
              Back to advisor
            </AdvisorButton>
            <AdvisorButton onClick={() => go("truecost")}>
              Calculate true cost <AdvisorIcon name="arrow" size={16} />
            </AdvisorButton>
          </div>
        </section>
      </div>
    </main>
  );
}

const costRows = [
  { name: "Base rent", amount: 2100, type: "Monthly", citation: "§ 2.1" },
  { name: "Water / sewer", amount: 65, type: "Monthly", citation: "§ 4.1" },
  { name: "Parking", amount: 75, type: "Monthly", citation: "§ 4.1" },
  { name: "Utility admin", amount: 35, type: "Monthly", citation: "§ 4.1" },
  { name: "Renter’s insurance", amount: 25, type: "Monthly estimate", citation: "§ 4.1" },
];

export function TrueHousingCost({ go }: { go: (screen: AdvisorScreen) => void }) {
  const [panel, setPanel] = useState<"document" | "assistant">("assistant");
  const [occupants, setOccupants] = useState(2);
  const ongoing = 2300;
  const adminFee = 250;
  const deposit = 1000;
  const firstMonth = ongoing + adminFee + deposit;

  return (
    <main className="advisor-main advisor-workspace cost-workspace">
      <AdvisorProgress current="truecost" go={go} />
      <div className="workspace-heading">
        <div>
          <p>TRUE HOUSING COST · SAMPLE TERMS</p>
          <h1>Know what leaves your account—and what may come back.</h1>
        </div>
        <span className="analysis-complete">
          <AdvisorIcon name="document" size={14} /> ALL FIGURES CITED
        </span>
      </div>
      <MobilePanelTabs panel={panel} setPanel={setPanel} />
      <div className="advisor-split">
        <section
          className={`document-panel cost-document ${panel === "document" ? "mobile-active" : ""}`}
        >
          <div className="panel-toolbar">
            <span>
              <AdvisorIcon name="document" size={16} /> Cost evidence
            </span>
            <em>Sample lease</em>
          </div>
          <div className="cost-evidence">
            <div className="evidence-total">
              <small>STATED BASE RENT</small>
              <strong>$2,100</strong>
              <span>/ month</span>
              <button>§ 2.1</button>
            </div>
            <h3>Monthly recurring charges</h3>
            {costRows.slice(1).map((row) => (
              <div className="evidence-row" key={row.name}>
                <span>
                  <b>{row.name}</b>
                  <small>{row.type}</small>
                </span>
                <strong>${row.amount}</strong>
                <em>{row.citation}</em>
              </div>
            ))}
            <h3>Move-in charges</h3>
            <div className="movein-evidence refundable">
              <span>
                <AdvisorIcon name="check" />
                <b>Security deposit</b>
                <small>Refundable, less lawful deductions</small>
              </span>
              <strong>$1,000</strong>
              <em>§ 3.2</em>
            </div>
            <div className="movein-evidence nonrefundable">
              <span>
                <AdvisorIcon name="alert" />
                <b>Administration fee</b>
                <small>Nonrefundable</small>
              </span>
              <strong>$250</strong>
              <em>§ 4.1</em>
            </div>
            <div className="variable-cost-note">
              <AdvisorIcon name="info" />
              <p>
                <b>Usage costs may vary.</b> Electricity and gas amounts are not stated in the
                sample, so they are excluded.
              </p>
            </div>
          </div>
        </section>
        <section
          className={`explanation-panel cost-assistant ${panel === "assistant" ? "mobile-active" : ""}`}
        >
          <div className="explanation-header">
            <span className="assistant-avatar">
              <AdvisorIcon name="sparkle" size={18} />
            </span>
            <div>
              <small>RENTWELL ADVISOR · SIMULATED AI</small>
              <h2>Your cost picture</h2>
            </div>
          </div>
          <div className="cost-hero-grid">
            <div className="first-month">
              <small>ESTIMATED FIRST-MONTH PAYMENT</small>
              <strong>${firstMonth.toLocaleString()}</strong>
              <p>Includes $1,000 refundable deposit</p>
            </div>
            <div className="ongoing-month">
              <small>ONGOING MONTHLY PAYMENT</small>
              <strong>${ongoing.toLocaleString()}</strong>
              <p>Before variable electricity and gas</p>
            </div>
          </div>
          <div className="cost-breakdown">
            <div>
              <span>Base rent</span>
              <b>$2,100</b>
            </div>
            <div>
              <span>Recurring monthly fees</span>
              <b>$200</b>
            </div>
            <div className="refund-line">
              <span>
                <i />
                Refundable deposit
              </span>
              <b>$1,000</b>
            </div>
            <div className="nonrefund-line">
              <span>
                <i />
                Nonrefundable move-in fee
              </span>
              <b>$250</b>
            </div>
          </div>
          <section className="roommate-calculator">
            <div className="calculator-heading">
              <div>
                <small>ROOMMATE COST SPLIT</small>
                <h3>How many people will share?</h3>
              </div>
              <div className="occupant-selector">
                {[1, 2, 3].map((count) => (
                  <button
                    key={count}
                    onClick={() => setOccupants(count)}
                    className={occupants === count ? "active" : ""}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <div className="per-person-cost">
              <span>
                <small>ONGOING PER PERSON</small>
                <strong>${Math.round(ongoing / occupants).toLocaleString()}</strong>
                <em>/ month</em>
              </span>
              <span>
                <small>FIRST MONTH PER PERSON</small>
                <strong>${Math.round(firstMonth / occupants).toLocaleString()}</strong>
                <em>estimated</em>
              </span>
            </div>
            <p>Equal split shown for planning only. Actual roommate arrangements may differ.</p>
          </section>
          <AdvisorNotice />
          <div className="advisor-actions">
            <AdvisorButton secondary onClick={() => go("lease")}>
              Back to lease
            </AdvisorButton>
            <AdvisorButton onClick={() => go("decision")}>
              View decision summary <AdvisorIcon name="arrow" size={16} />
            </AdvisorButton>
          </div>
        </section>
      </div>
    </main>
  );
}

type DecisionGo = (screen: AdvisorScreen | "matches") => void;

const decisionSections = [
  {
    title: "Price Assessment",
    status: "Caution",
    tone: "caution",
    summary: "$2,100 is 7.7% above the fictional comparable median of $1,950.",
    evidence: "RentWell demo comparison · 24 sample listings",
    recommendation: "Ask what amenities or unit upgrades explain the difference.",
  },
  {
    title: "Total Cost",
    status: "Evidence found",
    tone: "good",
    summary: "$3,550 estimated at move-in, then $2,300 monthly before variable utilities.",
    evidence: "Sample lease §§ 2.1, 3.2, 4.1",
    recommendation: "Budget separately for electricity and gas because amounts are not stated.",
  },
  {
    title: "Lease Questions",
    status: "Needs clarification",
    tone: "unknown",
    summary: "Renewal terms, move-out cleaning charges, and application fees are not included.",
    evidence: "No supporting clause found in sample",
    recommendation: "Get written answers and request every applicable addendum before signing.",
  },
  {
    title: "HOA Restrictions",
    status: "Needs clarification",
    tone: "unknown",
    summary: "No HOA addendum or community rules were included in the sample document.",
    evidence: "No HOA evidence found",
    recommendation: "Ask whether an HOA governs the unit and request its current rules.",
  },
  {
    title: "Roommate Considerations",
    status: "Approval required",
    tone: "caution",
    summary: "Roommates and sublets require prior written approval; criteria are not defined.",
    evidence: "Sample lease § 12.4",
    recommendation: "Ask how approval works, how long it takes, and whether fees apply.",
  },
];

export function DecisionSummary({ go }: { go: DecisionGo }) {
  const [panel, setPanel] = useState<"document" | "assistant">("assistant");
  return (
    <main className="advisor-main advisor-workspace decision-workspace">
      <AdvisorProgress current="decision" go={(screen) => go(screen)} />
      <div className="workspace-heading">
        <div>
          <p>RENTAL DECISION SUMMARY · FICTIONAL SAMPLE</p>
          <h1>A clear view of what you know—and what you still need to ask.</h1>
        </div>
        <span className="analysis-complete">
          <AdvisorIcon name="sparkle" size={14} /> PREMIUM SUMMARY
        </span>
      </div>
      <MobilePanelTabs panel={panel} setPanel={setPanel} />
      <div className="advisor-split decision-split">
        <section
          className={`document-panel decision-evidence-panel ${panel === "document" ? "mobile-active" : ""}`}
        >
          <div className="panel-toolbar">
            <span>
              <AdvisorIcon name="document" size={16} /> Evidence map
            </span>
            <em>Sample only</em>
          </div>
          <div className="evidence-map">
            <div className="evidence-score">
              <span>
                <AdvisorIcon name="check" size={20} />
              </span>
              <div>
                <small>EVIDENCE COVERAGE</small>
                <strong>4 of 7 topics supported</strong>
                <p>Three topics still need written clarification.</p>
              </div>
            </div>
            <h3>Source index</h3>
            {[
              ["§ 2.1", "Rent and 12-month term", "Used"],
              ["§ 3.2", "Refundable deposit", "Used"],
              ["§ 4.1", "Recurring and admin fees", "Used"],
              ["§ 6.3", "Late payment fees", "Used"],
              ["§ 9.2", "Early termination", "Used"],
              ["§ 12.4", "Roommates and subletting", "Used"],
              ["—", "HOA / community rules", "Missing"],
              ["—", "Renewal and move-out terms", "Missing"],
            ].map(([cite, label, status]) => (
              <div className="source-index-row" key={label}>
                <b>{cite}</b>
                <span>{label}</span>
                <em className={status === "Missing" ? "missing" : ""}>{status}</em>
              </div>
            ))}
            <div className="evidence-principle">
              <AdvisorIcon name="lock" />
              <p>
                <b>No evidence, no assumption.</b> Missing terms stay marked as unclear rather than
                being guessed.
              </p>
            </div>
          </div>
        </section>
        <section
          className={`explanation-panel decision-assistant ${panel === "assistant" ? "mobile-active" : ""}`}
        >
          <div className="decision-verdict">
            <span className="verdict-icon">
              <AdvisorIcon name="alert" size={22} />
            </span>
            <div>
              <small>RENTWELL ADVISOR TAKEAWAY</small>
              <h2>Promising, but clarify three things first.</h2>
              <p>
                The price is somewhat above the demo median, costs are mostly clear, and roommate
                approval needs a written process.
              </p>
            </div>
          </div>
          <div className="decision-list">
            {decisionSections.map((section) => (
              <article className="decision-card" key={section.title}>
                <div className="decision-card-heading">
                  <h3>{section.title}</h3>
                  <span className={section.tone}>{section.status}</span>
                </div>
                <p>{section.summary}</p>
                <small>
                  <AdvisorIcon name="document" size={12} /> {section.evidence}
                </small>
                <div>
                  <AdvisorIcon name="sparkle" size={14} />
                  <span>
                    <b>Recommendation</b>
                    {section.recommendation}
                  </span>
                </div>
              </article>
            ))}
          </div>
          <section className="landlord-questions">
            <div>
              <small>BEFORE YOU SIGN</small>
              <h2>Questions to ask the landlord</h2>
            </div>
            <ol>
              <li>
                <span>1</span>Are there application, renewal, cleaning, or move-out fees not shown
                here?
              </li>
              <li>
                <span>2</span>What are the written criteria and fees for approving a roommate?
              </li>
              <li>
                <span>3</span>Is the unit governed by an HOA, and can I review all current rules?
              </li>
              <li>
                <span>4</span>What did electricity and gas cost the prior tenant on average?
              </li>
            </ol>
          </section>
          <AdvisorNotice />
          <div className="advisor-actions decision-actions">
            <AdvisorButton secondary onClick={() => go("truecost")}>
              Back to costs
            </AdvisorButton>
            <AdvisorButton onClick={() => go("matches")}>
              View fictional roommate matches <AdvisorIcon name="arrow" size={16} />
            </AdvisorButton>
          </div>
        </section>
      </div>
    </main>
  );
}
