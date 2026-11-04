import { describe, expect, it } from "vitest";
import { isPlaceholderUrl, normalizeAgentUrl, sortAgents } from "./agent-utils";

describe("normalizeAgentUrl", () => {
  it("accepts an https link", () => {
    expect(normalizeAgentUrl("https://forms.acme.co.zw/join?ref=1")).toEqual({
      ok: true,
      value: "https://forms.acme.co.zw/join?ref=1",
    });
  });
  it("adds https:// to a bare address and trims spaces around it", () => {
    expect(normalizeAgentUrl("  forms.acme.co.zw/join ")).toEqual({
      ok: true,
      value: "https://forms.acme.co.zw/join",
    });
  });
  it("refuses empty, http, spaces inside, other schemes and bare words", () => {
    for (const bad of [
      "",
      "   ",
      "http://forms.acme.co.zw",
      "https://forms.acme.co.zw/a b",
      "javascript:alert(1)",
      "ftp://files.acme.co.zw",
      "localhost",
      "https://user:pw@acme.co.zw",
    ]) {
      expect(normalizeAgentUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe("isPlaceholderUrl", () => {
  it("spots example links only", () => {
    expect(isPlaceholderUrl("https://example.com/register/agent-1")).toBe(true);
    expect(isPlaceholderUrl("https://www.example.org/x")).toBe(true);
    expect(isPlaceholderUrl("https://notexample.com/x")).toBe(false);
    expect(isPlaceholderUrl("https://forms.acme.co.zw")).toBe(false);
    expect(isPlaceholderUrl("garbage")).toBe(false);
  });
});

describe("sortAgents", () => {
  it("orders by sort_order, then name, without changing the input", () => {
    const input = [
      { sort_order: 20, name: "B" },
      { sort_order: 10, name: "Z" },
      { sort_order: 10, name: "A" },
    ];
    expect(sortAgents(input).map((a) => a.name)).toEqual(["A", "Z", "B"]);
    expect(input[0]?.name).toBe("B");
  });
});
