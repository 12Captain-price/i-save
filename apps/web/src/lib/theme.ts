import { useSyncExternalStore } from "react";

// Light / dark theme. Dark is the default look of the site; light is the same design
// with a second set of colour tokens (see styles.css). The choice is the class "light"
// on <html> and is remembered on this device. Before anyone picks, the device's own
// setting decides, and the small script in index.html applies it before the first paint
// so the page never flashes the wrong colours.

export type Theme = "light" | "dark";

export const THEME_KEY = "isave-theme";

/** Browser bar colour on phones, matching the page background of each theme. */
const BAR_COLOUR: Record<Theme, string> = { light: "#f7fafa", dark: "#0b1c24" };

const listeners = new Set<() => void>();

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** What the person chose on this device, or null if they never did. */
export function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/** The device's own light or dark setting. */
export function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** The theme on screen right now. */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light")
    ? "light"
    : "dark";
}

/** Puts a theme on the page. It does not remember it; setTheme does. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", BAR_COLOUR[theme]);
  listeners.forEach((notify) => notify());
}

/** Applies a theme and remembers it on this device. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private browsing can refuse storage. The theme still changes for this visit.
  }
  applyTheme(theme);
}

/**
 * Call once at start-up. Until someone picks a theme themselves, the site follows the
 * device setting, including when the device switches at sunset.
 */
export function initTheme(): void {
  applyTheme(storedTheme() ?? systemTheme());
  if (typeof window.matchMedia !== "function") return;
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (storedTheme() === null) applyTheme(systemTheme());
    });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** The current theme and a way to change it. Re-renders when the theme changes. */
export function useTheme(): {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
} {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    currentTheme,
    () => "dark",
  );
  return {
    theme,
    setTheme,
    toggle: () => setTheme(currentTheme() === "light" ? "dark" : "light"),
  };
}
