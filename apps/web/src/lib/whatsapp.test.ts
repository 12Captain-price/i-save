import { describe, expect, it } from "vitest";
import {
  STAFF_TEMPLATES,
  assistanceMessage,
  whatsappDigits,
  whatsappLink,
} from "./whatsapp";

describe("whatsappDigits", () => {
  it("keeps only digits", () => {
    expect(whatsappDigits("+263 78 663 9536")).toBe("263786639536");
    expect(whatsappDigits("263786639536")).toBe("263786639536");
  });
  it("refuses junk", () => {
    expect(whatsappDigits("")).toBeNull();
    expect(whatsappDigits("12345")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("encodes the message", () => {
    expect(whatsappLink("+263786639536", "Hi & bye?")).toBe(
      "https://wa.me/263786639536?text=Hi%20%26%20bye%3F",
    );
  });
  it("leaves the text off when the message is empty", () => {
    expect(whatsappLink("+263786639536", "  ")).toBe(
      "https://wa.me/263786639536",
    );
  });
  it("returns null for a bad number", () => {
    expect(whatsappLink("abc", "hi")).toBeNull();
  });
});

describe("messages", () => {
  const who = { name: "Tendai Moyo", memberNumber: "ISV-0012" };
  it("member message names the member and the staff member", () => {
    expect(assistanceMessage(who, "a receipt", "Nia Dube")).toBe(
      "Hello Nia, this is Tendai Moyo (member ISV-0012). I need help with a receipt.",
    );
  });
  it("member message works with no topic or staff", () => {
    expect(assistanceMessage(who)).toBe(
      "Hello, this is Tendai Moyo (member ISV-0012). I need some help.",
    );
  });
  it("receipt message carries the receipt number", () => {
    const text = STAFF_TEMPLATES.receipt("Tendai", {
      receiptNumber: "RCT-00000004",
      amount: "20.00",
      currency: "USD",
      purposeLabel: "Monthly subscription",
      issuedOn: "2 Nov 2026",
    });
    expect(text).toContain("RCT-00000004");
    expect(text).toContain("Hello Tendai");
  });
});
