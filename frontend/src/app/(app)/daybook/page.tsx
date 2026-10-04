"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import DayPanel from "@/components/daybook/DayPanel";
import MonthGrid from "@/components/daybook/MonthGrid";
import NoteComposer, { type NoteDraft } from "@/components/daybook/NoteComposer";
import PlanComposer, { type PlanDraft } from "@/components/daybook/PlanComposer";
import WeekGrid from "@/components/daybook/WeekGrid";
import { Alert, cx, PageLoader, Spinner } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import {
  addDays,
  bucketByDay,
  formatDay,
  formatMonth,
  formatRange,
  isOverdue,
  monthGrid,
  shiftMonth,
  todayIso,
  weekDays,
  weekStartDay,
  type Agenda,
  type CalendarSystem,
  type DayNote,
  type DaybookSettings,
  type DayView,
  type Plan,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-navy-800/10 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
            value === option.value ? "bg-white text-navy-900 shadow-sm" : "text-navy-700 hover:text-navy-900",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Chevron({ back }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={cx("size-4", back ? "rtl:-scale-x-100" : "-scale-x-100 rtl:scale-x-100")}
      fill="none"
      aria-hidden
    >
      <path d="m12.5 4.5-5 5.5 5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export default function DaybookPage() {
  const { t, locale, dir } = useI18n();
  const [settings, setSettings] = useState<DaybookSettings | null>(null);
  const [cursor, setCursor] = useState(todayIso);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [overdue, setOverdue] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);

  const today = todayIso();
  const system: CalendarSystem = settings?.calendar_system ?? "jalali";
  const view: DayView = settings?.default_view ?? "week";
  const ws = weekStartDay(locale);

  const visible = useMemo(
    () => (view === "week" ? weekDays(cursor, ws) : monthGrid(cursor, system, ws)),
    [view, cursor, system, ws],
  );
  const start = visible[0];
  const end = visible[visible.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, open] = await Promise.all([
        apiFetch<Agenda>(`/daybook/agenda/?start=${start}&end=${end}`),
        apiList<Plan>("/daybook/plans/?status=open"),
      ]);
      setAgenda(data);
      setOverdue(open.filter((plan) => isOverdue(plan)));
      setSettings((current) => current ?? data.settings);
      setError(null);
    } catch {
      setError(t("day.error"));
    } finally {
      setLoading(false);
    }
  }, [start, end, t]);

  useEffect(() => {
    load();
  }, [load]);

  const buckets = useMemo(() => bucketByDay(agenda, visible), [agenda, visible]);
  const selectedBucket = useMemo(
    () => bucketByDay(agenda, [cursor]).get(cursor) ?? { plans: [], notes: [] },
    [agenda, cursor],
  );

  const saveSettings = (patch: Partial<DaybookSettings>) => {
    setSettings((current) => ({ calendar_system: system, default_view: view, ...current, ...patch }));
    apiFetch("/daybook/settings/", { method: "PATCH", body: patch }).catch(() => undefined);
  };

  const step = useCallback(
    (delta: number) => {
      if (view === "month") setCursor((c) => shiftMonth(c, system, delta));
      else setCursor((c) => addDays(c, view === "week" ? delta * 7 : delta));
    },
    [view, system],
  );

  const openPlan = (plan: Plan, iso: string) => {
    setCursor(iso);
    setPlanDraft({ date: iso, plan });
  };
  const openNote = (note: DayNote) => {
    setCursor(note.date);
    setNoteDraft({ date: note.date, note });
  };

  const replacePlan = (plan: Plan) => {
    setAgenda((current) =>
      current ? { ...current, plans: current.plans.map((row) => (row.id === plan.id ? plan : row)) } : current,
    );
    setOverdue((current) =>
      current.map((row) => (row.id === plan.id ? plan : row)).filter((row) => isOverdue(row)),
    );
  };

  const moveToday = async (plan: Plan) => {
    await apiFetch(`/daybook/plans/${plan.id}/`, { method: "PATCH", body: { end_date: today } });
    load();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (planDraft || noteDraft || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
      const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
      const actions: Record<string, () => void> = {
        KeyN: () => setNoteDraft({ date: cursor }),
        KeyP: () => setPlanDraft({ date: cursor }),
        KeyT: () => setCursor(todayIso()),
        KeyD: () => saveSettings({ default_view: "day" }),
        KeyW: () => saveSettings({ default_view: "week" }),
        KeyM: () => saveSettings({ default_view: "month" }),
        [forward]: () => step(1),
        [backward]: () => step(-1),
      };
      const action = actions[event.code] ?? actions[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!agenda && !error) return <PageLoader />;

  const title =
    view === "month"
      ? formatMonth(cursor, system, locale)
      : view === "week"
        ? formatRange(visible[0], visible[6], system, locale, t("day.to"))
        : formatDay(cursor, system, locale);

  const panel = (
    <DayPanel
      iso={cursor}
      today={today}
      system={system}
      bucket={selectedBucket}
      overdue={overdue}
      wide={view === "day"}
      onNewPlan={() => setPlanDraft({ date: cursor })}
      onNewNote={() => setNoteDraft({ date: cursor })}
      onPlanChange={replacePlan}
      onEditPlan={(plan) => setPlanDraft({ date: cursor, plan })}
      onOpenNote={(note) => setNoteDraft({ date: note.date, note })}
      onMoveToday={moveToday}
    />
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-10 text-navy-900">{t("day.title")}</h1>
          <p className="text-sm text-gray-500">{t("day.subtitle")}</p>
        </div>
        <Segmented<CalendarSystem>
          value={system}
          onChange={(value) => saveSettings({ calendar_system: value })}
          options={[
            { value: "jalali", label: t("day.jalali") },
            { value: "gregorian", label: t("day.gregorian") },
          ]}
        />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(todayIso())}
            className="rounded-xl border border-gray-300 px-4 py-1.5 text-sm font-medium text-navy-800 transition hover:border-navy-700 hover:bg-surface"
          >
            {t("day.today")}
          </button>
          <div className="flex">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t("day.prev")}
              className="rounded-lg p-2 text-navy-800 transition hover:bg-surface"
            >
              <Chevron back />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t("day.next")}
              className="rounded-lg p-2 text-navy-800 transition hover:bg-surface"
            >
              <Chevron />
            </button>
          </div>
          <h2 className="truncate text-lg font-bold text-navy-900">{title}</h2>
          {loading ? <Spinner className="size-4 text-gray-400" /> : null}
        </div>
        <Segmented<DayView>
          value={view}
          onChange={(value) => saveSettings({ default_view: value })}
          options={[
            { value: "day", label: t("day.viewDay") },
            { value: "week", label: t("day.viewWeek") },
            { value: "month", label: t("day.viewMonth") },
          ]}
        />
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {view === "day" ? (
        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-28 lg:w-[300px]">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="mb-2 px-1 text-sm font-bold text-navy-900">{formatMonth(cursor, system, locale)}</p>
              <MonthGrid
                compact
                days={visible}
                anchor={cursor}
                system={system}
                selected={cursor}
                today={today}
                buckets={buckets}
                onSelect={setCursor}
              />
            </div>
            <p className="px-1 text-[11px] leading-6 text-gray-400">{t("day.shortcuts")}</p>
          </aside>
          <div className="w-full min-w-0 flex-1">{panel}</div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-5 xl:flex-row">
          <div className="w-full min-w-0 flex-1">
            {view === "month" ? (
              <MonthGrid
                days={visible}
                anchor={cursor}
                system={system}
                selected={cursor}
                today={today}
                buckets={buckets}
                onSelect={setCursor}
                onOpenPlan={openPlan}
                onOpenNote={openNote}
                onCreate={(iso) => {
                  setCursor(iso);
                  setPlanDraft({ date: iso });
                }}
              />
            ) : (
              <WeekGrid
                days={visible}
                system={system}
                selected={cursor}
                today={today}
                buckets={buckets}
                onSelect={setCursor}
                onOpenPlan={openPlan}
                onOpenNote={openNote}
                onCreate={(iso) => {
                  setCursor(iso);
                  setPlanDraft({ date: iso });
                }}
              />
            )}
            <p className="mt-2 px-1 text-[11px] text-gray-400 max-md:hidden">{t("day.shortcuts")}</p>
          </div>
          <aside className="w-full shrink-0 xl:sticky xl:top-28 xl:w-[400px]">{panel}</aside>
        </div>
      )}

      <PlanComposer
        draft={planDraft}
        system={system}
        weekStart={ws}
        onClose={() => setPlanDraft(null)}
        onSaved={() => {
          setPlanDraft(null);
          load();
        }}
        onDeleted={() => {
          setPlanDraft(null);
          load();
        }}
      />
      <NoteComposer
        draft={noteDraft}
        system={system}
        onClose={() => setNoteDraft(null)}
        onSaved={() => {
          setNoteDraft(null);
          load();
        }}
        onDeleted={() => {
          setNoteDraft(null);
          load();
        }}
      />
    </div>
  );
}
