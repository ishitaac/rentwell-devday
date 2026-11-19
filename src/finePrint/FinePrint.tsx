import { useCallback, useEffect, useMemo, useState } from "react";
import sampleLease from "../../fixtures/sample-lease-juniper-row.txt?raw";
import { analyzeLeaseText, ApiError } from "./api";
import { Analyzing } from "./Analyzing";
import sampleAnalysis from "./data/sample-analysis.json";
import { Intake } from "./Intake";
import { withScenario } from "./lib/assemble";
import { DEFAULT_SCENARIO } from "./lib/costs";
import type { AnalysisResult, CostScenario, QuoteRef } from "./lib/types";
import { normalizeForMatch } from "./lib/verify";
import { Results } from "./Results";
import "./finePrint.css";

/** Fine Print: intake -> analyzing -> results. Owns all state; children are presentational. */

type Stage =
  | { kind: "intake" }
  | { kind: "analyzing"; isSample: boolean }
  | { kind: "results"; notice?: string }
  | { kind: "error"; code: string; message: string };

const CACHED_SAMPLE = sampleAnalysis as unknown as AnalysisResult;
const SAMPLE_DELAY_MS = 2400; // lets the three progress lines play; spec: under 8 s
const isSampleText = (text: string) => normalizeForMatch(text) === normalizeForMatch(sampleLease);

export interface DrawerState {
  clauseId: string;
  refs: QuoteRef[];
}

export function FinePrint() {
  const [stage, setStage] = useState<Stage>({ kind: "intake" });
  const [leaseText, setLeaseText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [scenario, setScenario] = useState<CostScenario>(DEFAULT_SCENARIO);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [addedQuestions, setAddedQuestions] = useState<string[]>([]);

  const view = useMemo(() => (analysis ? withScenario(analysis, scenario) : null), [analysis, scenario]);

  const showResults = (result: AnalysisResult, notice?: string) => {
    setAnalysis(result);
    setScenario(DEFAULT_SCENARIO);
    setAddedQuestions([]);
    setHighlightKey(null);
    setStage({ kind: "results", notice });
  };

  const runSample = () => {
    setLeaseText(sampleLease);
    setStage({ kind: "analyzing", isSample: true });
    window.setTimeout(() => showResults(CACHED_SAMPLE), SAMPLE_DELAY_MS);
  };

  const runLive = async (text: string) => {
    setStage({ kind: "analyzing", isSample: false });
    try {
      showResults(await analyzeLeaseText(text));
    } catch (error) {
      const apiError = error instanceof ApiError ? error : new ApiError("network", "Something went wrong.");
      if (isSampleText(text)) {
        showResults(CACHED_SAMPLE, "Live analysis wasn't available, so this is the saved analysis of the sample lease.");
        return;
      }
      setStage({ kind: "error", code: apiError.code, message: apiError.message });
    }
  };

  const highlight = useCallback((key: string | null) => {
    setHighlightKey(key);
    if (!key) return;
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-row="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage.kind]);

  if (stage.kind === "intake" || stage.kind === "error") {
    return (
      <Intake
        value={leaseText}
        onChange={setLeaseText}
        onAnalyze={() => runLive(leaseText)}
        onSample={runSample}
        error={stage.kind === "error" ? stage : null}
      />
    );
  }
  if (stage.kind === "analyzing" || !view) return <Analyzing isSample={stage.kind === "analyzing" && stage.isSample} />;

  return (
    <Results
      analysis={view}
      notice={stage.notice}
      scenario={scenario}
      onScenario={setScenario}
      highlightKey={highlightKey}
      onHighlight={highlight}
      drawer={drawer}
      onDrawer={setDrawer}
      addedQuestions={addedQuestions}
      onAddQuestion={(q) => setAddedQuestions((list) => (list.includes(q) ? list : [...list, q]))}
      onStartOver={() => {
        setAnalysis(null);
        setDrawer(null);
        setStage({ kind: "intake" });
      }}
    />
  );
}
