import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  THEME_KEY,
  applyTheme,
  currentTheme,
  isTheme,
  setTheme,
  storedTheme,
} from "./theme";

describe("theme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.style.colorScheme = "";
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("only accepts the two known themes", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("is dark until the light class is on the page", () => {
    expect(currentTheme()).toBe("dark");
    applyTheme("light");
    expect(currentTheme()).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    applyTheme("dark");
    expect(currentTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("remembers what the person picked", () => {
    expect(storedTheme()).toBeNull();
    setTheme("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(storedTheme()).toBe("light");
  });

  it("ignores a stored value it does not recognise", () => {
    localStorage.setItem(THEME_KEY, "purple");
    expect(storedTheme()).toBeNull();
  });

  it("updates the phone browser bar colour", () => {
    document.head.innerHTML = '<meta name="theme-color" content="#0b1c24">';
    applyTheme("light");
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content"),
    ).toBe("#f7fafa");
  });
});
