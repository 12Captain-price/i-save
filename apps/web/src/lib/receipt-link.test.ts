import { describe, expect, it } from "vitest";
import { isReceiptId, verifyUrl } from "./receipt-link";

describe("isReceiptId", () => {
  it("accepts a UUID and refuses anything else", () => {
    expect(isReceiptId("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b")).toBe(true);
    expect(isReceiptId("RCT-00000004")).toBe(false);
    expect(isReceiptId("")).toBe(false);
    expect(isReceiptId("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'; drop")).toBe(false);
  });
});

describe("verifyUrl", () => {
  it("builds the address printed on the receipt", () => {
    expect(verifyUrl("abc", "https://i-save.example.com/")).toBe(
      "https://i-save.example.com/verify/abc",
    );
  });
});
