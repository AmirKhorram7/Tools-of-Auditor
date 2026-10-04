"use client";

import NoteCard from "@/components/daybook/NoteCard";
import PlanCard from "@/components/daybook/PlanCard";
import Percent from "@/components/education/Percent";
import { cx } from "@/components/ui";
import {
  formatDay,
  weekdayName,
  type CalendarSystem,
  type DayBucket,
  type DayNote,
  type Plan,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

function Ring({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#16A34A"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-navy-900">
        <Percent value={value} />
      </span>
    </div>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  const { n } = useI18n();
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <h3 className="text-sm font-bold text-navy-900">{title}</h3>
      {count ? (
        <span className="rounded-full bg-navy-800/10 px-2 py-0.5 text-[11px] font-medium text-navy-800">{n(count)}</span>
      ) : null}
    </div>
  );
}

export default function DayPanel({
  iso,
  today,
  system,
  bucket,
  overdue,
  wide = false,
  onNewPlan,
  onNewNote,
  onPlanChange,
  onEditPlan,
  onOpenNote,
  onMoveToday,
}: {
  iso: string;
  today: string;
  system: CalendarSystem;
  bucket: DayBucket;
  overdue: Plan[];
  wide?: boolean;
  onNewPlan: () => void;
  onNewNote: () => void;
  onPlanChange: (plan: Plan) => void;
  onEditPlan: (plan: Plan) => void;
  onOpenNote: (note: DayNote) => void;
  onMoveToday: (plan: Plan) => void;
}) {
  const { t, n, locale } = useI18n();
  const other: CalendarSystem = system === "jalali" ? "gregorian" : "jalali";
  const isToday = iso === today;
  const total = bucket.plans.reduce((sum, plan) => sum + plan.item_total, 0);
  const done = bucket.plans.reduce((sum, plan) => sum + plan.item_done, 0);
  const progress = total ? Math.round((done * 100) / total) : 0;
  const empty = !bucket.plans.length && !bucket.notes.length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white">
      <header className="flex items-center gap-4 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-gray-500">
            {weekdayName(iso, locale)}
            {isToday ? (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">
                {t("day.today")}
              </span>
            ) : null}
          </p>
          <h2 className="mt-0.5 text-[22px] font-bold leading-8 text-navy-900">{formatDay(iso, system, locale)}</h2>
          <p className="text-xs text-gray-400">{formatDay(iso, other, locale)}</p>
        </div>
        {total ? <Ring value={progress} /> : null}
      </header>

      <div className="flex gap-2 px-5 pt-4">
        <button
          type="button"
          onClick={onNewPlan}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-bold text-ink transition hover:bg-brand-700 hover:text-white"
        >
          <span className="text-base leading-none">☑</span>
          {t("day.newPlan")}
          <kbd className="rounded bg-black/10 px-1.5 text-[10px] font-medium max-md:hidden">P</kbd>
        </button>
        <button
          type="button"
          onClick={onNewNote}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-navy-800 px-3 py-2.5 text-sm font-bold text-navy-800 transition hover:bg-navy-800 hover:text-white"
        >
          <span className="text-base leading-none">✎</span>
          {t("day.newNote")}
          <kbd className="rounded bg-navy-800/10 px-1.5 text-[10px] font-medium max-md:hidden">N</kbd>
        </button>
      </div>

      <div className="space-y-6 p-5">
        {isToday && overdue.length ? (
          <div className="rounded-2xl bg-brand-50 p-3">
            <SectionTitle title={t("day.leftOver")} count={overdue.length} />
            <div className="space-y-3">
              {overdue.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  system={system}
                  onChange={onPlanChange}
                  onEdit={onEditPlan}
                  onMoveToday={onMoveToday}
                />
              ))}
            </div>
          </div>
        ) : null}

        {empty ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
            <p className="text-3xl" aria-hidden>
              🗓️
            </p>
            <p className="mt-3 text-sm font-bold text-navy-900">{t("day.emptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-6 text-gray-500">{t("day.emptyHint")}</p>
          </div>
        ) : null}

        {bucket.plans.length ? (
          <div>
            <SectionTitle title={t("day.plans")} count={bucket.plans.length} />
            {total ? (
              <p className="-mt-1 mb-3 text-xs text-gray-500">
                {t("day.itemsDone", { done: n(done), total: n(total) })}
              </p>
            ) : null}
            <div className={cx("grid gap-3", wide && "lg:grid-cols-2")}>
              {bucket.plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  system={system}
                  onChange={onPlanChange}
                  onEdit={onEditPlan}
                  onMoveToday={onMoveToday}
                />
              ))}
            </div>
          </div>
        ) : null}

        {bucket.notes.length ? (
          <div>
            <SectionTitle title={t("day.notes")} count={bucket.notes.length} />
            <div className={cx("grid gap-3", wide && "lg:grid-cols-2")}>
              {bucket.notes.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={onOpenNote} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
