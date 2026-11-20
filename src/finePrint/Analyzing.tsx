import { useEffect, useState } from "react";

const STEPS = ["Reading the fine print...", "Finding every charge...", "Checking each quote against the lease..."];
const SAMPLE_STEP_MS = 800;
const LIVE_STEP_MS = 4500;

/** State 2: progress copy while the lease is read. */
export function Analyzing({ isSample }: { isSample: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      isSample ? SAMPLE_STEP_MS : LIVE_STEP_MS,
    );
    return () => window.clearInterval(timer);
  }, [isSample]);

  return (
    <main className="fp-main">
      <section className="fp-analyzing" aria-busy="true">
        <div className="fp-spinner" aria-hidden="true" />
        <ol className="fp-steps" aria-live="polite">
          {STEPS.map((text, i) => (
            <li key={text} className={i < step ? "is-done" : i === step ? "is-active" : ""}>
              {text}
            </li>
          ))}
        </ol>
        {!isSample && <p className="fp-micro">Usually 15 to 20 seconds for a full lease.</p>}
      </section>
    </main>
  );
}
