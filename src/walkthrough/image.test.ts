import { describe, expect, it } from "vitest";
import { photoSrc } from "./image";
import type { CapturedPhoto } from "./lib/session";

const photo = (base64: string, fileName = "IMG_0001.jpg"): CapturedPhoto => ({
  id: "p1",
  base64,
  takenAt: null,
  takenAtSource: "none",
  fileName,
});

describe("photoSrc", () => {
  it("wraps a real JPEG (base64 starts with /9j/) as a data URL", () => {
    expect(photoSrc(photo("/9j/4AAQSkZJRg"))).toBe("data:image/jpeg;base64,/9j/4AAQSkZJRg");
  });

  it("leaves sample photos (data or asset URLs) as they are", () => {
    expect(photoSrc(photo("data:image/svg+xml;utf8,%3Csvg", "sample-A1.svg"))).toBe(
      "data:image/svg+xml;utf8,%3Csvg",
    );
    expect(photoSrc(photo("/assets/ceiling-abc.jpg", "sample-A2.svg"))).toBe(
      "/assets/ceiling-abc.jpg",
    );
  });
});
