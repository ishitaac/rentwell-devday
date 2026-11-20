import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildRecord, openRecord, recordAnalyses, RecordError } from "./record";
import { observation, okResult } from "./testFixtures";

const JPEG_BASE64 = btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xd9));

describe("walkthrough record", () => {
  it("round-trips photos, notes, dates, and validated results", () => {
    const { zip, record } = buildRecord({
      unitType: "apartment",
      photos: {
        p1: {
          id: "p1",
          base64: JPEG_BASE64,
          takenAt: "2026-11-20T09:41:00",
          takenAtSource: "device_exif",
          fileName: "a.jpg",
        },
      },
      slots: { A2: "p1" },
      notes: { A2: "Landlord said it will be repainted by 1/5" },
      quickChecks: { A2: "no" },
      skipped: { A6: "Locked" },
      prompts: {},
      analyses: [okResult("A2", [observation()])],
      rental: { name: "Juniper Row 4B", rent: 2100 },
      isSample: false,
      now: new Date("2026-11-20T10:00:00Z"),
    });
    expect(record.shots).toHaveLength(6);
    const opened = openRecord(zip);
    const a2 = opened.record.shots.find((s) => s.shotId === "A2");
    expect(a2).toMatchObject({
      photoFile: "photos/A2.jpg",
      renterNote: "Landlord said it will be repainted by 1/5",
      photoTakenAt: "2026-11-20T09:41:00",
      quickCheck: "no",
    });
    expect(opened.record.shots.find((s) => s.shotId === "A6")?.skipReason).toBe("Locked");
    expect(opened.photoUrls.A2).toBe(`data:image/jpeg;base64,${JPEG_BASE64}`);
    expect(recordAnalyses(opened.record)).toHaveLength(1);
    expect(opened.record.rental).toEqual({ name: "Juniper Row 4B", rent: 2100 });
  });

  it("re-validates imported results so a tampered file cannot carry a verdict", () => {
    const tampered = {
      format: "rentwell-walkthrough",
      unitType: "apartment",
      shots: [
        {
          shotId: "A2",
          analysis: {
            state: "ok",
            result: {
              assessable: true,
              imageQuality: "good",
              notAssessableReason: null,
              observations: [observation({ description: "Ceiling is safe" })],
            },
          },
        },
      ],
    };
    const zip = zipSync({ "walkthrough.json": strToU8(JSON.stringify(tampered)) });
    const opened = openRecord(zip);
    expect(opened.record.shots[0].analysis).toMatchObject({ state: "failed" });
  });

  it("rejects files that are not records", () => {
    expect(() => openRecord(new Uint8Array([1, 2, 3]))).toThrow(RecordError);
    expect(() =>
      openRecord(zipSync({ "walkthrough.json": strToU8('{"format":"other"}') })),
    ).toThrow(RecordError);
  });
});
