"use client";

import { useCallback, useEffect, useState } from "react";

/** Seven named colours from the colour brief. Stored as token names, never hex. */
export const KM_TOKENS = [
  { id: "red", light: "#C62828", dark: "#FF8A80", mix: 25 },
  { id: "orange", light: "#BF360C", dark: "#FFB74D", mix: 25 },
  { id: "gold", light: "#8D6E00", dark: "#FFD54F", mix: 25 },
  { id: "green", light: "#2E7D32", dark: "#81C784", mix: 25 },
  { id: "blue", light: "#1565C0", dark: "#64B5F6", mix: 25 },
  { id: "purple", light: "#6A1B9A", dark: "#CE93D8", mix: 25 },
  { id: "gray", light: "#616161", dark: "#BDBDBD", mix: 20 },
] as const;

export type KmTokenId = (typeof KM_TOKENS)[number]["id"];

const IDS = new Set<string>(KM_TOKENS.map((token) => token.id));

export function isToken(value: unknown): value is KmTokenId {
  return typeof value === "string" && IDS.has(value);
}

export function tokenVars(mode: "light" | "dark"): Record<`--k-${string}`, string> {
  const vars = {} as Record<`--k-${string}`, string>;
  for (const token of KM_TOKENS) {
    vars[`--k-${token.id}`] = mode === "dark" ? token.dark : token.light;
  }
  return vars;
}

export type EditorFont = "vazir" | "inter" | "system";
export type EditorSize = "sm" | "md" | "lg";
export type EditorLeading = "compact" | "normal" | "relaxed";

export type EditorType = {
  font: EditorFont;
  size: EditorSize;
  leading: EditorLeading;
};

const TYPE_KEY = "ta_knowledge_type";

export const EDITOR_TYPE: EditorType = { font: "vazir", size: "md", leading: "normal" };

const FONTS: Record<EditorFont, string> = {
  vazir: "var(--font-vazirmatn), Tahoma, sans-serif",
  inter: "var(--font-inter), Tahoma, sans-serif",
  system: "Tahoma, sans-serif",
};

const SIZES: Record<EditorSize, string> = { sm: "14px", md: "16px", lg: "18px" };
const LEADING: Record<EditorLeading, string> = { compact: "1.5", normal: "1.8", relaxed: "2" };

export function editorTypeStyle(value: EditorType): Record<"--km-editor-font" | "--km-editor-size" | "--km-editor-leading", string> {
  return {
    "--km-editor-font": FONTS[value.font],
    "--km-editor-size": SIZES[value.size],
    "--km-editor-leading": LEADING[value.leading],
  };
}

function readType(): EditorType {
  if (typeof window === "undefined") return EDITOR_TYPE;
  try {
    const raw = JSON.parse(window.localStorage.getItem(TYPE_KEY) ?? "") as Partial<EditorType>;
    const font = raw.font === "inter" || raw.font === "system" || raw.font === "vazir" ? raw.font : "vazir";
    const size = raw.size === "sm" || raw.size === "lg" || raw.size === "md" ? raw.size : "md";
    const leading = raw.leading === "compact" || raw.leading === "relaxed" || raw.leading === "normal" ? raw.leading : "normal";
    return { font, size, leading };
  } catch {
    return EDITOR_TYPE;
  }
}

export function useEditorType() {
  const [value, setValue] = useState<EditorType>(EDITOR_TYPE);
  useEffect(() => {
    setValue(readType());
  }, []);
  const update = useCallback((next: EditorType) => {
    setValue(next);
    try {
      window.localStorage.setItem(TYPE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  return { value, update };
}
