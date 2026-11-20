export type ManagerPilotProps = {
  companyName?: string;
  onStartPilot: () => void;
  onRequestDemo: () => void;
  onSignOut: () => void;
  error?: string | null;
};

export function ManagerPilot({
  companyName,
  onStartPilot,
  onRequestDemo,
  onSignOut,
  error,
}: ManagerPilotProps) {
  return (
    <main className="manager-pilot-main">
      <section className="manager-pilot-card">
        <div className="manager-pilot-heading">
          <p className="eyebrow">Property-manager pilot</p>
          <h1>Make listing costs easier for renters to trust.</h1>
          <p>
            {companyName ? `${companyName} can` : "Your team can"} try RentWell’s listing editor,
            fee disclosure, renter preview, and Decision Receipt workflow with synthetic demo data.
          </p>
        </div>
        <div className="manager-pilot-benefits">
          <article>
            <span>01</span>
            <strong>Disclose the full monthly cost</strong>
            <p>Keep base rent and mandatory recurring fees visible as separate facts.</p>
          </article>
          <article>
            <span>02</span>
            <strong>Preview the renter experience</strong>
            <p>See the same listing card and Decision Receipt a renter would see.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Prepare for future integrations</strong>
            <p>The property-software import remains a clearly labeled simulation.</p>
          </article>
        </div>
        <div className="manager-pilot-actions">
          <button className="btn-primary" onClick={onStartPilot}>
            Start free pilot
          </button>
          <button className="btn-secondary" onClick={onRequestDemo}>
            Request a demo
          </button>
          <button className="text-button secondary-text" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        {error && <p className="demo-access-error">{error}</p>}
        <div className="manager-pilot-disclosure" role="note">
          <strong>No payment collected in this prototype.</strong>
          <span>
            Subscription pricing has not been finalized. Both choices are recorded only in this
            browser.
          </span>
        </div>
      </section>
    </main>
  );
}
