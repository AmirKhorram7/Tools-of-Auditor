/**
 * this idea comes from Google Calendar event-colour picker (web UI).
 * 9 + 9 + 6 circles, same order and hex values as Calendar.
 */
export const GOOGLE_CALENDAR_COLORS = [
  "#AD1457",
  "#D81B60",
  "#D50000",
  "#E67C73",
  "#F4511E",
  "#EF6C00",
  "#F09300",
  "#F6BF26",
  "#E4C441",
  "#C0CA33",
  "#7CB342",
  "#33B679",
  "#0B8043",
  "#009688",
  "#039BE5",
  "#4285F4",
  "#3F51B5",
  "#7986CB",
  "#B39DDB",
  "#9E69AF",
  "#8E24AA",
  "#795548",
  "#616161",
  "#A79B8E",
] as const satisfies readonly string[];

export const GOOGLE_CALENDAR_DEFAULT = "#1A73E8";

/** Standard work-board colours (Google Calendar palette, by meaning). */
export const BOARD_COLUMN_COLORS = {
  todo: "#4285F4",
  inProgress: "#F4511E",
  test: "#F6BF26",
  waiting: "#8E24AA",
  done: "#0B8043",
} as const;

export function normalizeHex(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return "";
}

export function parseHex(value: string): [number, number, number] | null {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function isLightHex(value: string): boolean {
  const rgb = parseHex(value);
  if (!rgb) return false;
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 165;
}

export function shadeHex(value: string, amount: number): string {
  const rgb = parseHex(value);
  if (!rgb) return value;
  const next = rgb.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel + amount))),
  );
  return `#${next.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function sameColor(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeHex(a);
  const right = normalizeHex(b);
  if (left && right) return left === right;
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}
