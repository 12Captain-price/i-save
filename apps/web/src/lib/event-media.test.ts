import { describe, expect, it } from "vitest";
import {
  MAX_PDF_BYTES,
  MAX_VIDEO_BYTES,
  checkEventFile,
  downloadName,
  mediaKindOf,
} from "./event-media";

describe("event media", () => {
  it("recognises pictures, videos and PDFs", () => {
    expect(mediaKindOf({ type: "image/png" })).toBe("image");
    expect(mediaKindOf({ type: "video/mp4" })).toBe("video");
    expect(mediaKindOf({ type: "application/pdf" })).toBe("pdf");
    expect(mediaKindOf({ type: "image/svg+xml" })).toBeNull();
    expect(mediaKindOf({ type: "application/zip" })).toBeNull();
  });

  it("refuses unknown types and files over the limit", () => {
    expect(checkEventFile({ type: "video/mp4", size: 1000 })).toBeNull();
    expect(checkEventFile({ type: "text/plain", size: 1 })).not.toBeNull();
    expect(
      checkEventFile({ type: "video/mp4", size: MAX_VIDEO_BYTES + 1 }),
    ).toMatch(/too large/);
    expect(
      checkEventFile({ type: "application/pdf", size: MAX_PDF_BYTES + 1 }),
    ).toMatch(/too large/);
    expect(checkEventFile({ type: "image/jpeg", size: 80_000_000 })).toBeNull();
  });

  it("builds a safe download name", () => {
    expect(
      downloadName(
        "AGM 2026: Bulawayo!",
        { path: "events/x/a.jpg", file_name: null, media_type: "image" },
        2,
      ),
    ).toBe("agm-2026-bulawayo-2.jpg");
    expect(
      downloadName(
        "AGM",
        { path: "events/x/a.pdf", file_name: "Flier (final)/v2.pdf", media_type: "pdf" },
        1,
      ),
    ).toBe("Flier finalv2.pdf");
  });
});
