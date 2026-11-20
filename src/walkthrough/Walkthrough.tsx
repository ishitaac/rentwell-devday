import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeShot } from "./api";
import { sampleArt } from "./art";
import { Analyzing, type ProgressState } from "./Analyzing";
import { Capture } from "./Capture";
import { photoSrc, PhotoError, preparePhoto } from "./image";
import { Intro } from "./Intro";
import type { CapturedPhoto, CaptureState, QuickAnswer } from "./lib/session";
import {
  addToTray,
  assignFromTray,
  changeUnitType,
  clearSlot,
  initialCaptureState,
  placePhoto,
  removeFromTray,
  setNote,
  setPrompt,
  setQuickCheck,
  skipShot,
} from "./lib/session";
import { DEFAULT_UNIT_TYPE, findShot, MISC_SHOTS, tourShots } from "./lib/shots";
import type { ShotAnalysis, UnitType } from "./lib/types";
import { Results } from "./Results";
import { SAMPLE, sampleAnalysis } from "./sample";
import { Tour, type ShotStatus } from "./Tour";
import { TypePicker } from "./TypePicker";
import type { RentalContext, ResultsView } from "./view";
import type { SavedWalkthrough } from "../cloud/walkthroughs";
import "./walkthrough.css";
import "./tour.css";

/**
 * Walkthrough: intro -> home type -> guided tour (photos read in the background) -> results.
 * "Already toured?" switches to the upload list. Owns all state.
 */

type Stage = "intro" | "type" | "tour" | "capture" | "analyzing" | "results";
const SAMPLE_DELAY_MS = 1200;
const DEMO_READ_MS = 700;

interface Persisted {
  stage: Stage;
  capture: CaptureState;
  analyses: ShotAnalysis[];
  staticView: ResultsView | null;
  tourIndex: number;
  isDemo: boolean;
}

// Kept in memory only, so leaving for the Decision Receipt and coming back keeps the walkthrough.
let memory: Persisted | null = null;

const isSamplePhoto = (photo: CapturedPhoto) => photo.base64.startsWith("data:");

function liveView(
  capture: CaptureState,
  analyses: ShotAnalysis[],
  pending: string[],
  rental: RentalContext | null,
  isDemo: boolean,
): ResultsView {
  const photoUrls: ResultsView["photoUrls"] = {};
  const takenAt: ResultsView["takenAt"] = {};
  let usedSample = false;
  for (const [shotId, photoId] of Object.entries(capture.slots)) {
    const photo = capture.photos[photoId];
    if (!photo) continue;
    usedSample ||= isSamplePhoto(photo);
    photoUrls[shotId] = photoSrc(photo);
    takenAt[shotId] = { at: photo.takenAt, source: photo.takenAtSource };
  }
  return {
    source: isDemo && usedSample ? "sample" : "live",
    unitType: capture.unitType,
    analyses,
    pending,
    photoUrls,
    takenAt,
    notes: capture.notes,
    quickChecks: capture.quickChecks,
    skipped: capture.skipped,
    prompts: capture.prompts,
    rental: rental ? { name: rental.name, rent: rental.rent } : null,
    isIllustrated: usedSample,
  };
}

