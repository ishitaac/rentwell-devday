import { useEffect, useMemo, useState } from "react";
import {
  AdvisorHome,
  DecisionSummary,
  LeaseAnalysis,
  TrueHousingCost,
  type AdvisorScreen,
} from "./Advisor";
import { ListingsBrowser, RentalDecisionDetails } from "./Listings";
import { ManagerWorkspace } from "./ManagerWorkspace";
import { RentalEntry } from "./RentalEntry";
import rentSnapshotData from "./data/rentcast-slc.json";
import { demoListingsDataset, getDemoListings, type DemoListing } from "./demoListings";
import {
  createDemoRentalDecision,
  createExternalRentalDecision,
  type ExternalRentalEntry,
  type RentalDecisionRecord,
} from "./rentalDecision";
import {
  createRentalFirstRoommateContext,
  createRoommateFirstContext,
  getRoommateStages,
  type RoommatePlanningContext,
} from "./roommatePlanning";
import {
  calculateRentComparison,
  describeComparisonMethod,
  describeRentDifference,
  type RentSnapshot,
} from "./rentMarket";

type Screen =
  | "home"
  | "listings"
  | "listing-details"
  | "manager"
  | "rental-entry"
  | "rental"
  | "analysis"
  | "math"
  | "preferences"
  | "matches"
  | AdvisorScreen;
type IconName =
  | "arrow"
  | "building"
  | "check"
  | "chevron"
  | "clock"
  | "dollar"
  | "home"
  | "info"
  | "link"
  | "menu"
  | "people"
  | "sparkle"
  | "x";

export const HERO_IMAGE = "/listings/interior-warm.jpg";
export const APARTMENT_IMAGE = "/listings/interior-blue.jpg";
const RENT_SNAPSHOT = rentSnapshotData as RentSnapshot;

export type DecisionOrigin = "listings" | "rental-entry" | "manager";

export function getDecisionBackScreen(origin: DecisionOrigin): DecisionOrigin {
  return origin;
}

const INITIAL_EXTERNAL_ENTRY: ExternalRentalEntry = {
  label: "",
  neighborhood: "",
  askingRent: 0,
  bedrooms: 1,
  squareFootage: null,
  mandatoryRecurringFeeTotal: 0,
  noMandatoryRecurringFees: false,
  moveInDate: "",
};

