"use client";

import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { tehranToday, type KmNode, type PlanDay, type StudyPlan, type Today } from "@/lib/knowledge";

function visibleDays(plan: StudyPlan): PlanDay[] {
  const start = tehranToday();
  const upcoming = plan.days_rows.filter((day) => day.date >= start).slice(0, 7);
  return upcoming.length > 0 ? upcoming : plan.days_rows.slice(-5);
}

export default function TodayView({
  today,
  plans,
  folders,
  onOpen,
  onCreatePlan,
  onDay,
  onShift,
  onReview,
}: {
  today: Today | null;
  plans: StudyPlan[];
  folders: KmNode[];
  onOpen: (id: number) => void;
  onCreatePlan: (title: string, start: string, days: number) => Promise<void>;
  onDay: (id: number, body: { node_id?: number | null; status?: PlanDay["status"] }) => Promise<void>;
  onShift: (id: number, days: number) => Promise<void>;
  onReview: (id: number) => Promise<void>;
}) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(tehranToday());
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);

  return (
    <div className="h-full overflow-y-auto px-3 py-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold" style={{ color: "var(--km-faint)" }}>{today?.date}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("km.today")}</h1>
        {today ? (
          <button
            type="button"
            className="mt-3 text-sm font-semibold"
            style={{ color: "var(--km-link)" }}
            onClick={() => onOpen(today.daily_note.id)}
          >
            {t("km.dailyNote")} · {today.daily_note.title}
          </button>
        ) : null}

        <section className="mt-8">
          <h2 className="text-sm font-bold">{t("km.reviews")}</h2>
          {!today || today.reviews.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: "var(--km-muted)" }}>{t("km.reviewsEmpty")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {today.reviews.map((review) => (
                <li
                  key={review.id}
                  className="flex items-center gap-3 rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-start text-sm" onClick={() => onOpen(review.node)}>
                    {review.title}
                    <span className="ms-2 text-xs" style={{ color: "var(--km-faint)" }}>+{review.step}</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{ background: "var(--km-accent)", color: "var(--km-accent-ink)" }}
                    onClick={() => void onReview(review.id)}
                  >
                    {t("km.markReview")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold">{t("km.plans")}</h2>
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              setBusy(true);
              void onCreatePlan(title.trim(), start, days).finally(() => {
                setBusy(false);
                setTitle("");
              });
            }}
          >
            <label className="min-w-40 flex-1 text-xs" style={{ color: "var(--km-muted)" }}>
              {t("km.planTitle")}
              <input className="km-field mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="text-xs" style={{ color: "var(--km-muted)" }}>
              {t("km.start")}
              <input type="date" className="km-field mt-1 rounded-lg border px-3 py-2 text-sm" value={start} onChange={(event) => setStart(event.target.value)} />
            </label>
            <label className="w-24 text-xs" style={{ color: "var(--km-muted)" }}>
              {t("km.daysCount")}
              <input type="number" min={1} max={366} className="km-field mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={days} onChange={(event) => setDays(Number(event.target.value))} />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-60"
              style={{ background: "var(--km-accent)", color: "var(--km-accent-ink)" }}
            >
              {t("km.createPlan")}
            </button>
          </form>

          <div className="mt-4 space-y-4">
            {plans.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--km-muted)" }}>{t("km.plansEmpty")}</p>
            ) : (
              plans.map((plan) => (
                <article key={plan.id} className="rounded-2xl border p-4" style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{plan.title}</h3>
                    <span className="text-xs" style={{ color: "var(--km-muted)" }}>
                      {t("km.doneCount", { done: plan.progress.done, days: plan.progress.days })}
                    </span>
                    <span className="text-xs" style={{ color: "var(--km-muted)" }}>
                      {t("km.streak")} {plan.progress.streak}
                    </span>
                    {plan.progress.overdue > 0 ? (
                      <span className="text-xs" style={{ color: "var(--km-danger)" }}>
                        {t("km.overdue")} {plan.progress.overdue}
                      </span>
                    ) : null}
                    <span className="flex-1" />
                    <button type="button" className="text-xs" style={{ color: "var(--km-link)" }} onClick={() => void onShift(plan.id, -1)}>{t("km.shiftBack")}</button>
                    <button type="button" className="text-xs" style={{ color: "var(--km-link)" }} onClick={() => void onShift(plan.id, 1)}>{t("km.shiftForward")}</button>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {visibleDays(plan).map((day) => (
                      <li key={day.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="w-24 text-xs" style={{ color: "var(--km-faint)" }}>{day.date}</span>
                        <select
                          className="km-field max-w-40 rounded-lg border px-2 py-1 text-xs"
                          value={day.node ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            void onDay(day.id, { node_id: value ? Number(value) : null });
                          }}
                        >
                          <option value="">{t("km.none")}</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>{folder.title}</option>
                          ))}
                        </select>
                        {(["todo", "doing", "done"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => void onDay(day.id, { status })}
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: day.status === status ? "var(--km-accent)" : "var(--km-selection)",
                              color: day.status === status ? "var(--km-accent-ink)" : "var(--km-text)",
                            }}
                          >
                            {t(`km.status.${status}`)}
                          </button>
                        ))}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
