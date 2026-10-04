"use client";

import { cx } from "@/components/ui";
import {
  dayParts,
  digits,
  monthName,
  noteText,
  tint,
  weekdayName,
  type CalendarSystem,
  type DayBucket,
  type DayNote,
  type Plan,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export default function WeekGrid({
  days,
  system,
  selected,
  today,
  buckets,
  onSelect,
  onCreate,
  onOpenPlan,
  onOpenNote,
}: {
  days: string[];
  system: CalendarSystem;
  selected: string;
  today: string;
  buckets: Map<string, DayBucket>;
  onSelect: (iso: string) => void;
  onCreate: (iso: string) => void;
  onOpenPlan: (plan: Plan, iso: string) => void;
  onOpenNote: (note: DayNote) => void;
}) {
  const { t, n, locale } = useI18n();
  const other: CalendarSystem = system === "jalali" ? "gregorian" : "jalali";

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((iso, index) => {
          const bucket = buckets.get(iso) ?? { plans: [], notes: [] };
          const parts = dayParts(iso, system);
          const isToday = iso === today;
          const isSelected = iso === selected;
          return (
            <div
              key={iso}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(iso)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSelect(iso);
              }}
              className={cx(
                "group relative flex min-h-[26rem] cursor-pointer flex-col outline-none transition",
                index !== 6 && "border-e border-gray-100",
                isSelected ? "bg-navy-800/[0.04]" : "hover:bg-surface/40",
              )}
            >
              <div
                className={cx(
                  "border-b px-3 pb-2.5 pt-3",
                  isSelected ? "border-navy-800" : "border-gray-100",
                  isSelected && "border-b-2",
                )}
              >
                <p className={cx("text-xs font-medium", isToday ? "text-brand-700" : "text-gray-500")}>
                  {weekdayName(iso, locale)}
                </p>
                <div className="mt-1 flex items-end justify-between gap-1">
                  <span
                    className={cx(
                      "flex size-9 items-center justify-center rounded-full text-lg font-bold",
                      isToday ? "bg-brand-500 text-ink" : "text-navy-900",
                    )}
                  >
                    {digits(parts.day, locale)}
                  </span>
                  <span className="pb-1 text-[10px] text-gray-400">
                    {digits(dayParts(iso, other).day, locale)} {monthName(dayParts(iso, other).month, other, locale)}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 p-2">
                {bucket.plans.map((plan) => {
                  const done = plan.status === "done";
                  return (
                    <button
                      key={`p${plan.id}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenPlan(plan, iso);
                      }}
                      className="block w-full rounded-lg px-2 py-1.5 text-start transition hover:brightness-95"
                      style={{ backgroundColor: tint(plan.color, 0.12), borderInlineStart: `3px solid ${plan.color}` }}
                    >
                      <p
                        className={cx(
                          "line-clamp-2 text-xs font-semibold leading-5",
                          done ? "text-gray-400 line-through" : "text-navy-900",
                        )}
                      >
                        {plan.title}
                      </p>
                      {plan.item_total ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/80">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${plan.progress}%`, backgroundColor: done ? "#16A34A" : plan.color }}
                            />
                          </span>
                          <span className="text-[10px] tabular-nums text-gray-500">
                            {n(plan.item_done)}/{n(plan.item_total)}
                          </span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
                {bucket.notes.map((note) => (
                  <button
                    key={`n${note.id}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenNote(note);
                    }}
                    className="block w-full rounded-lg border border-gray-100 bg-card px-2 py-1.5 text-start transition hover:brightness-95"
                    style={{ borderInlineStart: `3px solid ${note.color}` }}
                  >
                    <p className="line-clamp-3 text-xs leading-5 text-gray-700">
                      {note.is_pinned ? "📌 " : ""}
                      {noteText(note)}
                    </p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCreate(iso);
                }}
                className="mx-2 mb-2 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs text-gray-500 opacity-0 transition hover:border-navy-700 hover:text-navy-800 group-hover:opacity-100"
              >
                + {t("day.newPlan")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
