import { describe, expect, it } from "vitest";
import { checkImageFile, newImagePath } from "./images";

describe("images", () => {
  it("accepts common picture types and refuses others", () => {
    expect(checkImageFile({ type: "image/jpeg", size: 1 })).toBeNull();
    expect(checkImageFile({ type: "image/webp", size: 1 })).toBeNull();
    expect(checkImageFile({ type: "application/pdf", size: 1 })).not.toBeNull();
    expect(checkImageFile({ type: "image/svg+xml", size: 1 })).not.toBeNull();
  });

  it("builds a unique path inside the folder", () => {
    const a = newImagePath("team");
    const b = newImagePath("team");
    expect(a).toMatch(/^team\/[0-9a-f-]{36}\.jpg$/);
    expect(a).not.toBe(b);
  });
});
