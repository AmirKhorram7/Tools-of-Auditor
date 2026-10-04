import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

import { CARD_COLORS } from "@/lib/explanation";
import type { Locale } from "@/lib/i18n";

export type CalendarSystem = "jalali" | "gregorian";
export type DayView = "day" | "week" | "month";

export type DaybookSettings = {
  calendar_system: CalendarSystem;
  default_view: DayView;
};

export type DayNote = {
  id: number;
  date: string;
  title: string;
  body: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanItem = {
  id: number;
  title: string;
  is_done: boolean;
  done_at: string | null;
  position: number;
};

export type PlanStatus = "open" | "done" | "cancelled";

export type Plan = {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  color: string;
  status: PlanStatus;
  closed_at: string | null;
  item_total: number;
  item_done: number;
  progress: number;
  items: PlanItem[];
  created_at: string;
};

export type Agenda = {
  start: string;
  end: string;
  settings: DaybookSettings;
  notes: DayNote[];
  plans: Plan[];
};

/* ---- colours: the تشریح سیستم card palette ---- */

export type DayColor = { hex: string; label: string; labelEn: string };

export const DAY_COLORS: DayColor[] = [
  ...CARD_COLORS.filter((c) => c.key === "navy"),
  ...CARD_COLORS.filter((c) => c.key !== "navy" && c.key !== "default"),
].map((c) => ({ hex: c.bg.toUpperCase(), label: c.label, labelEn: c.labelEn }));

export const DEFAULT_DAY_COLOR = DAY_COLORS[0].hex;

/** Text colours offered in the note editor: ink plus the card palette. */
export const TEXT_COLORS: DayColor[] = [
  { hex: "#0F1111", label: "مشکی", labelEn: "Ink" },
  { hex: "#C7511F", label: "نارنجی برند", labelEn: "Brand" },
  ...DAY_COLORS,
];

/** `#RRGGBB` + alpha byte, for soft tinted backgrounds. */
export function tint(hex: string, alpha = 0.12): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

/* ---- ISO day helpers (always Gregorian YYYY-MM-DD, local time) ---- */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function todayIso(): string {
  return isoOf(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

export function diffDays(from: string, to: string): number {
  return Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000);
}

export function weekday(iso: string): number {
  return fromIso(iso).getDay();
}

/** Saturday for Farsi, Monday for English. */
export function weekStartDay(locale: Locale): number {
  return locale === "fa" ? 6 : 1;
}

export function startOfWeek(iso: string, startDay: number): string {
  return addDays(iso, -((weekday(iso) - startDay + 7) % 7));
}

export function weekDays(iso: string, startDay: number): string[] {
  const first = startOfWeek(iso, startDay);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

export function dayParts(iso: string, system: CalendarSystem) {
  const date = fromIso(iso);
  if (system === "gregorian") {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  const j = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return { year: j.jy, month: j.jm, day: j.jd };
}

export function monthStart(iso: string, system: CalendarSystem): string {
  const { year, month } = dayParts(iso, system);
  if (system === "gregorian") return `${year}-${pad(month)}-01`;
  const g = toGregorian(year, month, 1);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export function monthLength(iso: string, system: CalendarSystem): number {
  const { year, month } = dayParts(iso, system);
  if (system === "gregorian") return new Date(year, month, 0).getDate();
  return jalaaliMonthLength(year, month);
}

export function monthEnd(iso: string, system: CalendarSystem): string {
  return addDays(monthStart(iso, system), monthLength(iso, system) - 1);
}

export function shiftMonth(iso: string, system: CalendarSystem, delta: number): string {
  let { year, month } = dayParts(iso, system);
  month += delta;
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  if (system === "gregorian") return `${year}-${pad(month)}-01`;
  const g = toGregorian(year, month, 1);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

/** 6×7 grid that always contains the whole month. */
export function monthGrid(iso: string, system: CalendarSystem, startDay: number): string[] {
  const first = startOfWeek(monthStart(iso, system), startDay);
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export function sameMonth(a: string, b: string, system: CalendarSystem): boolean {
  const x = dayParts(a, system);
  const y = dayParts(b, system);
  return x.year === y.year && x.month === y.month;
}

/* ---- labels ---- */

const JALALI_MONTHS_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const JALALI_MONTHS_EN = [
  "Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
  "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand",
];
const GREGORIAN_MONTHS_FA = [
  "ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن",
  "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر",
];
const GREGORIAN_MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const WEEKDAYS_FA_SHORT = ["ی", "د", "س", "چ", "پ", "ج", "ش"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function digits(value: number | string, locale: Locale): string {
  const text = String(value);
  return locale === "fa" ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]) : text;
}

export function monthName(month: number, system: CalendarSystem, locale: Locale): string {
  if (system === "jalali") return (locale === "fa" ? JALALI_MONTHS_FA : JALALI_MONTHS_EN)[month - 1];
  return (locale === "fa" ? GREGORIAN_MONTHS_FA : GREGORIAN_MONTHS_EN)[month - 1];
}

export function weekdayName(iso: string, locale: Locale, short = false): string {
  const index = weekday(iso);
  if (locale === "fa") return short ? WEEKDAYS_FA_SHORT[index] : WEEKDAYS_FA[index];
  const name = WEEKDAYS_EN[index];
  return short ? name.slice(0, 3) : name;
}

/** "۱۲ مهر ۱۴۰۵" / "4 October 2026" (year optional). */
/** Local clock of an ISO timestamp, e.g. ۱۴:۳۲ / 14:32. */
export function formatClock(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale === "fa" ? "fa-IR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(iso: string, system: CalendarSystem, locale: Locale, withYear = true): string {
  const { year, month, day } = dayParts(iso, system);
  const text = `${digits(day, locale)} ${monthName(month, system, locale)}`;
  return withYear ? `${text} ${digits(year, locale)}` : text;
}

export function formatMonth(iso: string, system: CalendarSystem, locale: Locale): string {
  const { year, month } = dayParts(iso, system);
  return `${monthName(month, system, locale)} ${digits(year, locale)}`;
}

/** "۱۲ تا ۱۸ مهر" — collapses the month when both ends share it. */
export function formatRange(
  start: string,
  end: string,
  system: CalendarSystem,
  locale: Locale,
  to: string,
): string {
  if (start === end) return formatDay(start, system, locale, false);
  const a = dayParts(start, system);
  const b = dayParts(end, system);
  if (a.year === b.year && a.month === b.month) {
    return `${digits(a.day, locale)} ${to} ${digits(b.day, locale)} ${monthName(b.month, system, locale)}`;
  }
  return `${formatDay(start, system, locale, false)} ${to} ${formatDay(end, system, locale, false)}`;
}

/* ---- grouping ---- */

export type DayBucket = { plans: Plan[]; notes: DayNote[] };

export function bucketByDay(agenda: Agenda | null, days: string[]): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>(days.map((d) => [d, { plans: [], notes: [] }]));
  if (!agenda) return map;
  for (const plan of agenda.plans) {
    for (const day of days) {
      if (day >= plan.start_date && day <= plan.end_date) map.get(day)?.plans.push(plan);
    }
  }
  for (const note of agenda.notes) map.get(note.date)?.notes.push(note);
  for (const bucket of map.values()) {
    bucket.notes.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
    bucket.plans.sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  }
  return map;
}

export function noteText(note: DayNote): string {
  const body = note.body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return note.title || body;
}

export function isOverdue(plan: Plan, today = todayIso()): boolean {
  return plan.status === "open" && plan.end_date < today;
}
