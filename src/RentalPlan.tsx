import rentSnapshotData from "./data/rentcast-slc.json";
import type { OptionalPlanStatus, RoommateSelection } from "./demoAccount";
import { buildRentalDecisionReceipt } from "./listingDecision";
import type { RentalDecisionRecord } from "./rentalDecision";
import type { RentSnapshot } from "./rentMarket";

const RENT_SNAPSHOT = rentSnapshotData as RentSnapshot;

export type RentalPlanSaveState = "idle" | "saving" | "saved" | "error";

export type RentalPlanSummaryProps = {
  decision: RentalDecisionRecord;
  roommate: RoommateSelection | null;
  roommateStatus: Extract<OptionalPlanStatus, "not-started" | "selected" | "skipped">;
  advisorStatus: Extract<OptionalPlanStatus, "not-started" | "reviewed" | "skipped">;
  savedAt: string | null;
  saveState: RentalPlanSaveState;
  onViewReceipt: () => void;
  onChangeRental: () => void;
  onExploreRoommates: () => void;
  onChangeRoommate: () => void;
  onReviewAdvisor: () => void;
  onViewAdvisor: () => void;
  onSkipRoommate: () => void;
  onSkipAdvisor: () => void;
  onSave: () => void;
  onContinueWithoutSaving: () => void;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function formatSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved in this browser";
  return `Saved in this browser ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}

export function RentalPlanSummary({
  decision,
  roommate,
  roommateStatus,
  advisorStatus,
  savedAt,
  saveState,
  onViewReceipt,
  onChangeRental,
  onExploreRoommates,
  onChangeRoommate,
  onReviewAdvisor,
  onViewAdvisor,
  onSkipRoommate,
  onSkipAdvisor,
  onSave,
  onContinueWithoutSaving,
}: RentalPlanSummaryProps) {
  const receipt = buildRentalDecisionReceipt(decision, RENT_SNAPSHOT);
  const perPersonShare = receipt.trueMonthlyCost / 2;
  const supportedEvidenceTopics = decision.securityDeposit === null ? 5 : 6;
  const recurringFeeChecklist = decision.noMandatoryRecurringFees
    ? "No mandatory recurring fees disclosed"
    : decision.recurringFees.length > 0
      ? `${decision.recurringFees.length} mandatory recurring fees reviewed`
      : "Mandatory recurring fees still need confirmation";
  const roommateChecklist =
    roommateStatus === "selected" && roommate
      ? `Roommate selected: ${roommate.displayName}`
      : roommateStatus === "skipped"
        ? "Roommate intentionally skipped"
        : "Roommate decision still open";
  const advisorChecklist =
    advisorStatus === "reviewed"
      ? "Fictional lease review completed"
      : advisorStatus === "skipped"
        ? "Fictional lease review intentionally skipped"
        : "Fictional lease review not completed";

  return (
    <main className="rental-plan-main">
      <section className="rental-plan-heading">
        <div>
          <p className="eyebrow">Your decision workspace</p>
          <h1>My Rental Plan</h1>
          <p>
            Keep the apartment, roommate choice, and Advisor findings together before you commit.
          </p>
        </div>
        <div className={`rental-plan-save-note is-${saveState}`} role="status">
          <strong>
            {saveState === "saved" && savedAt
              ? formatSavedAt(savedAt)
              : saveState === "saving"
                ? "Saving your plan…"
                : saveState === "error"
                  ? "Plan is still open, but could not be saved"
                  : "Not saved yet"}
          </strong>
          <span>Demo plans stay only in this browser.</span>
        </div>
      </section>

      <section className="rental-plan-grid" aria-label="Rental plan summary">
        <article className="rental-plan-card rental-plan-home-card">
          <div className="rental-plan-card-topline">
            <span className="rental-plan-step">1</span>
            <span className="rental-plan-status complete">Rental selected</span>
          </div>
          <p className="eyebrow">Apartment</p>
          <h2>{decision.title}</h2>
          <p className="rental-plan-location">
            {decision.neighborhood} · {decision.city}
          </p>
          <div className="rental-plan-cost">
            <span>True monthly cost</span>
            <strong>{formatMoney(receipt.trueMonthlyCost)}</strong>
            <small>
              {formatMoney(receipt.advertisedRent)} rent + {formatMoney(receipt.recurringFeeTotal)}{" "}
              known mandatory fees
            </small>
          </div>
          <dl className="rental-plan-facts">
            <div>
              <dt>Fair Rent check</dt>
              <dd>{receipt.fairRentResult}</dd>
            </div>
            <div>
              <dt>Move-in cost</dt>
              <dd>
                {receipt.estimatedMoveInCost === null
                  ? "Move-in cost needs confirmation"
                  : formatMoney(receipt.estimatedMoveInCost)}
              </dd>
            </div>
          </dl>
          {receipt.estimatedMoveInCost === null && (
            <p className="rental-plan-confirmation">Deposit not provided</p>
          )}
          <div className="rental-plan-card-actions">
            <button className="text-button" onClick={onViewReceipt}>
              View Decision Receipt
            </button>
            <button className="text-button secondary-text" onClick={onChangeRental}>
              Change rental
            </button>
          </div>
        </article>

        <article className="rental-plan-card">
          <div className="rental-plan-card-topline">
            <span className="rental-plan-step">2</span>
            <span
              className={`rental-plan-status ${roommateStatus === "selected" ? "complete" : "optional"}`}
            >
              Optional
            </span>
          </div>
          <p className="eyebrow">Roommate</p>
          {roommateStatus === "selected" && roommate ? (
            <>
              <h2>{roommate.displayName}</h2>
              <p className="rental-plan-location">
                {roommate.compatibilityScore}% preference match
              </p>
              <div className="rental-plan-cost soft">
                <span>Estimated monthly share each</span>
                <strong>{formatMoney(perPersonShare)}</strong>
                <small>Equal split of the active rental’s true monthly cost</small>
              </div>
              <button className="text-button" onClick={onChangeRoommate}>
                Change roommate
              </button>
            </>
          ) : roommateStatus === "skipped" ? (
            <>
              <h2>Roommate step skipped</h2>
              <p className="rental-plan-empty-copy">
                You can add a roommate later without changing the rental decision.
              </p>
              <button className="text-button" onClick={onExploreRoommates}>
                Explore roommate matches
              </button>
            </>
          ) : (
            <>
              <h2>No roommate selected</h2>
              <p className="rental-plan-empty-copy">
                Compare fictional profiles, then see the split using this rental’s verified cost.
              </p>
              <div className="rental-plan-card-actions stacked">
                <button className="btn-secondary" onClick={onExploreRoommates}>
                  Explore roommate matches
                </button>
                <button className="text-button secondary-text" onClick={onSkipRoommate}>
                  Skip roommate step
                </button>
              </div>
            </>
          )}
        </article>

        <article className="rental-plan-card">
          <div className="rental-plan-card-topline">
            <span className="rental-plan-step">3</span>
            <span
              className={`rental-plan-status ${advisorStatus === "reviewed" ? "complete" : "optional"}`}
            >
              Optional
            </span>
          </div>
          <p className="eyebrow">Advisor</p>
          {advisorStatus === "reviewed" ? (
            <>
              <h2>Advisor review complete</h2>
              <p className="rental-plan-empty-copy">
                Fictional sample lease reviewed · {supportedEvidenceTopics} of 8 evidence topics
                supported · 4 landlord questions ready
              </p>
              <button className="text-button" onClick={onViewAdvisor}>
                View Advisor findings
              </button>
            </>
          ) : advisorStatus === "skipped" ? (
            <>
              <h2>Advisor step skipped</h2>
              <p className="rental-plan-empty-copy">
                You can return to the guided sample lease before making a final decision.
              </p>
              <button className="text-button" onClick={onReviewAdvisor}>
                Review with Advisor
              </button>
            </>
          ) : (
            <>
              <h2>Lease questions not reviewed</h2>
              <p className="rental-plan-empty-copy">
                Use the fictional sample lease to practice spotting costs, rules, and missing
                details.
              </p>
              <div className="rental-plan-card-actions stacked">
                <button className="btn-secondary" onClick={onReviewAdvisor}>
                  Review with Advisor
                </button>
                <button className="text-button secondary-text" onClick={onSkipAdvisor}>
                  Skip Advisor step
                </button>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="rental-plan-checklist" aria-labelledby="decision-checklist-title">
        <div>
          <p className="eyebrow">Before you decide</p>
          <h2 id="decision-checklist-title">Decision checklist</h2>
        </div>
        <ul>
          <li className="is-complete">Rental evaluated</li>
          <li
            className={
              decision.noMandatoryRecurringFees || decision.recurringFees.length > 0
                ? "is-complete"
                : "is-open"
            }
          >
            {recurringFeeChecklist}
          </li>
          <li className={decision.securityDeposit === null ? "is-open" : "is-complete"}>
            {decision.securityDeposit === null ? "Deposit still missing" : "Deposit confirmed"}
          </li>
          <li className={roommateStatus === "not-started" ? "is-open" : "is-complete"}>
            {roommateChecklist}
          </li>
          <li className={advisorStatus === "not-started" ? "is-open" : "is-complete"}>
            {advisorChecklist}
          </li>
        </ul>
      </section>

      <section className="rental-plan-final-actions" aria-label="Save rental plan">
        <div>
          <strong>Ready to keep this plan?</strong>
          <span>Saving uses a demo renter account and this browser only.</span>
        </div>
        <div>
          <button className="text-button secondary-text" onClick={onContinueWithoutSaving}>
            Continue without saving
          </button>
          <button className="btn-primary" onClick={onSave} disabled={saveState === "saving"}>
            {saveState === "saved" ? "Save updates" : "Save my plan"}
          </button>
        </div>
      </section>
    </main>
  );
}
