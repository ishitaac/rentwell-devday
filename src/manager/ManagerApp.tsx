import { useEffect, useMemo, useState } from "react";

import { demoListingsDataset, getDemoListings, type DemoListing } from "../demoListings";
import { RentalDecisionDetails } from "../Listings";
import { ManagerPilot } from "../ManagerPilot";
import { ManagerWorkspace } from "../ManagerWorkspace";
import { loadManagerPilot, saveManagerPilot, type ManagerPilotChoice } from "../demoAccount";
import { createDemoRentalDecision } from "../rentalDecision";
import { clearSession, readSession, writeSession } from "./auth";
import { getRenterUrl } from "./links";
import { ManagerLogin } from "./ManagerLogin";

export function getManagerStage(
  sessionEmail: string | null,
  pilotChoice: ManagerPilotChoice | null,
): "login" | "pilot" | "workspace" {
  if (!sessionEmail) return "login";
  return pilotChoice ? "workspace" : "pilot";
}

function readPilotChoice(): ManagerPilotChoice | null {
  try {
    const result = loadManagerPilot(window.localStorage);
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

function HomeMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </svg>
  );
}

function RenterPreview({ listing, onBack }: { listing: DemoListing; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const decision = useMemo(() => createDemoRentalDecision(listing), [listing]);
  const renterUrl = getRenterUrl();
  const openRenterApp = () => {
    if (renterUrl) window.open(renterUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="mgr-preview-banner" role="status">
        <strong>Renter preview</strong>
        <span>
          This is how renters see this listing. Planning and Advisor actions open in the renter app.
        </span>
      </div>
      <RentalDecisionDetails
        decision={decision}
        saved={saved}
        showCalculation={showCalculation}
        backLabel="Back to manager workspace"
        onBack={onBack}
        onToggleSaved={() => setSaved((current) => !current)}
        onPlanWithRoommates={openRenterApp}
        onOpenAdvisor={openRenterApp}
        onToggleCalculation={() => setShowCalculation((current) => !current)}
      />
    </>
  );
}

export function ManagerApp() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => readSession());
  const [pilotChoice, setPilotChoice] = useState<ManagerPilotChoice | null>(() =>
    readPilotChoice(),
  );
  const [pilotError, setPilotError] = useState<string | null>(null);
  const [listings, setListings] = useState<DemoListing[]>(() =>
    getDemoListings(demoListingsDataset),
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const renterUrl = getRenterUrl();
  const previewListing = previewId
    ? (listings.find((listing) => listing.synthetic.listingId === previewId) ?? null)
    : null;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [sessionEmail, previewId]);

  const signIn = (email: string) => {
    writeSession(email);
    setSessionEmail(email);
  };

  const signOut = () => {
    clearSession();
    setPreviewId(null);
    setSessionEmail(null);
  };
  const choosePilot = (choice: ManagerPilotChoice) => {
    try {
      const result = saveManagerPilot(window.localStorage, choice);
      setPilotError(result.ok ? null : result.error);
    } catch {
      setPilotError("Browser storage is unavailable. Your pilot choice is temporary.");
    }
    setPilotChoice(choice);
  };
  const managerStage = getManagerStage(sessionEmail, pilotChoice);

  return (
    <div className="site-shell mgr-shell">
      <header className="site-header mgr-header">
        <a className="brand mgr-brand" href="/" aria-label="RentWell for property managers home">
          <span className="brand-mark">
            <HomeMark />
          </span>
          <span>
            Rent<span>Well</span>
          </span>
        </a>
        <span className="mgr-role-pill">For property managers</span>
        <div className="mgr-header-actions">
          {renterUrl && (
            <a className="mgr-link" href={renterUrl}>
              {sessionEmail ? "RentWell for renters ↗" : "← Back to RentWell"}
            </a>
          )}
          {sessionEmail && (
            <>
              <span className="mgr-user">{sessionEmail}</span>
              <button type="button" className="btn-secondary mgr-signout" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {managerStage === "login" && <ManagerLogin onSignedIn={signIn} />}

      {managerStage === "pilot" && (
        <ManagerPilot
          onStartPilot={() => choosePilot("started")}
          onRequestDemo={() => choosePilot("requested")}
          onSignOut={signOut}
          error={pilotError}
        />
      )}

      {managerStage === "workspace" && (
        <>
          {/* Kept mounted while previewing so an open editor draft is not lost. */}
          <div className="mgr-workspace" hidden={previewListing !== null}>
            <ManagerWorkspace
              listings={listings}
              onListingsChange={setListings}
              onPreviewListing={(listing) => setPreviewId(listing.synthetic.listingId)}
            />
          </div>
          {previewListing && (
            <RenterPreview listing={previewListing} onBack={() => setPreviewId(null)} />
          )}
        </>
      )}

      <footer className="mgr-footer">
        RentWell for property managers · Demo workspace with synthetic listings. Edits are not saved
        or shared with the renter app.
      </footer>
    </div>
  );
}