const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17" />
      <path d="M9 21v-4h4v4M8 7h2m3 0h1M8 11h2m3 0h1M3 21h17" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8.5c-.9-1-2-1.5-4-1.5-2.2 0-3.5 1-3.5 2.5 0 4 7 1.5 7 5 0 1.5-1.3 2.5-3.5 2.5-1.8 0-3.2-.6-4-1.8M12 5v14" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
      <path d="m19 14 .7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14ZM5 14l.7 1.3L7 16l-1.3.7L5 18l-.7-1.3L3 16l1.3-.7L5 14Z" />
    </>
  ),
  x: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
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
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  onClick,
  secondary = false,
  className = "",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${secondary ? "btn-secondary" : "btn-primary"} ${className}`}
    >
      {children}
    </button>
  );
}

const screenOrder: Screen[] = ["rental", "analysis", "math", "preferences", "matches"];
const screenLabels = ["Rental", "Analysis", "Split", "Preferences", "Matches"];

function Progress({ current, go }: { current: Screen; go: (screen: Screen) => void }) {
  const active = screenOrder.indexOf(current);
  return (
    <div className="progress-wrap" aria-label="Your progress">
      <div className="progress">
        {screenOrder.map((screen, index) => (
          <button
            className={`progress-step ${index <= active ? "is-active" : ""}`}
            key={screen}
            onClick={() => index < active && go(screen)}
            disabled={index > active}
          >
            <span>{index < active ? <Icon name="check" size={14} /> : index + 1}</span>
            <small>{screenLabels[index]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoommateProgress({
  current,
  context,
  go,
}: {
  current: "math" | "preferences" | "matches";
  context: RoommatePlanningContext;
  go: (screen: Screen) => void;
}) {
  const stages = getRoommateStages(context);
  const active = stages.findIndex((stage) => stage.screen === current);

  return (
    <div className="progress-wrap" aria-label="Roommate planning progress">
      <div className={`progress roommate-progress stages-${stages.length}`}>
        {stages.map((stage, index) => (
          <button
            className={`progress-step ${index <= active ? "is-active" : ""}`}
            key={stage.screen}
            onClick={() => index < active && go(stage.screen)}
            disabled={index > active}
          >
            <span>{index < active ? <Icon name="check" size={14} /> : index + 1}</span>
            <small>{stage.label}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  prefix,
  suffix,
  min,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {prefix && <b>{prefix}</b>}
        <input
          type={type}
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function Home({
  go,
  onStartRoommatePlanning,
}: {
  go: (screen: Screen) => void;
  onStartRoommatePlanning: () => void;
}) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="location-pill">
            <span /> Built for Salt Lake City renters
          </div>
          <h1>
            Find the right place.
            <br />
            At the right price.
            <br />
            <i>With the right people.</i>
          </h1>
          <p className="hero-sub">
            Make one of life’s biggest monthly decisions with more confidence—and a little less
            spreadsheet chaos.
          </p>
          <div className="hero-actions">
            <Button onClick={() => go("rental-entry")}>
              Check a rental <Icon name="arrow" size={18} />
            </Button>
            <button className="text-button" onClick={() => go("rental-entry")}>
              <Icon name="sparkle" size={18} /> Try demo
            </button>
          </div>
          <p className="micro">
            <Icon name="check" size={15} /> No sign-up needed &nbsp;·&nbsp; Cached market snapshot
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-image">
            <img src={HERO_IMAGE} alt="Warm, light-filled apartment living room" />
            <div className="price-float">
              <span className="icon-tile mint">
                <Icon name="building" size={19} />
              </span>
              <div>
                <small>Sample listing</small>
                <strong>$2,100 / mo</strong>
              </div>
              <span className="fair-pill">Fair-ish</span>
            </div>
          </div>
          <div className="people-float">
            <div className="avatar-stack">
              <span>MJ</span>
              <span>AK</span>
              <span>RS</span>
            </div>
            <div>
              <strong>3 strong matches</strong>
              <small>Based on lifestyle, not identity</small>
            </div>
          </div>
          <div className="decor-dots" />
        </div>
      </section>

      <section className="path-section">
        <div className="section-intro">
          <p className="eyebrow">One decision, two sides</p>
          <h2>A good rental is more than a rent number.</h2>
          <p>
            Check the place, understand the split, then find people whose housing priorities fit
            yours.
          </p>
        </div>
        <div className="path-grid">
          <button className="path-card" onClick={() => go("rental-entry")}>
            <span className="number">01</span>
            <span className="icon-tile coral">
              <Icon name="building" size={26} />
            </span>
            <h3>Check a Rental</h3>
            <p>
              See how the rent compares to a dated Salt Lake City rental snapshot, then calculate
              the real cost with fees.
            </p>
            <span className="card-link">
              Analyze a place <Icon name="arrow" size={17} />
            </span>
          </button>
          <div className="path-connector">
            <span>
              <Icon name="arrow" />
            </span>
            <small>
              Use your rental
              <br />
              in roommate search
            </small>
          </div>
          <button className="path-card" onClick={onStartRoommatePlanning}>
            <span className="number">02</span>
            <span className="icon-tile mint">
              <Icon name="people" size={26} />
            </span>
            <h3>Find a Roommate</h3>
            <p>
              Match on budgets, neighborhoods, schedules, and the everyday habits that make a home
              work.
            </p>
            <span className="card-link">
              Set your preferences <Icon name="arrow" size={17} />
            </span>
          </button>
        </div>
      </section>
      <section className="trust-strip">
        <div>
          <Icon name="dollar" />
          <span>
            <b>Price clarity</b>
            <small>Understand the full monthly cost</small>
          </span>
        </div>
        <div>
          <Icon name="people" />
          <span>
            <b>Lifestyle fit</b>
            <small>Match on housing preferences</small>
          </span>
        </div>
        <div>
          <Icon name="info" />
          <span>
            <b>Dated market data</b>
            <small>Cached snapshot—not live coverage</small>
          </span>
        </div>
      </section>
    </main>
  );
}

export type RentalData = {
  neighborhood: string;
  rent: number;
  bedrooms: number;
  sqft: number;
  fees: number;
  date: string;
};

export function canAnalyzeRental(rental: RentalData): boolean {
  return Number.isFinite(rental.rent) && rental.rent > 0;
}

function RentalInput({
  rental,
  setRental,
  go,
}: {
  rental: RentalData;
  setRental: React.Dispatch<React.SetStateAction<RentalData>>;
  go: (screen: Screen) => void;
}) {
  const [listing, setListing] = useState("");
  const [extracted, setExtracted] = useState(false);
  const update = (key: keyof RentalData, value: string) =>
    setRental((old) => ({
      ...old,
      [key]: key === "neighborhood" || key === "date" ? value : Number(value),
    }));
  const extract = () => {
    setListing("https://example.com/listing/avenues-2br");
    setRental({
      neighborhood: "The Avenues",
      rent: 2100,
      bedrooms: 2,
      sqft: 940,
      fees: 200,
      date: "2025-08-15",
    });
    setExtracted(true);
  };
  return (
    <main className="app-main">
      <Progress current="rental" go={go} />
      <PageHeading eyebrow="Rental check · Step 1 of 5" title="Let’s look at the numbers.">
        Paste a listing or enter the basics yourself. Everything stays editable.
      </PageHeading>
      <div className="form-layout">
        <section className="card form-card">
          <div className="card-title-row">
            <div>
              <h2>Start with a listing</h2>
              <p>We’ll use mock extraction for this prototype.</p>
            </div>
            <span className="demo-tag">DEMO TOOL</span>
          </div>
          <label className="field">
            <span>Rental listing URL or description</span>
            <textarea
              value={listing}
              onChange={(e) => setListing(e.target.value)}
              placeholder="Paste a listing link or description here..."
            />
          </label>
          <button className="extract-button" onClick={extract}>
            <Icon name="sparkle" size={18} /> Extract listing details
          </button>
          {extracted && (
            <div className="success-note">
              <Icon name="check" size={17} />
              <span>
                <b>Demo details extracted.</b> Review and edit anything below.
              </span>
            </div>
          )}
          <div className="or">
            <span>or enter manually</span>
          </div>
          <div className="field-grid">
            <Field
              label="Neighborhood"
              value={rental.neighborhood}
              onChange={(v) => update("neighborhood", v)}
            />
            <Field
              label="Monthly rent"
              value={rental.rent}
              onChange={(v) => update("rent", v)}
              type="number"
              prefix="$"
              min={1}
            />
            <Field
              label="Bedrooms"
              value={rental.bedrooms}
              onChange={(v) => update("bedrooms", v)}
              type="number"
              min={0}
            />
            <Field
              label="Square footage"
              value={rental.sqft}
              onChange={(v) => update("sqft", v)}
              type="number"
              suffix="sq ft"
              min={0}
            />
            <Field
              label="Recurring monthly fees"
              value={rental.fees}
              onChange={(v) => update("fees", v)}
              type="number"
              prefix="$"
              min={0}
            />
            <Field
              label="Move-in date"
              value={rental.date}
              onChange={(v) => update("date", v)}
              type="date"
            />
          </div>
          <Button
            className="wide-button"
            onClick={() => go("analysis")}
            disabled={!canAnalyzeRental(rental)}
          >
            Analyze this rental <Icon name="arrow" size={18} />
          </Button>
        </section>
        <aside className="side-card rental-preview">
          <img src={APARTMENT_IMAGE} alt="Bright sample apartment living room" />
          <div className="preview-body">
            <span className="demo-tag">SAMPLE RENTAL</span>
            <h3>{rental.neighborhood || "Your neighborhood"} apartment</h3>
            <p>
              <Icon name="building" size={16} /> {rental.bedrooms || "—"} bed &nbsp;·&nbsp;{" "}
              {rental.sqft || "—"} sq ft
            </p>
            <div className="preview-price">
              <strong>${rental.rent.toLocaleString()}</strong>
              <span>
                / month
                <br />+ ${rental.fees} fees
              </span>
            </div>
          </div>
          <div className="tip">
            <Icon name="info" size={18} />
            <p>
              <b>Prototype note</b>
              <br />
              Listing extraction is simulated. Market comparisons use a dated RentCast snapshot, not
              live coverage.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Analysis({ rental, go }: { rental: RentalData; go: (screen: Screen) => void }) {
  const comparison = calculateRentComparison(RENT_SNAPSHOT, rental.bedrooms);
  const difference = describeRentDifference(rental.rent, comparison);
  const comparisonMethod = describeComparisonMethod(comparison, rental.bedrooms);
  const max = Math.ceil(Math.max(rental.rent, comparison?.upper ?? 0, 1) / 100) * 100;
  const scopeLabel =
    comparison?.differenceScope === "exact-bedrooms"
      ? `${rental.bedrooms}-bedroom listings`
      : "all bedroom counts (broader fallback)";
  const observedRange =
    comparison?.observedStart && comparison.observedEnd
      ? `${comparison.observedStart.slice(0, 10)} – ${comparison.observedEnd.slice(0, 10)}`
      : "Observation dates unavailable";
  return (
    <main className="app-main">
      <Progress current="analysis" go={go} />
      <PageHeading eyebrow="Fair rent analysis · Step 2 of 5" title={difference.heading}>
        Here’s how the asking price compares with a cached snapshot of active Salt Lake City
        rentals.
      </PageHeading>
      <div className="analysis-summary">
        <div>
          <small>ASKING RENT</small>
          <strong>${rental.rent.toLocaleString()}</strong>
          <span>/ month</span>
        </div>
        <div>
          <small>SNAPSHOT MEDIAN</small>
          <strong>{comparison ? `$${comparison.median.toLocaleString()}` : "—"}</strong>
          <span>/ month</span>
        </div>
        <div className="difference">
          <small>DIFFERENCE</small>
          <strong>{difference.percentageLabel}</strong>
          <span>{difference.directionLabel}</span>
        </div>
      </div>
      <section className="card chart-card">
        <div className="card-title-row">
          <div>
            <h2>Rent comparison</h2>
            <p>{comparison ? scopeLabel : "No valid comparison listings"} in Salt Lake City</p>
          </div>
          <span className="demo-tag">RENTCAST SNAPSHOT</span>
        </div>
        <div className="chart">
          <div className="bar-row">
            <span>Lower range</span>
            <div>
              <i style={{ width: `${((comparison?.lower ?? 0) / max) * 100}%` }} />
            </div>
            <b>{comparison ? `$${comparison.lower.toLocaleString()}` : "—"}</b>
          </div>
          <div className="bar-row median">
            <span>Comparable median</span>
            <div>
              <i style={{ width: `${((comparison?.median ?? 0) / max) * 100}%` }} />
            </div>
            <b>{comparison ? `$${comparison.median.toLocaleString()}` : "—"}</b>
          </div>
          <div className="bar-row asking">
            <span>This rental</span>
            <div>
              <i style={{ width: `${(rental.rent / max) * 100}%` }} />
            </div>
            <b>${rental.rent.toLocaleString()}</b>
          </div>
          <div className="bar-row">
            <span>Upper range</span>
            <div>
              <i style={{ width: `${((comparison?.upper ?? 0) / max) * 100}%` }} />
            </div>
            <b>{comparison ? `$${comparison.upper.toLocaleString()}` : "—"}</b>
          </div>
          <div className="chart-axis">
            <span>$0</span>
            <span>${Math.round(max / 2).toLocaleString()}</span>
            <span>${max.toLocaleString()}</span>
          </div>
        </div>
        <div className="chart-stats">
          <div>
            <Icon name="building" />
            <span>
              <b>{comparison ? `${comparison.count} active listings` : "No valid listings"}</b>
              <small>{comparison ? scopeLabel : "Comparison unavailable"}</small>
            </span>
          </div>
          <div>
            <Icon name="clock" />
            <span>
              <b>Observed {observedRange}</b>
              <small>Snapshot retrieved {RENT_SNAPSHOT.generatedAt.slice(0, 10)}</small>
            </span>
          </div>
        </div>
      </section>
      <section className="explain-card">
        <span className="icon-tile mint">
          <Icon name="info" />
        </span>
        <div>
          <h3>How we got here</h3>
          <p>
            {comparisonMethod} The median is the middle listed rent—not an appraisal, a guarantee,
            or live market coverage. Building age, condition, parking, location, and utilities can
            all explain differences.
          </p>
        </div>
      </section>
      <div className="bottom-actions">
        <Button secondary onClick={() => go("rental")}>
          Edit rental
        </Button>
        <Button onClick={() => go("math")}>
          See the roommate math <Icon name="arrow" size={18} />
        </Button>
      </div>
    </main>
  );
}

function RoommateMath({
  context,
  go,
  onBackToDecision,
}: {
  context: RoommatePlanningContext;
  go: (screen: Screen) => void;
  onBackToDecision: () => void;
}) {
  const [occupants, setOccupants] = useState(2);
  if (context.entryPerspective !== "rental-first") return null;
  const rental = context.rental;
  const total = rental.trueMonthlyCost;
  const each = total / occupants;
  return (
    <main className="app-main">
      <RoommateProgress current="math" context={context} go={go} />
      <PageHeading eyebrow="Roommate planning · Cost split" title="See what sharing really saves.">
        Review the Decision Receipt costs, then adjust the household size.
      </PageHeading>
      <div className="math-layout">
        <section className="card costs-card">
          <div className="card-title-row">
            <div>
              <h2>Monthly housing costs</h2>
              <p>{rental.title} · {rental.neighborhood}</p>
            </div>
            <span className="demo-tag">FROM DECISION RECEIPT</span>
          </div>
          <div className="cost-row">
            <span>Base rent</span>
            <div className="inline-money">
              <span>$</span>
              <input
                aria-label="Base rent"
                type="number"
                value={rental.advertisedRent}
                readOnly
              />
            </div>
          </div>
          <div className="cost-row">
            <span>
              Recurring fees <small>utilities, parking, internet</small>
            </span>
            <div className="inline-money">
              <span>$</span>
              <input
                aria-label="Monthly fees"
                type="number"
                value={rental.recurringFeeTotal}
                readOnly
              />
            </div>
          </div>
          <div className="total-row">
            <span>Total monthly cost</span>
            <strong>${total.toLocaleString()}</strong>
          </div>
          <div className="occupants">
            <div>
              <b>People sharing the apartment</b>
              <small>Including you</small>
            </div>
            <div className="stepper">
              <button
                onClick={() => setOccupants(Math.max(1, occupants - 1))}
                aria-label="Remove one person"
              >
                −
              </button>
              <strong>{occupants}</strong>
              <button
                onClick={() => setOccupants(Math.min(5, occupants + 1))}
                aria-label="Add one person"
              >
                +
              </button>
            </div>
          </div>
        </section>
        <section className="split-card">
          <p>ESTIMATED COST PER PERSON</p>
          <div className="split-price">
            <span>$</span>
            <strong>{Math.round(each).toLocaleString()}</strong>
            <small>/ month</small>
          </div>
          <div className="equation">
            <span>${rental.advertisedRent.toLocaleString()} rent</span>
            <b>+</b>
            <span>${rental.recurringFeeTotal.toLocaleString()} fees</span>
            <b>÷</b>
            <span>{occupants} people</span>
          </div>
          <div className="savings">
            <Icon name="sparkle" size={18} />
            <span>
              <b>${Math.round(total - each).toLocaleString()} less per month</b>
              <small>than covering the apartment alone</small>
            </span>
          </div>
          <Button className="wide-button light-button" onClick={() => go("preferences")}>
            Find roommates for this apartment <Icon name="arrow" size={18} />
          </Button>
          <small className="split-disclaimer">
            Equal split estimate. Roommates can agree on a different arrangement.
          </small>
        </section>
      </div>
      <div className="bottom-actions">
        <Button secondary onClick={onBackToDecision}>
          Back to Decision Receipt
        </Button>
      </div>
    </main>
  );
}

const neighborhoods = ["The Avenues", "Central City", "Sugar House", "Downtown", "9th & 9th"];

function Preferences({
  context,
  go,
}: {
  context: RoommatePlanningContext;
  go: (screen: Screen) => void;
}) {
  const [budget, setBudget] = useState(1250);
  const [selectedAreas, setSelectedAreas] = useState(["The Avenues", "Central City"]);
  const [clean, setClean] = useState(4);
  const [moveIn, setMoveIn] = useState("August 2025");
  const [schedule, setSchedule] = useState("Early-ish");
  const [guests, setGuests] = useState("Sometimes");
  const [atmosphere, setAtmosphere] = useState("Friendly & independent");
  const toggleArea = (area: string) =>
    setSelectedAreas((old) =>
      old.includes(area) ? old.filter((item) => item !== area) : [...old, area],
    );
  return (
    <main className="app-main">
      <RoommateProgress current="preferences" context={context} go={go} />
      <PageHeading
        eyebrow="Roommate planning · Living preferences"
        title="What makes a place feel like home?"
      >
        We match only on housing needs and everyday living preferences—never protected
        characteristics.
      </PageHeading>
      <div className="preferences-grid">
        <section className="card preference-card budget-card">
          <div className="pref-icon">
            <Icon name="dollar" />
          </div>
          <div className="pref-head">
            <h3>Monthly budget</h3>
            <p>Your comfortable all-in share</p>
          </div>
          <div className="budget-display">
            Up to <strong>${budget.toLocaleString()}</strong> <span>/ month</span>
          </div>
          <input
            className="range"
            type="range"
            min="700"
            max="1800"
            step="50"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            style={{ "--range": `${((budget - 700) / 1100) * 100}%` } as React.CSSProperties}
          />
          <div className="range-labels">
            <span>$700</span>
            <span>$1,800+</span>
          </div>
        </section>
        <section className="card preference-card">
          <div className="pref-icon">
            <Icon name="home" />
          </div>
          <div className="pref-head">
            <h3>Preferred neighborhoods</h3>
            <p>Choose as many as you like</p>
          </div>
          <div className="chips">
            {neighborhoods.map((area) => (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={selectedAreas.includes(area) ? "selected" : ""}
              >
                {selectedAreas.includes(area) && <Icon name="check" size={14} />}
                {area}
              </button>
            ))}
          </div>
        </section>
        <section className="card preference-card">
          <div className="pref-icon">
            <Icon name="clock" />
          </div>
          <div className="pref-head">
            <h3>Move-in timing</h3>
            <p>How soon are you looking?</p>
          </div>
          <div className="select-cards">
            {["August 2025", "September 2025", "Flexible"].map((x) => (
              <button
                className={moveIn === x ? "selected" : ""}
                key={x}
                onClick={() => setMoveIn(x)}
              >
                {x}
              </button>
            ))}
          </div>
        </section>
        <section className="card preference-card cleanliness">
          <div className="pref-icon">
            <Icon name="sparkle" />
          </div>
          <div className="pref-head">
            <h3>Cleanliness</h3>
            <p>What feels comfortable to you?</p>
          </div>
          <div className="dot-scale">
            {[1, 2, 3, 4, 5].map((x) => (
              <button key={x} onClick={() => setClean(x)} className={x <= clean ? "selected" : ""}>
                {x}
              </button>
            ))}
          </div>
          <div className="range-labels">
            <span>Relaxed</span>
            <b>
              {clean === 5 ? "Very tidy" : clean >= 4 ? "Tidy, not perfect" : "Go with the flow"}
            </b>
            <span>Very tidy</span>
          </div>
        </section>
        <section className="card preference-card">
          <div className="pref-icon">
            <Icon name="clock" />
          </div>
          <div className="pref-head">
            <h3>Daily schedule</h3>
            <p>When is your home usually active?</p>
          </div>
          <div className="chips compact">
            {["Early-ish", "9–5 rhythm", "Night owl", "Varies"].map((x) => (
              <button
                key={x}
                onClick={() => setSchedule(x)}
                className={schedule === x ? "selected" : ""}
              >
                {x}
              </button>
            ))}
          </div>
        </section>
        <section className="card preference-card">
          <div className="pref-icon">
            <Icon name="people" />
          </div>
          <div className="pref-head">
            <h3>Guests</h3>
            <p>How often do friends visit?</p>
          </div>
          <div className="chips compact">
            {["Rarely", "Sometimes", "Often"].map((x) => (
              <button
                key={x}
                onClick={() => setGuests(x)}
                className={guests === x ? "selected" : ""}
              >
                {x}
              </button>
            ))}
          </div>
        </section>
        <section className="card preference-card atmosphere-card">
          <div className="pref-icon">
            <Icon name="home" />
          </div>
          <div className="pref-head">
            <h3>Household atmosphere</h3>
            <p>Pick the vibe you’re hoping for</p>
          </div>
          <div className="atmospheres">
            {["Quiet & independent", "Friendly & independent", "Social & shared"].map((x) => (
              <button
                key={x}
                onClick={() => setAtmosphere(x)}
                className={atmosphere === x ? "selected" : ""}
              >
                <span>
                  {x === "Quiet & independent"
                    ? "Quiet corners"
                    : x === "Friendly & independent"
                      ? "Easy company"
                      : "Shared moments"}
                </span>
                <b>{x}</b>
                {atmosphere === x && <Icon name="check" size={16} />}
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="privacy-note">
        <Icon name="info" size={18} />
        <span>
          <b>Preference-based matching only.</b> This prototype does not use race, religion, gender,
          disability, family status, or other protected characteristics.
        </span>
      </div>
      <div className="bottom-actions">
        <Button
          secondary
          onClick={() => go(context.entryPerspective === "rental-first" ? "math" : "home")}
        >
          {context.entryPerspective === "rental-first" ? "Back to cost split" : "Back to home"}
        </Button>
        <Button onClick={() => go("matches")}>
          Find my matches <Icon name="arrow" size={18} />
        </Button>
      </div>
    </main>
  );
}

const profiles = [
  {
    initials: "MJ",
    name: "Maya J.",
    score: 94,
    role: "Fictional profile · Graduate student",
    budget: "$1,050–$1,250",
    area: "The Avenues, Central City",
    matches: [
      "Similar tidy-but-not-perfect style",
      "Aligned August move-in",
      "Friendly, independent home vibe",
    ],
    difference: "Maya starts her day earlier and prefers quiet after 10:30 PM.",
    color: "peach",
  },
  {
    initials: "AK",
    name: "Alex K.",
    score: 89,
    role: "Fictional profile · UX designer",
    budget: "$1,100–$1,350",
    area: "The Avenues, Downtown",
    matches: [
      "Great budget fit for this apartment",
      "Similar approach to occasional guests",
      "Both value clear chore expectations",
    ],
    difference: "Alex works from home three days a week.",
    color: "mint-avatar",
  },
  {
    initials: "RS",
    name: "Riley S.",
    score: 83,
    role: "Fictional profile · Research assistant",
    budget: "$950–$1,200",
    area: "Central City, 9th & 9th",
    matches: ["Flexible on neighborhood", "Compatible shared-space habits", "Same move-in window"],
    difference: "Riley prefers a more social household on weekends.",
    color: "blue-avatar",
  },
];

export function Matches({
  context,
  go,
}: {
  context: RoommatePlanningContext;
  go: (screen: Screen) => void;
}) {
  const [open, setOpen] = useState(0);
  const rental = context.rental;
  return (
    <main className="app-main matches-main">
      <RoommateProgress current="matches" context={context} go={go} />
      <div className="matches-heading">
        <div>
          <p className="eyebrow">Roommate planning · Matches</p>
          <h1>Your strongest fits</h1>
          <p>
            {rental
              ? `Matches for ${rental.title}, ranked by the housing preferences you shared.`
              : "Matches based on your living preferences. Every profile below is fictional."}
          </p>
        </div>
        <span className="demo-tag">FICTIONAL PROFILES</span>
      </div>
      {rental && (
        <div className="context-banner context-banner-text-only">
          <div>
            <small>MATCHING FOR</small>
            <h3>{rental.title}</h3>
            <p>
              {rental.neighborhood} · {rental.bedrooms}-bed · $
              {rental.trueMonthlyCost.toLocaleString()}/mo total &nbsp;·&nbsp; $
              {Math.round(rental.trueMonthlyCost / 2).toLocaleString()} each with two
            </p>
          </div>
          <button onClick={() => go("math")}>
            View cost split <Icon name="chevron" size={17} />
          </button>
        </div>
      )}
      <div className="match-list">
        {profiles.map((profile, index) => (
          <article className={`match-card ${open === index ? "open" : ""}`} key={profile.name}>
            <div className="profile-core">
              <div className={`profile-avatar ${profile.color}`}>
                {profile.initials}
                <span className="online" />
              </div>
              <div className="profile-name">
                <h2>{profile.name}</h2>
                <p>{profile.role}</p>
              </div>
              <div className="score">
                <strong>{profile.score}%</strong>
                <span>compatibility</span>
              </div>
            </div>
            <div className="match-body">
              <div className="profile-meta">
                <span>
                  <small>BUDGET FIT</small>
                  <b>
                    <Icon name="check" size={15} /> {profile.budget}
                  </b>
                </span>
                <span>
                  <small>NEIGHBORHOOD FIT</small>
                  <b>
                    <Icon name="check" size={15} /> {profile.area}
                  </b>
                </span>
              </div>
              <div className="reasons">
                <div>
                  <h4>Why you match</h4>
                  {profile.matches.map((match) => (
                    <p key={match}>
                      <Icon name="check" size={15} />
                      {match}
                    </p>
                  ))}
                </div>
                <div className="difference-box">
                  <h4>Worth talking about</h4>
                  <p>
                    <Icon name="info" size={15} />
                    {profile.difference}
                  </p>
                </div>
              </div>
              <div className="match-actions">
                <Button onClick={() => setOpen(index)}>
                  {open === index ? "Profile selected" : "View match details"}{" "}
                  {open === index && <Icon name="check" size={17} />}
                </Button>
                {rental && (
                  <button className="text-button" onClick={() => go("math")}>
                    See apartment split <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="prototype-note">
        <Icon name="info" />
        <div>
          <b>A decision aid, not a screening service.</b>
          <p>
            RentWell does not verify identity, run background checks, guarantee compatibility, or
            provide live market coverage in this prototype. Always meet safely and discuss
            expectations directly.
          </p>
        </div>
      </div>
      <div className="bottom-actions">
        <Button secondary onClick={() => go("preferences")}>
          Adjust preferences
        </Button>
        <Button onClick={() => go("home")}>Start a new search</Button>
      </div>
    </main>
  );
}

function App() {
  const [demoListings, setDemoListings] = useState<DemoListing[]>(() =>
    getDemoListings(demoListingsDataset),
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [menu, setMenu] = useState(false);
  const [listingQuery, setListingQuery] = useState("");
  const [activeDecision, setActiveDecision] = useState<RentalDecisionRecord | null>(null);
  const [decisionOrigin, setDecisionOrigin] = useState<DecisionOrigin>("listings");
  const [externalEntry, setExternalEntry] = useState<ExternalRentalEntry>(
    INITIAL_EXTERNAL_ENTRY,
  );
  const [roommateContext, setRoommateContext] = useState<RoommatePlanningContext>(() =>
    createRoommateFirstContext(),
  );
  const [savedDecisionIds, setSavedDecisionIds] = useState<string[]>([]);
  const [comparedDecisionIds, setComparedDecisionIds] = useState<string[]>([]);
  const [tourRequestedIds, setTourRequestedIds] = useState<string[]>([]);
  const [showCalculation, setShowCalculation] = useState(false);
  const go = (next: Screen) => {
    setScreen(next);
    setMenu(false);
  };
  const openListing = (
    listing: DemoListing,
    returnScreen: "listings" | "manager" = "listings",
  ) => {
    setActiveDecision(createDemoRentalDecision(listing));
    setDecisionOrigin(returnScreen);
    setShowCalculation(false);
    go("listing-details");
  };
  const openExternalDecision = (entry: ExternalRentalEntry) => {
    setExternalEntry(entry);
    setActiveDecision(createExternalRentalDecision(entry));
    setDecisionOrigin("rental-entry");
    setShowCalculation(false);
    go("listing-details");
  };
  const startRoommateFirst = () => {
    setRoommateContext(createRoommateFirstContext());
    go("preferences");
  };
  const planWithRoommates = () => {
    if (!activeDecision) return;
    setRoommateContext(createRentalFirstRoommateContext(activeDecision));
    go("math");
  };
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen]);
  const navActive = useMemo(
    () =>
      ["advisor", "lease", "truecost", "decision"].includes(screen)
        ? "advisor"
        : screen === "preferences" || screen === "matches"
          ? "roommates"
          : screen === "manager" ||
              (screen === "listing-details" && decisionOrigin === "manager")
            ? "manager"
            : screen === "listings" ||
                (screen === "listing-details" && decisionOrigin === "listings")
              ? "listings"
              : screen === "home"
                ? ""
                : "rental",
    [decisionOrigin, screen],
  );

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand" onClick={() => go("home")} aria-label="RentWell home">
          <span className="brand-mark">
            <Icon name="home" size={20} />
          </span>
          <span>
            Rent<span>Well</span>
          </span>
        </button>
        <nav className={menu ? "open" : ""}>
          <button
            className={navActive === "listings" ? "active" : ""}
            onClick={() => go("listings")}
          >
            Browse Rentals
          </button>
          <button
            className={navActive === "rental" ? "active" : ""}
            onClick={() => go("rental-entry")}
          >
            Check Your Rental
          </button>
          <button
            className={navActive === "roommates" ? "active" : ""}
            onClick={startRoommateFirst}
          >
            Roommate Planning
          </button>
          <button className={navActive === "advisor" ? "active" : ""} onClick={() => go("advisor")}>
            AI Advisor
          </button>
          <button onClick={() => go("home")}>How It Works</button>
          <button
            className={`manager-role-entry ${navActive === "manager" ? "active" : ""}`}
            onClick={() => go("manager")}
          >
            For property managers
          </button>
          <Button onClick={() => go("advisor")}>
            Try Advisor <Icon name="sparkle" size={16} />
          </Button>
        </nav>
        <button
          className="menu-button"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close menu" : "Open menu"}
        >
          <Icon name={menu ? "x" : "menu"} />
        </button>
      </header>
      {screen === "home" && (
        <Home go={go} onStartRoommatePlanning={startRoommateFirst} />
      )}
      {screen === "listings" && (
        <ListingsBrowser
          listings={demoListings.slice(0, 6)}
          onViewDetails={(listing) => openListing(listing, "listings")}
          query={listingQuery}
          onQueryChange={setListingQuery}
        />
      )}
      {screen === "listing-details" && activeDecision && (
        <RentalDecisionDetails
          decision={activeDecision}
          saved={savedDecisionIds.includes(activeDecision.decisionId)}
          compared={comparedDecisionIds.includes(activeDecision.decisionId)}
          tourRequested={tourRequestedIds.includes(activeDecision.decisionId)}
          showCalculation={showCalculation}
          backLabel={
            decisionOrigin === "manager"
              ? "Back to manager workspace"
              : decisionOrigin === "rental-entry"
                ? "Back to rental entry"
                : "Back to listings"
          }
          onBack={() => go(getDecisionBackScreen(decisionOrigin))}
          onToggleSaved={() =>
            setSavedDecisionIds((current) =>
              current.includes(activeDecision.decisionId)
                ? current.filter((id) => id !== activeDecision.decisionId)
                : [...current, activeDecision.decisionId],
            )
          }
          onToggleCompared={() =>
            setComparedDecisionIds((current) =>
              current.includes(activeDecision.decisionId)
                ? current.filter((id) => id !== activeDecision.decisionId)
                : [...current, activeDecision.decisionId],
            )
          }
          onRequestTour={() =>
            setTourRequestedIds((current) =>
              current.includes(activeDecision.decisionId)
                ? current
                : [...current, activeDecision.decisionId],
            )
          }
          onPlanWithRoommates={planWithRoommates}
          onToggleCalculation={() => setShowCalculation((current) => !current)}
        />
      )}
      {screen === "manager" && (
        <ManagerWorkspace
          listings={demoListings}
          onListingsChange={setDemoListings}
          onPreviewListing={(listing) => openListing(listing, "manager")}
        />
      )}
      {screen === "rental-entry" && (
        <RentalEntry
          initialEntry={externalEntry}
          onEntryChange={setExternalEntry}
          onSubmit={openExternalDecision}
        />
      )}
      {screen === "math" && (
        <RoommateMath
          context={roommateContext}
          go={go}
          onBackToDecision={() => go("listing-details")}
        />
      )}
      {screen === "preferences" && <Preferences context={roommateContext} go={go} />}
      {screen === "matches" && <Matches context={roommateContext} go={go} />}
      {screen === "advisor" && <AdvisorHome go={go} />}
      {screen === "lease" && <LeaseAnalysis go={go} />}
      {screen === "truecost" && <TrueHousingCost go={go} />}
      {screen === "decision" && <DecisionSummary go={go} />}
      <footer>
        <button className="brand footer-brand" onClick={() => go("home")}>
          <span className="brand-mark">
            <Icon name="home" size={18} />
          </span>
          <span>
            Rent<span>Well</span>
          </span>
        </button>
        <p>Find a place. Find your people. Rent well.</p>
        <small>
          Interactive prototype · Salt Lake City, Utah · RentCast snapshot{" "}
          {RENT_SNAPSHOT.generatedAt.slice(0, 10)}
        </small>
      </footer>
    </div>
  );
}

export default App;
