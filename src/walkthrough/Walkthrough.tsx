import { useEffect, useMemo, useState } from "react";
import { analyzeShot } from "./api";
import { Analyzing, type ProgressState } from "./Analyzing";
import { Capture } from "./Capture";
import { photoSrc, PhotoError, preparePhoto } from "./image";
import { Intro } from "./Intro";
import { runLimited } from "./lib/queue";
import type { CapturedPhoto, CaptureState } from "./lib/session";
import {
  addToTray,
  assignFromTray,
  changeUnitType,
  clearSlot,
  initialCaptureState,
  placePhoto,
  removeFromTray,
  setNote,
} from "./lib/session";
import { DEFAULT_UNIT_TYPE } from "./lib/shots";
import type { ShotAnalysis, UnitType } from "./lib/types";
import { Results } from "./Results";
import { SAMPLE } from "./sample";
import { TypePicker } from "./TypePicker";
import type { RentalContext, ResultsView } from "./view";
import "./walkthrough.css";

/** Walkthrough: intro -> home type -> shot list -> analyzing -> results. Owns all state. */

type Stage = "intro" | "type" | "capture" | "analyzing" | "results";
const MAX_CONCURRENT = 3;
const SAMPLE_DELAY_MS = 1800;

interface Persisted {
  stage: Stage;
  capture: CaptureState;
  analyses: ShotAnalysis[];
  staticView: ResultsView | null;
}

// Kept in memory only, so leaving for the Decision Receipt and coming back keeps the walkthrough.
let memory: Persisted | null = null;

function liveView(
  capture: CaptureState,
  analyses: ShotAnalysis[],
  rental: RentalContext | null,
): ResultsView {
  const photoUrls: ResultsView["photoUrls"] = {};
  const takenAt: ResultsView["takenAt"] = {};
  for (const [shotId, photoId] of Object.entries(capture.slots)) {
    const photo = capture.photos[photoId];
    if (!photo) continue;
    photoUrls[shotId] = photoSrc(photo);
    takenAt[shotId] = { at: photo.takenAt, source: photo.takenAtSource };
  }
  return {
    source: "live",
    unitType: capture.unitType,
    analyses,
    photoUrls,
    takenAt,
    notes: capture.notes,
    rental: rental ? { name: rental.name, rent: rental.rent } : null,
  };
}

