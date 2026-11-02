import { describe, expect, it } from "vitest";
import { isSafeHref, parseRichText } from "./content-text";

describe("parseRichText", () => {
  it("splits headings, paragraphs and the contact marker", () => {
    const blocks = parseRichText(
      "## Fees\nLine one\nline two\n\nSecond paragraph\n\n{{contact}}",
    );
    expect(blocks).toEqual([
      { kind: "heading", text: "Fees" },
      {
        kind: "paragraph",
        parts: [{ kind: "text", text: "Line one line two" }],
      },
      {
        kind: "paragraph",
        parts: [{ kind: "text", text: "Second paragraph" }],
      },
      { kind: "contact" },
    ]);
  });

  it("turns safe links into links and leaves unsafe ones as text", () => {
    const [safe] = parseRichText("See [Fees](/fees) now");
    expect(safe).toEqual({
      kind: "paragraph",
      parts: [
        { kind: "text", text: "See " },
        { kind: "link", label: "Fees", href: "/fees" },
        { kind: "text", text: " now" },
      ],
    });
    const [unsafe] = parseRichText("[x](javascript:alert(1))");
    expect(JSON.stringify(unsafe)).not.toContain('"kind":"link"');
  });

  it("never produces markup from angle brackets", () => {
    const [p] = parseRichText("<script>alert(1)</script>");
    expect(p).toEqual({
      kind: "paragraph",
      parts: [{ kind: "text", text: "<script>alert(1)</script>" }],
    });
  });

  it("only allows safe link targets", () => {
    expect(isSafeHref("/x")).toBe(true);
    expect(isSafeHref("https://a.b")).toBe(true);
    expect(isSafeHref("mailto:a@b.c")).toBe(true);
    expect(isSafeHref("//evil.com")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
  });
});
