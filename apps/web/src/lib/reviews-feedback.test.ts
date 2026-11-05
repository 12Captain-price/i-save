import { describe, expect, it } from "vitest";
import { validateReview } from "./review-utils";
import { validateContact, validateFeedback } from "./feedback-utils";
import { STAFF_TEMPLATES, whatsappLink } from "./whatsapp";

describe("validateReview", () => {
  const ok = {
    author_name: "Tendai Moyo",
    body: "Simple and friendly.",
    rating: 5,
  };
  it("accepts a good review", () => expect(validateReview(ok)).toBeNull());
  it("needs a name", () =>
    expect(validateReview({ ...ok, author_name: " A " })).toMatch(/name/i));
  it("needs a real sentence", () =>
    expect(validateReview({ ...ok, body: "Good" })).toMatch(/more/i));
  it("caps the length", () =>
    expect(validateReview({ ...ok, body: "x".repeat(801) })).toMatch(
      /too long/i,
    ));
  it("needs 1 to 5 stars", () => {
    expect(validateReview({ ...ok, rating: 0 })).toMatch(/star/i);
    expect(validateReview({ ...ok, rating: 6 })).toMatch(/star/i);
  });
});

describe("validateFeedback", () => {
  const ok = { subject: "Office hours", message: "Please open on Saturdays." };
  it("accepts a good message", () => expect(validateFeedback(ok)).toBeNull());
  it("needs a title", () =>
    expect(validateFeedback({ ...ok, subject: "Hi" })).toMatch(/title/i));
  it("needs a message", () =>
    expect(validateFeedback({ ...ok, message: "short" })).toMatch(/more/i));
});

describe("validateContact", () => {
  const ok = { name: "Tendai Moyo", phone: "+263 78 663 9536", email: "" };
  it("accepts a name and a phone", () =>
    expect(validateContact(ok)).toBeNull());
  it("accepts a name and an email", () =>
    expect(
      validateContact({ name: "Nia", phone: "", email: "nia@example.com" }),
    ).toBeNull());
  it("needs a name", () =>
    expect(validateContact({ ...ok, name: " " })).toMatch(/name/i));
  it("needs a way to reply", () =>
    expect(validateContact({ ...ok, phone: "" })).toMatch(
      /phone number or an email/i,
    ));
  it("rejects a bad phone", () =>
    expect(validateContact({ ...ok, phone: "12" })).toMatch(/phone/i));
  it("rejects a bad email", () =>
    expect(validateContact({ ...ok, email: "nope" })).toMatch(/email/i));
});

describe("feedback WhatsApp reply", () => {
  it("opens the member's chat with a ready message", () => {
    const text = STAFF_TEMPLATES.feedback("Tendai", "Request", "Office hours");
    const link = whatsappLink("+263786639536", text);
    expect(link).toContain("https://wa.me/263786639536?text=");
    expect(decodeURIComponent(link ?? "")).toContain("Hello Tendai");
    expect(decodeURIComponent(link ?? "")).toContain("Office hours");
  });
});
