"use client";

import { cx } from "@/components/ui";
import {
  dayParts,
  digits,
  noteText,
  sameMonth,
  tint,
  weekdayName,
  type CalendarSystem,
  type DayBucket,
  type DayNote,
  type Plan,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

const MAX_CHIPS = 3;

export default function MonthGrid({
  days,
  anchor,
  system,
  selected,
  today,
  buckets,
  onSelect,
  onCreate,
  onOpenPlan,
  onOpenNote,
  compact = false,
}: {
  days: string[];
  anchor: string;
  system: CalendarSystem;
  selected: string;
  today: string;
  buckets: Map<string, DayBucket>;
  onSelect: (iso: string) => void;
  onCreate?: (iso: string) => void;
  onOpenPlan?: (plan: Plan, iso: string) => void;
  onOpenNote?: (note: DayNote) => void;
  compact?: boolean;
}) {
  const { t, n, locale } = useI18n();
  const other: CalendarSystem = system === "jalali" ? "gregorian" : "jalali";

  return (
    <div className={cx(!compact && "overflow-hidden rounded-2xl border border-gray-200 bg-white")}>
      <div className={cx("grid grid-cols-7", !compact && "border-b border-gray-200 bg-surface/60")}>
        {days.slice(0, 7).map((iso) => (
          <span
            key={iso}
            className={cx(
              "text-center font-medium text-gray-500",
              compact ? "py-1 text-[11px]" : "py-2.5 text-xs",
            )}
          >
            {weekdayName(iso, locale, compact)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((iso, index) => {
          const bucket = buckets.get(iso) ?? { plans: [], notes: [] };
          const inMonth = sameMonth(iso, anchor, system);
          const isToday = iso === today;
          const isSelected = iso === selected;
          const day = dayParts(iso, system).day;

          if (compact) {
            const dots = [...bucket.plans.map((p) => p.color), ...bucket.notes.map((x) => x.color)].slice(0, 3);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSelect(iso)}
                className={cx(
                  "flex h-10 flex-col items-center justify-center rounded-lg text-sm transition",
                  isSelected
                    ? "bg-navy-900 font-bold text-white"
                    : isToday
                      ? "font-bold text-brand-700"
                      : inMonth
                        ? "text-ink hover:bg-surface"
                        : "text-gray-300 hover:bg-surface",
                )}
              >
                {digits(day, locale)}
                <span className="mt-0.5 flex h-1 gap-0.5">
                  {dots.map((color, i) => (
                    <span key={i} className="size-1 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </span>
              </button>
            );
          }

          const chips = [
            ...bucket.plans.map((plan) => ({
              key: `p${plan.id}`,
              color: plan.color,
              label: plan.title,
              done: plan.status === "done",
              plan: true,
              open: () => onOpenPlan?.(plan, iso),
            })),
            ...bucket.notes.map((note) => ({
              key: `n${note.id}`,
              color: note.color,
              label: noteText(note),
              done: false,
              plan: false,
              open: () => onOpenNote?.(note),
            })),
          ];
          const extra = chips.length - MAX_CHIPS;

          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(iso)}
              onDoubleClick={() => onCreate?.(iso)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelect(iso);
              }}
              className={cx(
                "group relative min-h-[7.25rem] cursor-pointer border-gray-100 p-1.5 text-start outline-none transition max-md:min-h-[4.75rem]",
                index % 7 !== 6 && "border-e",
                index < 35 && "border-b",
                inMonth ? "bg-white hover:bg-surface/50" : "bg-gray-50/70",
                isSelected && "z-[1] ring-2 ring-inset ring-navy-800",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={cx(
                    "flex size-7 items-center justify-center rounded-full text-[13px]",
                    isToday
                      ? "bg-brand-500 font-bold text-ink"
                      : inMonth
                        ? "font-semibold text-navy-900"
                        : "text-gray-400",
                  )}
                >
                  {digits(day, locale)}
                </span>
                <span className="text-[10px] tabular-nums text-gray-400 max-md:hidden">
                  {digits(dayParts(iso, other).day, locale)}
                </span>
              </div>
              <div className="space-y-1 max-md:hidden">
                {chips.slice(0, MAX_CHIPS).map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      chip.open();
                    }}
                    className={cx(
                      "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-start text-[11.5px] leading-5 transition hover:brightness-95",
                      chip.done ? "text-gray-400 line-through" : "text-navy-900",
                    )}
                    style={{
                      backgroundColor: tint(chip.color, chip.plan ? 0.14 : 0.07),
                      borderInlineStart: `3px solid ${chip.color}`,
                    }}
                  >
                    {chip.plan ? null : <span aria-hidden>✎</span>}
                    <span className="truncate">{chip.label}</span>
                  </button>
                ))}
                {extra > 0 ? (
                  <p className="px-1 text-[11px] font-medium text-gray-500">{t("day.more", { count: n(extra) })}</p>
                ) : null}
              </div>
              {chips.length ? (
                <div className="mt-0.5 hidden gap-0.5 max-md:flex">
                  {chips.slice(0, 4).map((chip) => (
                    <span key={chip.key} className="size-1.5 rounded-full" style={{ backgroundColor: chip.color }} />
                  ))}
                </div>
              ) : null}
              {onCreate ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCreate(iso);
                  }}
                  title={t("day.newPlan")}
                  className="absolute bottom-1.5 end-1.5 flex size-6 items-center justify-center rounded-full bg-navy-900 text-sm text-white opacity-0 transition hover:bg-brand-500 hover:text-ink group-hover:opacity-100 max-md:hidden"
                >
                  +
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
