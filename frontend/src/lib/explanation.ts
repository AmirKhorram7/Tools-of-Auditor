import { isLightHex, normalizeHex, shadeHex } from "@/lib/calendarColors";
import type { ProjectStatus, ShapeType } from "@/lib/types";

/**
 * Card colours for folders and processes in تشریح سیستم.
 * Legacy named keys stay so existing cards still render. New picks store a
 * Google Calendar hex from the shared palette.
 */
export type CardColor = string;

export type CardPalette = {
  key: CardColor;
  label: string;
  labelEn: string;
  /** Card background. */
  bg: string;
  /** Card border. */
  border: string;
  /** Icon tile, rail and dot colour. */
  accent: string;
  /** Title colour that stays readable on `bg`. */
  text: string;
  /** Secondary text on the card. */
  muted: string;
  /** Slightly darker background used on hover. */
  hover: string;
};

export const CARD_COLORS: CardPalette[] = [
  {
    key: "default",
    label: "پیش‌فرض",
    labelEn: "Default",
    bg: "#ffffff",
    border: "#d7dbdf",
    accent: "#37475a",
    text: "#0f1111",
    muted: "#6b7280",
    hover: "#f2f4f5",
  },
  {
    key: "slate",
    label: "طوسی",
    labelEn: "Slate",
    bg: "#475569",
    border: "#334155",
    accent: "#1e293b",
    text: "#f8fafc",
    muted: "#cbd5e1",
    hover: "#3f4d61",
  },
  {
    key: "navy",
    label: "سرمه‌ای",
    labelEn: "Navy",
    bg: "#232f3e",
    border: "#1a2430",
    accent: "#131a22",
    text: "#ffffff",
    muted: "#c5d0dc",
    hover: "#1c2633",
  },
  {
    key: "sky",
    label: "آبی",
    labelEn: "Sky",
    bg: "#0369a1",
    border: "#075985",
    accent: "#0c4a6e",
    text: "#ffffff",
    muted: "#bae6fd",
    hover: "#025d90",
  },
  {
    key: "teal",
    label: "فیروزه‌ای",
    labelEn: "Teal",
    bg: "#0f766e",
    border: "#115e59",
    accent: "#134e4a",
    text: "#ffffff",
    muted: "#99f6e4",
    hover: "#0d6861",
  },
  {
    key: "green",
    label: "سبز",
    labelEn: "Green",
    bg: "#166534",
    border: "#14532d",
    accent: "#052e16",
    text: "#ffffff",
    muted: "#bbf7d0",
    hover: "#145a2e",
  },
  {
    key: "lime",
    label: "لیمویی",
    labelEn: "Lime",
    bg: "#4d7c0f",
    border: "#3f6212",
    accent: "#365314",
    text: "#ffffff",
    muted: "#d9f99d",
    hover: "#456e0d",
  },
  {
    key: "amber",
    label: "کهربایی",
    labelEn: "Amber",
    bg: "#b45309",
    border: "#92400e",
    accent: "#78350f",
    text: "#ffffff",
    muted: "#fde68a",
    hover: "#a34b08",
  },
  {
    key: "orange",
    label: "نارنجی",
    labelEn: "Orange",
    bg: "#c2410c",
    border: "#9a3412",
    accent: "#7c2d12",
    text: "#ffffff",
    muted: "#fed7aa",
    hover: "#b03b0b",
  },
  {
    key: "rose",
    label: "صورتی",
    labelEn: "Rose",
    bg: "#be123c",
    border: "#9f1239",
    accent: "#881337",
    text: "#ffffff",
    muted: "#fecdd3",
    hover: "#ad1037",
  },
  {
    key: "purple",
    label: "بنفش",
    labelEn: "Purple",
    bg: "#6d28d9",
    border: "#5b21b6",
    accent: "#4c1d95",
    text: "#ffffff",
    muted: "#ddd6fe",
    hover: "#6124c4",
  },
];

const BY_KEY = new Map(CARD_COLORS.map((item) => [item.key, item]));

function paletteFromHex(hex: string): CardPalette {
  const light = isLightHex(hex);
  return {
    key: hex,
    label: hex,
    labelEn: hex,
    bg: hex,
    border: shadeHex(hex, -22),
    accent: shadeHex(hex, -28),
    text: light ? "#1f1f1f" : "#ffffff",
    muted: light ? "#4b5563" : "#e5e7eb",
    hover: shadeHex(hex, -12),
  };
}

export function cardPalette(color?: string | null): CardPalette {
  const raw = color ?? "default";
  const known = BY_KEY.get(raw);
  if (known) return known;
  const hex = normalizeHex(raw);
  if (hex) return paletteFromHex(hex);
  return CARD_COLORS[0];
}

/** Persian digits for small counts shown on cards and tree nodes. */
export function faNum(value: number): string {
  return value.toLocaleString("fa-IR");
}

/* ---- /projects/tree/ payload ---- */

export type TreeStep = {
  id: number;
  title: string;
  shape_type: ShapeType;
};

export type TreeProcess = {
  id: number;
  name: string;
  color: string;
  step_count: number;
  steps: TreeStep[];
};

export type TreeFolder = {
  id: number;
  parent: number | null;
  name: string;
  company_name: string;
  status: ProjectStatus;
  color: string;
  processes: TreeProcess[];
  children: TreeFolder[];
};
