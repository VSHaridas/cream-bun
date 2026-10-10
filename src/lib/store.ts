"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "espresso" | "cream";

interface AppState {
  theme: Theme;
  shortlist: string[];
  offersSent: string[];
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleShortlist: (id: string) => void;
  isShortlisted: (id: string) => boolean;
  sendOffer: (id: string) => void;
  resetDemo: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "espresso",
      shortlist: ["cr-aarav", "cr-ishita"],
      offersSent: [],

      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      },

      toggleTheme: () => get().setTheme(get().theme === "espresso" ? "cream" : "espresso"),

      toggleShortlist: (id) =>
        set((s) => ({
          shortlist: s.shortlist.includes(id)
            ? s.shortlist.filter((x) => x !== id)
            : [...s.shortlist, id],
        })),

      isShortlisted: (id) => get().shortlist.includes(id),

      sendOffer: (id) =>
        set((s) => ({ offersSent: s.offersSent.includes(id) ? s.offersSent : [...s.offersSent, id] })),

      resetDemo: () =>
        set({ shortlist: ["cr-aarav", "cr-ishita"], offersSent: [], theme: "espresso" }),
    }),
    {
      name: "cream.session",
      partialize: (s) => ({
        theme: s.theme,
        shortlist: s.shortlist,
        offersSent: s.offersSent,
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<AppState> | undefined;
        if (typeof document !== "undefined" && stored?.theme) {
          document.documentElement.setAttribute("data-theme", stored.theme);
        }
        return { ...current, ...stored, theme: stored?.theme ?? current.theme };
      },
    },
  ),
);

export function useTheme() {
  return useApp((s) => s.theme);
}

export function useShortlist() {
  return useApp((s) => s.shortlist);
}