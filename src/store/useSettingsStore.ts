"use client";
import { create } from "zustand";
export interface Settings {
  mode: "dark" | "light";
  cardinalityDisplay: "words" | "minmax" | "arrows" | "crow" | "dots";
  accent: "violet" | "blue" | "teal" | "amber";
  contrast: "normal" | "high";
}
const defaults: Settings = {
  mode: "dark",
  cardinalityDisplay: "words",
  accent: "violet",
  contrast: "normal",
};
export const useSettingsStore = create<
  Settings & {
    setPreferences: (p: Partial<Settings>) => void;
    initialize: () => void;
  }
>((set, get) => ({
  ...defaults,
  setPreferences: (p) => {
    set(p);
    const { mode, accent, contrast, cardinalityDisplay } = get();
    try {
      localStorage.setItem(
        "er-appearance",
        JSON.stringify({ mode, accent, contrast, cardinalityDisplay }),
      );
    } catch {}
  },
  initialize: () => {
    try {
      const p = JSON.parse(localStorage.getItem("er-appearance") ?? "null");
      if (p)
        set({
          cardinalityDisplay: [
            "words",
            "minmax",
            "arrows",
            "crow",
            "dots",
          ].includes(p.cardinalityDisplay)
            ? p.cardinalityDisplay
            : "words",
          mode: p.mode === "light" ? "light" : "dark",
          accent: ["violet", "blue", "teal", "amber"].includes(p.accent)
            ? p.accent
            : "violet",
          contrast: p.contrast === "high" ? "high" : "normal",
        });
    } catch {}
  },
}));
