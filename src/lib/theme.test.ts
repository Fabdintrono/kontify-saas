// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getStoredTheme, resolveTheme, setTheme, toggleTheme } from "@/lib/theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  // jsdom no implementa matchMedia: stub que reporta modo claro
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }));
});

describe("theme", () => {
  it("sin preferencia guardada devuelve null", () => {
    expect(getStoredTheme()).toBeNull();
  });
  it("setTheme('dark') guarda y aplica la clase", () => {
    setTheme("dark");
    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
  it("resolveTheme cae al sistema (claro) sin preferencia", () => {
    expect(resolveTheme()).toBe("light");
  });
  it("toggleTheme alterna y persiste", () => {
    setTheme("light");
    expect(toggleTheme()).toBe("dark");
    expect(getStoredTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
