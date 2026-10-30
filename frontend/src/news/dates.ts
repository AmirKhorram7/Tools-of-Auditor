import { toJalaali } from "jalaali-js";

import type { NewsLang, RangeKey } from "./types";

import { copy } from "./copy";

export const RANGE_HOURS: Record<RangeKey, number> = {
  0: 24,
  1: 168,
  2: 720,
  3: 1e9,
};

export function hoursAgo(iso: string | null) {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, (Date.now() - then) / 36e5);
}

export function dayKey(iso: string | null) {
  return Math.floor((hoursAgo(iso) + 12) / 24);
}

export function isoDaysAgo(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function dateFromRange(range: RangeKey) {
  if (range === 3) return undefined;
  if (range === 0) return isoDaysAgo(1);
  if (range === 1) return isoDaysAgo(7);
  return isoDaysAgo(30);
}

export function dayLabel(key: number, lang: NewsLang) {
  const L = copy(lang);
  if (key === 0) return L.today;
  const d = new Date(Date.now() - key * 864e5);
  return d.toLocaleDateString(lang === "fa" ? "fa-IR" : "en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatWhen(iso: string | null, lang: NewsLang) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Gregorian date+time for settings cards (always Latin calendar). */
export function formatGregorian(iso: string | null, lang: NewsLang = "en") {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", {
    calendar: "gregory",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Jalali (Shamsi) date + clock time. */
export function formatJalali(iso: string | null, lang: NewsLang = "fa") {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const j = toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const date = `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`;
  if (lang === "fa") {
    const faDate = date.replace(/\d/g, (ch) => "۰۱۲۳۴۵۶۷۸۹"[Number(ch)]);
    const faClock = clock.replace(/\d/g, (ch) => "۰۱۲۳۴۵۶۷۸۹"[Number(ch)]);
    return `${faDate} · ${faClock}`;
  }
  return `${date} · ${clock}`;
}

export function formatDual(iso: string | null, lang: NewsLang) {
  return {
    gregorian: formatGregorian(iso, lang),
    jalali: formatJalali(iso, lang),
  };
}