function sampleView(): ResultsView {
  return {
    source: "sample",
    unitType: SAMPLE.unitType,
    analyses: SAMPLE.analyses,
    photoUrls: SAMPLE.photos,
    takenAt: {},
    notes: SAMPLE.notes,
    rental: SAMPLE.rental,
    isIllustrated: SAMPLE.isIllustrated,
  };
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Photos from a view, as JPEG base64, for the saved record. Illustrations are skipped. */
function recordPhotos(view: ResultsView): {
  photos: Record<string, CapturedPhoto>;
  slots: Record<string, string>;
} {
  const photos: Record<string, CapturedPhoto> = {};
  const slots: Record<string, string> = {};
  for (const [shotId, url] of Object.entries(view.photoUrls)) {
    const match = /^data:image\/jpeg;base64,(.+)$/.exec(url);
    if (!match) continue;
    const taken = view.takenAt[shotId];
    photos[shotId] = {
      id: shotId,
      base64: match[1],
      takenAt: taken?.at ?? null,
      takenAtSource: taken?.source ?? "none",
      fileName: `${shotId}.jpg`,
    };
    slots[shotId] = shotId;
  }
  return { photos, slots };
}

export function Walkthrough({ rental = null }: { rental?: RentalContext | null }) {
  const [stage, setStage] = useState<Stage>(
    memory?.stage === "analyzing" ? "results" : (memory?.stage ?? "intro"),
  );
  const [capture, setCapture] = useState<CaptureState>(
    memory?.capture ?? initialCaptureState(DEFAULT_UNIT_TYPE),
  );
  const [analyses, setAnalyses] = useState<ShotAnalysis[]>(memory?.analyses ?? []);
  const [staticView, setStaticView] = useState<ResultsView | null>(memory?.staticView ?? null);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [preparing, setPreparing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    memory = { stage, capture, analyses, staticView };
  }, [stage, capture, analyses, staticView]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  const view = useMemo(
    () => staticView ?? liveView(capture, analyses, rental),
    [staticView, capture, analyses, rental],
  );

  const withPreparing = async <T,>(count: number, work: () => Promise<T>): Promise<T | null> => {
    setPreparing((n) => n + count);
    setError(null);
    try {
      return await work();
    } catch (err) {
      setError(
        err instanceof PhotoError ? err.message : "Could not read that photo. Try another one.",
      );
      return null;
    } finally {
      setPreparing((n) => n - count);
    }
  };

  const pickSlot = (shotId: string, file: File) =>
    withPreparing(1, async () => {
      const photo = await preparePhoto(file);
      setCapture((state) => placePhoto(state, shotId, photo));
      setAnalyses((list) => list.filter((entry) => entry.shotId !== shotId));
    });

  const bulk = (files: File[]) =>
    withPreparing(files.length, async () => {
      const settled = await Promise.allSettled(files.map(preparePhoto));
      const photos = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      setCapture((state) => addToTray(state, photos));
      if (photos.length < files.length)
        setError(`${files.length - photos.length} photo(s) couldn't be read and were skipped.`);
    });

  const chooseType = (unitType: UnitType) => {
    const change = changeUnitType(capture, unitType, false);
    if (change.kind === "needs_confirmation") {
      if (!window.confirm("Changing the home type clears the photos in your shot slots. Continue?"))
        return;
      const confirmed = changeUnitType(capture, unitType, true);
      if (confirmed.kind === "changed") {
        setCapture(confirmed.state);
        setAnalyses([]);
      }
      return;
    }
    if (change.kind === "changed") {
      setCapture(change.state);
      setAnalyses([]);
    }
  };

  const analyze = async (shotIds: string[]) => {
    setStaticView(null);
    setProgress(Object.fromEntries(shotIds.map((id) => [id, "waiting" as ProgressState])));
    setStage("analyzing");
    const unitType = capture.unitType;
    const results = await runLimited(shotIds, MAX_CONCURRENT, async (shotId) => {
      setProgress((p) => ({ ...p, [shotId]: "reading" }));
      const photo = capture.photos[capture.slots[shotId] ?? ""];
      const analysis: ShotAnalysis = photo
        ? await analyzeShot(unitType, shotId, photo.base64)
        : { shotId, state: "failed", reason: "Photo missing" };
      setProgress((p) => ({ ...p, [shotId]: analysis.state === "ok" ? "done" : "failed" }));
      return analysis;
    });
    const fresh = results.map((r, i): ShotAnalysis =>
      r.status === "fulfilled"
        ? r.value
        : { shotId: shotIds[i], state: "failed", reason: "Could not analyze" },
    );
    setAnalyses((list) => [...list.filter((entry) => !shotIds.includes(entry.shotId)), ...fresh]);
    setStage("results");
  };

  const runSample = () => {
    setProgress(
      Object.fromEntries(SAMPLE.analyses.map((a) => [a.shotId, "done" as ProgressState])),
    );
    setStaticView(sampleView());
    setStage("analyzing");
    window.setTimeout(() => setStage("results"), SAMPLE_DELAY_MS);
  };

  const openSaved = async (file: File) => {
    setError(null);
    try {
      const { openRecord, recordAnalyses } = await import("./lib/record");
      const opened = openRecord(new Uint8Array(await file.arrayBuffer()));
      const takenAt: ResultsView["takenAt"] = {};
      const notes: Record<string, string> = {};
      for (const shot of opened.record.shots) {
        takenAt[shot.shotId] = { at: shot.photoTakenAt, source: shot.photoTakenAtSource };
        if (shot.renterNote) notes[shot.shotId] = shot.renterNote;
      }
      setStaticView({
        source: "record",
        unitType: opened.record.unitType,
        analyses: recordAnalyses(opened.record),
        photoUrls: opened.photoUrls,
        takenAt,
        notes,
        rental: opened.record.rental,
        recordCreatedAt: opened.record.createdAt,
      });
      setStage("results");
    } catch (err) {
      setError(
        err instanceof Error && err.name === "RecordError"
          ? err.message
          : "That file couldn't be opened.",
      );
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const { buildRecord, recordFileName } = await import("./lib/record");
      const source =
        view.source === "live"
          ? { photos: capture.photos, slots: capture.slots }
          : recordPhotos(view);
      const { record, zip } = buildRecord({
        unitType: view.unitType,
        ...source,
        notes: view.notes,
        analyses: view.analyses,
        rental: view.rental,
        isSample: view.source === "sample",
      });
      downloadBytes(zip, recordFileName(record));
      setSaveMessage("Saved to your downloads. Keep it somewhere safe until you move out.");
    } catch {
      setSaveMessage("Couldn't create the file. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const onNote = (shotId: string, note: string) => {
    if (staticView) {
      setStaticView({ ...staticView, notes: { ...staticView.notes, [shotId]: note } });
      return;
    }
    setCapture((state) => setNote(state, shotId, note));
  };

  const startOver = () => {
    setCapture(initialCaptureState(capture.unitType));
    setAnalyses([]);
    setStaticView(null);
    setError(null);
    setSaveMessage(null);
    setStage("intro");
  };

  return (
    <main className="wt-main">
      {stage === "intro" && (
        <Intro
          rental={rental}
          error={error}
          onStart={() => setStage("type")}
          onSample={runSample}
          onOpenRecord={openSaved}
        />
      )}
      {stage === "type" && (
        <TypePicker
          value={capture.unitType}
          onChange={chooseType}
          onContinue={() => setStage("capture")}
          onBack={() => setStage("intro")}
        />
      )}
      {stage === "capture" && (
        <Capture
          state={capture}
          preparing={preparing}
          error={error}
          onPickSlot={pickSlot}
          onBulk={bulk}
          onAssign={(photoId, shotId) => {
            setCapture((state) => assignFromTray(state, photoId, shotId));
            setAnalyses((list) => list.filter((entry) => entry.shotId !== shotId));
          }}
          onClearSlot={(shotId) => {
            setCapture((state) => clearSlot(state, shotId));
            setAnalyses((list) => list.filter((entry) => entry.shotId !== shotId));
          }}
          onRemoveTray={(photoId) => setCapture((state) => removeFromTray(state, photoId))}
          onChangeType={() => setStage("type")}
          onAnalyze={() => analyze(Object.keys(capture.slots))}
        />
      )}
      {stage === "analyzing" && (
        <Analyzing
          unitType={view.unitType}
          progress={progress}
          isSample={view.source === "sample"}
        />
      )}
      {stage === "results" && (
        <Results
          view={view}
          saving={saving}
          saveMessage={saveMessage}
          onNote={onNote}
          onRetry={(shotId) => analyze([shotId])}
          onSave={save}
          onBack={() => setStage("capture")}
          onStartOver={startOver}
        />
      )}
    </main>
  );
}
