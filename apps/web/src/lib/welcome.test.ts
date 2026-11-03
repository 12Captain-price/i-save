import { beforeEach, describe, expect, it } from "vitest";
import {
  firstNameOf,
  greetingFor,
  markWelcomePending,
  takeWelcomePending,
  warmLineFor,
} from "./welcome";

describe("welcome helpers", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the welcome once per login", () => {
    expect(takeWelcomePending()).toBe(false);
    markWelcomePending();
    expect(takeWelcomePending()).toBe(true);
    expect(takeWelcomePending()).toBe(false);
  });

  it("greets by time of day", () => {
    expect(greetingFor(new Date(2026, 0, 1, 8)).text).toBe("Good morning");
    expect(greetingFor(new Date(2026, 0, 1, 14)).text).toBe("Good afternoon");
    expect(greetingFor(new Date(2026, 0, 1, 19)).text).toBe("Good evening");
    expect(greetingFor(new Date(2026, 0, 1, 2)).text).toBe("Good evening");
  });

  it("uses the first name, with a friendly fallback", () => {
    expect(firstNameOf("Tanaka Moyo")).toBe("Tanaka");
    expect(firstNameOf("  ")).toBe("there");
    expect(firstNameOf(null)).toBe("there");
  });

  it("keeps the same line within a day and has separate staff lines", () => {
    const morning = new Date(Date.UTC(2026, 5, 1, 6));
    const evening = new Date(Date.UTC(2026, 5, 1, 20));
    expect(warmLineFor(morning, false)).toBe(warmLineFor(evening, false));
    expect(warmLineFor(morning, true)).not.toBe(warmLineFor(morning, false));
  });
});
