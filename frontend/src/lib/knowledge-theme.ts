"use client";

import { useCallback, useEffect, useState } from "react";

import { tokenVars } from "@/lib/knowledge-colors";

export type KnowledgeThemeId =
  | "platform"
  | "amir"
  | "obsidian"
  | "vscode"
  | "nord"
  | "paper"
  | "daylight";

export type KnowledgeTheme = {
  id: KnowledgeThemeId;
  mode: "dark" | "light";
  nameKey: string;
  vars: Record<`--${string}`, string>;
};

const STORAGE_KEY = "ta_knowledge_theme";

function theme(
  id: KnowledgeThemeId,
  mode: "dark" | "light",
  nameKey: string,
  colors: Record<string, string>,
): KnowledgeTheme {
  const vars = { "--km-scheme": mode, ...tokenVars(mode) } as Record<`--${string}`, string>;
  for (const [key, value] of Object.entries(colors)) {
    vars[`--km-${key}`] = value;
  }
  return { id, mode, nameKey, vars };
}

/** Five dark themes and two light themes. Applied only inside Knowledge. */
export const KNOWLEDGE_THEMES: KnowledgeTheme[] = [
  theme("platform", "dark", "km.theme.platform", {
    bg: "#232f3e",
    sidebar: "#1b2631",
    panel: "#2a3644",
    elevated: "#354454",
    text: "#f3f4f6",
    muted: "#c5cbd3",
    faint: "#8b97a6",
    border: "#4d5d70",
    accent: "#ff9900",
    "accent-ink": "#1a1206",
    link: "#ffd089",
    selection: "#3d4d5f",
    danger: "#fca5a5",
  }),
  theme("amir", "dark", "km.theme.amir", {
    bg: "#100e0c",
    sidebar: "#171410",
    panel: "#1c1814",
    elevated: "#2a231c",
    text: "#f6ead7",
    muted: "#c4b09a",
    faint: "#cbbba6",
    border: "#3d342b",
    accent: "#e7a04a",
    "accent-ink": "#1a1206",
    link: "#f3c98a",
    selection: "#3c2e20",
    danger: "#e7a598",
  }),
  theme("obsidian", "dark", "km.theme.obsidian", {
    bg: "#1e1e1e",
    sidebar: "#262626",
    panel: "#202020",
    elevated: "#2b2b2b",
    text: "#dcddde",
    muted: "#a4a4a4",
    faint: "#b5b5b5",
    border: "#363636",
    accent: "#7c6aef",
    "accent-ink": "#ffffff",
    link: "#b3a6ff",
    selection: "#35304a",
    danger: "#f0a8a8",
  }),
  theme("vscode", "dark", "km.theme.vscode", {
    bg: "#1e1e1e",
    sidebar: "#252526",
    panel: "#1e1e1e",
    elevated: "#2d2d2d",
    text: "#d4d4d4",
    muted: "#9d9d9d",
    faint: "#b4b4b4",
    border: "#3c3c3c",
    accent: "#007acc",
    "accent-ink": "#ffffff",
    link: "#4fc1ff",
    selection: "#094771",
    danger: "#f48771",
  }),
  theme("nord", "dark", "km.theme.nord", {
    bg: "#2e3440",
    sidebar: "#272c36",
    panel: "#2e3440",
    elevated: "#3b4252",
    text: "#eceff4",
    muted: "#d8dee9",
    faint: "#c5d0e0",
    border: "#434c5e",
    accent: "#88c0d0",
    "accent-ink": "#2e3440",
    link: "#8fbcbb",
    selection: "#434c5e",
    danger: "#d08770",
  }),
  theme("paper", "light", "km.theme.paper", {
    bg: "#f6f1e7",
    sidebar: "#efe6d6",
    panel: "#fffdf8",
    elevated: "#fffaf2",
    text: "#1c1915",
    muted: "#6b5e4e",
    faint: "#9a8b78",
    border: "#e4d8c4",
    accent: "#c7511f",
    "accent-ink": "#fff8ec",
    link: "#9c3f18",
    selection: "#ffedcc",
    danger: "#b42318",
  }),
  theme("daylight", "light", "km.theme.daylight", {
    bg: "#eaeded",
    sidebar: "#f7f8f8",
    panel: "#ffffff",
    elevated: "#ffffff",
    text: "#0f1111",
    muted: "#565959",
    faint: "#8a8f8f",
    border: "#d5d9d9",
    accent: "#ff9900",
    "accent-ink": "#1a1206",
    link: "#007185",
    selection: "#fff4e0",
    danger: "#b42318",
  }),
];

const BY_ID = new Map(KNOWLEDGE_THEMES.map((item) => [item.id, item]));

export function knowledgeTheme(id: string | null | undefined): KnowledgeTheme {
  return BY_ID.get(id as KnowledgeThemeId) ?? BY_ID.get("platform")!;
}

export function useKnowledgeTheme() {
  const [id, setId] = useState<KnowledgeThemeId>("platform");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && BY_ID.has(stored as KnowledgeThemeId)) {
        setId(stored as KnowledgeThemeId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((next: KnowledgeThemeId) => {
    setId(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme: knowledgeTheme(id), setTheme };
}