function sampleView(): ResultsView {
  return {
    source: "sample",
    unitType: SAMPLE.unitType,
    analyses: SAMPLE.analyses,
    pending: [],
    photoUrls: SAMPLE.photos,
    takenAt: {},
    notes: SAMPLE.notes,
    quickChecks: SAMPLE.quickChecks,
    skipped: {},
    prompts: SAMPLE.prompts,
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

/** Only real JPEGs go into a saved record; illustrations are skipped. */
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

/** A signed-in renter (Supabase). Null keeps the original download-only behaviour. */
export type WalkthroughAccount = { userId: string; displayName: string };

export function Walkthrough({
  rental = null,
  account = null,
  onSignIn,
}: {
  rental?: RentalContext | null;
  account?: WalkthroughAccount | null;
  /** Shown as "Sign in to save to your account" when accounts exist but nobody is signed in. */
  onSignIn?: () => void;
}) {
  const [stage, setStage] = useState<Stage>(
    memory?.stage === "analyzing" ? "results" : (memory?.stage ?? "intro"),
  );
  const [capture, setCapture] = useState<CaptureState>(
    memory?.capture ?? initialCaptureState(DEFAULT_UNIT_TYPE),
  );
  const [analyses, setAnalyses] = useState<ShotAnalysis[]>(memory?.analyses ?? []);
  const [pending, setPending] = useState<string[]>([]);
  const [staticView, setStaticView] = useState<ResultsView | null>(memory?.staticView ?? null);
  const [tourIndex, setTourIndex] = useState(memory?.tourIndex ?? 0);
  const [isDemo, setIsDemo] = useState(memory?.isDemo ?? false);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [preparing, setPreparing] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<SavedWalkthrough[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const accountId = account?.userId ?? null;
  // shotId -> photo id that the latest analysis belongs to, so a retake's result wins over an older one.
  const latest = useRef<Record<string, string>>({});

  useEffect(() => {
    memory = { stage, capture, analyses, staticView, tourIndex, isDemo };
  }, [stage, capture, analyses, staticView, tourIndex, isDemo]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage, tourIndex]);

  const stops = useMemo(() => [...tourShots(capture.unitType), MISC_SHOTS[0]], [capture.unitType]);

  const view = useMemo(
    () => staticView ?? liveView(capture, analyses, pending, rental, isDemo),
    [staticView, capture, analyses, pending, rental, isDemo],
  );

  const status = useMemo(() => {
    const map: Record<string, ShotStatus> = {};
    for (const entry of analyses) {
      map[entry.shotId] =
        entry.state === "failed" ? "failed" : entry.result.assessable ? "done" : "unreadable";
    }
    for (const id of pending) map[id] = "reading";
    return map;
  }, [analyses, pending]);

  const forget = (shotId: string) =>
    setAnalyses((list) => list.filter((entry) => entry.shotId !== shotId));

  const record = useCallback((analysis: ShotAnalysis, photoId: string) => {
    if (latest.current[analysis.shotId] !== photoId) return;
    setAnalyses((list) => [...list.filter((entry) => entry.shotId !== analysis.shotId), analysis]);
    setPending((list) => list.filter((id) => id !== analysis.shotId));
  }, []);

  /** Starts reading one photo in the background. */
  const read = useCallback(
    (unitType: UnitType, shotId: string, photo: CapturedPhoto, prompt?: string) => {
      latest.current[shotId] = photo.id;
      setPending((list) => (list.includes(shotId) ? list : [...list, shotId]));
      setAnalyses((list) => list.filter((entry) => entry.shotId !== shotId));
      if (isSamplePhoto(photo)) {
        const shot = findShot(unitType, shotId);
        window.setTimeout(
          () => shot && record(sampleAnalysis(unitType, shot), photo.id),
          DEMO_READ_MS,
        );
        return;
      }
      void analyzeShot(unitType, shotId, photo.base64, prompt).then((analysis) =>
        record(analysis, photo.id),
      );
    },
    [record],
  );

  const withPreparing = async (count: number, work: () => Promise<void>) => {
    setPreparing((n) => n + count);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(
        err instanceof PhotoError ? err.message : "Could not read that photo. Try another one.",
      );
    } finally {
      setPreparing((n) => n - count);
    }
  };

  /** Tour: a photo is placed and read right away. */
  const tourPhoto = (shotId: string, file: File, prompt?: string) =>
    withPreparing(1, async () => {
      const photo = await preparePhoto(file);
      setCapture((state) => placePhoto(state, shotId, photo));
      read(capture.unitType, shotId, photo, prompt ?? capture.prompts[shotId]);
    });

  const samplePhoto = (shotId: string) => {
    const shot = findShot(capture.unitType, shotId);
    if (!shot) return;
    const photo: CapturedPhoto = {
      id: `sample-${shotId}-${Date.now()}`,
      base64: sampleArt(shot.art),
      takenAt: null,
      takenAtSource: "none",
      fileName: `sample-${shotId}.svg`,
    };
    setCapture((state) => placePhoto(state, shotId, photo));
    read(capture.unitType, shotId, photo);
  };

  /** Upload list: photos are placed and read together when "Analyze photos" is tapped. */
  const pickSlot = (shotId: string, file: File) =>
    withPreparing(1, async () => {
      const photo = await preparePhoto(file);
      setCapture((state) => placePhoto(state, shotId, photo));
      forget(shotId);
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
    const apply = (state: CaptureState) => {
      setCapture(state);
      setAnalyses([]);
      setPending([]);
      setTourIndex(0);
    };
    if (change.kind === "changed") apply(change.state);
    if (change.kind !== "needs_confirmation") return;
    if (!window.confirm("Changing the home type clears the photos you've taken. Continue?")) return;
    const confirmed = changeUnitType(capture, unitType, true);
    if (confirmed.kind === "changed") apply(confirmed.state);
  };

  /** Upload list: read every assigned photo, showing progress, then show results. */
  const analyzeAll = async (shotIds: string[]) => {
    setStaticView(null);
    setProgress(Object.fromEntries(shotIds.map((id) => [id, "reading" as ProgressState])));
    setStage("analyzing");
    const unitType = capture.unitType;
    await Promise.all(
      shotIds.map(async (shotId) => {
        const photo = capture.photos[capture.slots[shotId] ?? ""];
        if (!photo) return;
        latest.current[shotId] = photo.id;
        const analysis = isSamplePhoto(photo)
          ? sampleAnalysis(unitType, findShot(unitType, shotId)!)
          : await analyzeShot(unitType, shotId, photo.base64, capture.prompts[shotId]);
        record(analysis, photo.id);
        setProgress((p) => ({ ...p, [shotId]: analysis.state === "ok" ? "done" : "failed" }));
      }),
    );
    setStage("results");
  };

  const retry = (shotId: string) => {
    const photo = capture.photos[capture.slots[shotId] ?? ""];
    if (photo) read(capture.unitType, shotId, photo, capture.prompts[shotId]);
  };

  const runSample = () => {
    setProgress(
      Object.fromEntries(SAMPLE.analyses.map((a) => [a.shotId, "done" as ProgressState])),
    );
    setStaticView(sampleView());
    setStage("analyzing");
    window.setTimeout(() => setStage("results"), SAMPLE_DELAY_MS);
  };

  const refreshSaved = useCallback(async () => {
    if (!accountId) {
      setSavedList(null);
      return;
    }
    const { listWalkthroughs } = await import("../cloud/walkthroughs");
    const list = await listWalkthroughs();
    setSavedList(list ?? []);
    setListError(list ? null : "Couldn't load your saved walkthroughs.");
  }, [accountId]);

  useEffect(() => {
    if (stage === "intro") void refreshSaved();
  }, [stage, refreshSaved]);

  const startTour = (demo: boolean) => {
    setIsDemo(demo);
    setStaticView(null);
    setTourIndex(0);
    setStage("type");
  };

  const openSaved = async (file: File) => openRecordBytes(new Uint8Array(await file.arrayBuffer()));

  const openFromAccount = async (saved: SavedWalkthrough) => {
    setError(null);
    setOpeningId(saved.id);
    try {
      const { downloadWalkthrough } = await import("../cloud/walkthroughs");
      const bytes = await downloadWalkthrough(saved.storagePath);
      if (!bytes) {
        setError("Couldn't download that walkthrough. Try again.");
        return;
      }
      await openRecordBytes(bytes);
    } finally {
      setOpeningId(null);
    }
  };

  const deleteFromAccount = async (saved: SavedWalkthrough) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this saved walkthrough from your account?")
    ) {
      return;
    }
    const { deleteWalkthrough } = await import("../cloud/walkthroughs");
    if (await deleteWalkthrough(saved)) {
      setSavedList((list) => list?.filter((item) => item.id !== saved.id) ?? null);
    } else {
      setListError("Couldn't delete that walkthrough. Try again.");
    }
  };

  const openRecordBytes = async (bytes: Uint8Array) => {
    setError(null);
    try {
      const { openRecord, recordAnalyses } = await import("./lib/record");
      const opened = openRecord(bytes);
      const takenAt: ResultsView["takenAt"] = {};
      const notes: Record<string, string> = {};
      const quickChecks: Record<string, QuickAnswer> = {};
      const skipped: Record<string, string> = {};
      const prompts: Record<string, string> = {};
      for (const shot of opened.record.shots) {
        takenAt[shot.shotId] = { at: shot.photoTakenAt, source: shot.photoTakenAtSource };
        if (shot.renterNote) notes[shot.shotId] = shot.renterNote;
        if (shot.quickCheck) quickChecks[shot.shotId] = shot.quickCheck;
        if (shot.skipReason) skipped[shot.shotId] = shot.skipReason;
        if (shot.renterPrompt) prompts[shot.shotId] = shot.renterPrompt;
      }
      setStaticView({
        source: "record",
        unitType: opened.record.unitType,
        analyses: recordAnalyses(opened.record),
        pending: [],
        photoUrls: opened.photoUrls,
        takenAt,
        notes,
        quickChecks,
        skipped,
        prompts,
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

  const save = async (target: "download" | "account" = "download") => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const { buildRecord, recordFileName } = await import("./lib/record");
      const source =
        view.source === "live"
          ? { photos: capture.photos, slots: capture.slots }
          : recordPhotos(view);
      const realPhotos = Object.fromEntries(
        Object.entries(source.photos).filter(([, photo]) => !isSamplePhoto(photo)),
      );
      const { record: saved, zip } = buildRecord({
        unitType: view.unitType,
        photos: realPhotos,
        slots: source.slots,
        notes: view.notes,
        quickChecks: view.quickChecks,
        skipped: view.skipped,
        prompts: view.prompts,
        analyses: view.analyses,
        rental: view.rental,
        isSample: view.source === "sample",
      });
      if (target === "account" && account) {
        const { uploadWalkthrough } = await import("../cloud/walkthroughs");
        const result = await uploadWalkthrough({
          userId: account.userId,
          zip,
          rentalName: saved.rental?.name ?? null,
          unitType: saved.unitType,
          photoCount: Object.keys(realPhotos).length,
          isSample: saved.isSample,
          recordedAt: saved.createdAt,
        });
        setSaveMessage(
          result.ok
            ? "Saved to your account. Reopen it any time from Walkthrough."
            : `${result.error} You can still download a copy.`,
        );
        return;
      }
      downloadBytes(zip, recordFileName(saved));
      setSaveMessage("Saved to your downloads. Keep it until you move out.");
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
    setPending([]);
    setStaticView(null);
    setTourIndex(0);
    setIsDemo(false);
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
          onStart={() => startTour(false)}
          onDemo={() => startTour(true)}
          onSample={runSample}
          onOpenRecord={openSaved}
          account={account}
          onSignIn={onSignIn}
          saved={savedList}
          savedError={listError}
          openingId={openingId}
          onOpenSaved={openFromAccount}
          onDeleteSaved={deleteFromAccount}
        />
      )}
      {stage === "type" && (
        <TypePicker
          value={capture.unitType}
          onChange={chooseType}
          onContinue={() => setStage("tour")}
          onBack={() => setStage("intro")}
        />
      )}
      {stage === "tour" && (
        <Tour
          state={capture}
          stops={stops}
          index={Math.min(tourIndex, stops.length - 1)}
          isDemo={isDemo}
          status={status}
          preparing={preparing > 0}
          error={error}
          onPhoto={tourPhoto}
          onSamplePhoto={samplePhoto}
          onQuickCheck={(shotId, answer) =>
            setCapture((state) => setQuickCheck(state, shotId, answer))
          }
          onSkip={(shotId, reason) => {
            setCapture((state) => skipShot(state, shotId, reason));
            forget(shotId);
          }}
          onPrompt={(shotId, prompt) => setCapture((state) => setPrompt(state, shotId, prompt))}
          onRemove={(shotId) => {
            setCapture((state) => clearSlot(state, shotId));
            forget(shotId);
            setPending((list) => list.filter((id) => id !== shotId));
          }}
          onGo={(index) => setTourIndex(Math.max(0, Math.min(index, stops.length - 1)))}
          onFinish={() => {
            setStaticView(null);
            setStage("results");
          }}
          onExit={() => setStage("capture")}
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
            forget(shotId);
          }}
          onClearSlot={(shotId) => {
            setCapture((state) => clearSlot(state, shotId));
            forget(shotId);
          }}
          onRemoveTray={(photoId) => setCapture((state) => removeFromTray(state, photoId))}
          onChangeType={() => setStage("type")}
          onBackToTour={() => setStage("tour")}
          onAnalyze={() => analyzeAll(Object.keys(capture.slots))}
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
          onRetry={retry}
          onSave={save}
          signedIn={Boolean(account)}
          onSignIn={onSignIn}
          onBack={() => setStage("tour")}
          onStartOver={startOver}
        />
      )}
    </main>
  );
}
