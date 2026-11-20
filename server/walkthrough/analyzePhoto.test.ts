import { describe, expect, it, vi } from "vitest";
import { ModelError } from "../anthropic";
import { analyzePhoto, InputError, parsePhotoRequest } from "./analyzePhoto";

const JPEG = `/9j/${"A".repeat(200)}`;
const good = {
  assessable: true,
  notAssessableReason: null,
  imageQuality: "good",
  observations: [
    {
      category: "walls_ceilings",
      finding: "concern_visible",
      severity: "priority",
      description: "Brown staining on the ceiling corner",
      locationHint: "upper left corner",
      confidence: "high",
      cannotJudge: "Whether moisture remains behind the paint",
    },
  ],
};
const banned = {
  ...good,
  observations: [{ ...good.observations[0], description: "Ceiling is safe" }],
};

describe("parsePhotoRequest", () => {
  it("accepts a valid request", () => {
    expect(
      parsePhotoRequest({ unitType: "apartment", shotId: "A2", imageBase64: JPEG }),
    ).toMatchObject({ shotId: "A2" });
  });

  it.each([
    [null],
    [{ unitType: "castle", shotId: "A2", imageBase64: JPEG }],
    [{ unitType: "apartment", shotId: "H4", imageBase64: JPEG }],
    [{ unitType: "apartment", shotId: "A2", imageBase64: "iVBORw0KGgo" + "A".repeat(200) }],
    [{ unitType: "apartment", shotId: "A2", imageBase64: "/9j/<script>" + "A".repeat(200) }],
  ])("rejects bad input %#", (body) => {
    expect(() => parsePhotoRequest(body)).toThrow(InputError);
  });
});

describe("analyzePhoto", () => {
  const request = { unitType: "apartment" as const, shotId: "A2", imageBase64: JPEG };

  it("returns a validated result", async () => {
    const vision = vi.fn().mockResolvedValue(good);
    const result = await analyzePhoto(request, vision);
    expect(result.observations[0].severity).toBe("priority");
    expect(vision).toHaveBeenCalledTimes(1);
  });

  it("retries once on a banned word, then succeeds", async () => {
    const vision = vi.fn().mockResolvedValueOnce(banned).mockResolvedValueOnce(good);
    await expect(analyzePhoto(request, vision)).resolves.toMatchObject({ shotId: "A2" });
    expect(vision).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry also uses a banned word", async () => {
    const vision = vi.fn().mockResolvedValue(banned);
    await expect(analyzePhoto(request, vision)).rejects.toBeInstanceOf(ModelError);
    expect(vision).toHaveBeenCalledTimes(2);
  });

  it("does not retry invalid output", async () => {
    const vision = vi.fn().mockResolvedValue({ nope: true });
    await expect(analyzePhoto(request, vision)).rejects.toBeInstanceOf(ModelError);
    expect(vision).toHaveBeenCalledTimes(1);
  });

  it("skips the retry when the time budget is nearly spent", async () => {
    let t = 0;
    const vision = vi.fn().mockImplementation(async () => {
      t += 20_000;
      return banned;
    });
    await expect(analyzePhoto(request, vision, () => t)).rejects.toBeInstanceOf(ModelError);
    expect(vision).toHaveBeenCalledTimes(1);
  });
});
