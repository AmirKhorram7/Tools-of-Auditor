"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function faDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function isoFromGregorian(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function todayJalali() {
  const now = new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function parseIso(iso: string): { jy: number; jm: number; jd: number } | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return toJalaali(year, month, day);
}

export function formatJalaliDisplay(
  iso: string | null | undefined,
  latinDigits = false,
): string {
  if (!iso) return "";
  const jalali = parseIso(iso);
  if (!jalali) return iso;
  const text = `${jalali.jy}/${pad(jalali.jm)}/${pad(jalali.jd)}`;
  return latinDigits ? text : faDigits(text);
}

export default function JalaliDateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  const { t, locale } = useI18n();
  const latin = locale === "en";
  const show = (n: string | number) => (latin ? String(n) : faDigits(n));
  const today = todayJalali();
  const selected = parseIso(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState({ jy: today.jy, jm: today.jm });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const days = useMemo(() => {
    const length = jalaaliMonthLength(cursor.jy, cursor.jm);
    const first = toGregorian(cursor.jy, cursor.jm, 1);
    const weekday = new Date(first.gy, first.gm - 1, first.gd).getDay();
    const offset = (weekday + 1) % 7;
    return { length, offset };
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    let { jy, jm } = cursor;
    jm += delta;
    if (jm < 1) {
      jm = 12;
      jy -= 1;
    }
    if (jm > 12) {
      jm = 1;
      jy += 1;
    }
    setCursor({ jy, jm });
  };

  const pick = (day: number) => {
    const gregorian = toGregorian(cursor.jy, cursor.jm, day);
    onChange(isoFromGregorian(gregorian.gy, gregorian.gm, gregorian.gd));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          const now = todayJalali();
          setCursor({ jy: now.jy, jm: now.jm });
          setOpen((current) => !current);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-start text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      >
        {value ? (
          formatJalaliDisplay(value, latin)
        ) : (
          <span className="text-gray-400">{placeholder || t("work.pickDate")}</span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full z-[70] mb-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-navy-800 hover:bg-surface"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-ink">
              {t(`work.month.${cursor.jm}`)} {show(cursor.jy)}
            </p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-navy-800 hover:bg-surface"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-gray-500">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span key={i}>{t(`work.wdShort.${i}`)}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: days.offset }).map((_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: days.length }).map((_, index) => {
              const day = index + 1;
              const isToday =
                today.jy === cursor.jy &&
                today.jm === cursor.jm &&
                today.jd === day;
              const active =
                selected?.jy === cursor.jy &&
                selected?.jm === cursor.jm &&
                selected?.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  className={cx(
                    "rounded-md py-1.5 text-sm",
                    active
                      ? "bg-brand-500 font-bold text-ink"
                      : isToday
                        ? "bg-navy-900 font-bold text-white"
                        : "text-ink hover:bg-surface",
                  )}
                >
                  {show(day)}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-navy-800"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("work.clearDate")}
            </button>
            <button
              type="button"
              className="text-xs font-medium text-link"
              onClick={() => {
                const today = todayJalali();
                const gregorian = toGregorian(today.jy, today.jm, today.jd);
                onChange(isoFromGregorian(gregorian.gy, gregorian.gm, gregorian.gd));
                setOpen(false);
              }}
            >
              {t("work.today")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
