"use client";

import { useState } from "react";

import CreatedAt from "@/components/daybook/CreatedAt";
import { cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  formatRange,
  isOverdue,
  tint,
  type CalendarSystem,
  type Plan,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

function Check({ done, color }: { done: boolean; color: string }) {
  return (
    <span
      className={cx(
        "flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition",
        done ? "border-green-600 bg-green-600 text-white" : "bg-white group-hover:bg-gray-50",
      )}
      style={done ? undefined : { borderColor: color }}
    >
      {done ? (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

export default function PlanCard({
  plan,
  system,
  onChange,
  onEdit,
  onMoveToday,
}: {
  plan: Plan;
  system: CalendarSystem;
  onChange: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
  onMoveToday?: (plan: Plan) => void;
}) {
  const { t, n, locale } = useI18n();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const done = plan.status === "done";
  const overdue = isOverdue(plan);
  const base = `/daybook/plans/${plan.id}`;

  const toggle = async (itemId: number, next: boolean) => {
    const items = plan.items.map((row) => (row.id === itemId ? { ...row, is_done: next } : row));
    const doneCount = items.filter((row) => row.is_done).length;
    onChange({
      ...plan,
      items,
      item_done: doneCount,
      progress: items.length ? Math.round((doneCount * 100) / items.length) : plan.progress,
    });
    try {
      onChange(await apiFetch<Plan>(`${base}/items/${itemId}/`, { method: "PATCH", body: { is_done: next } }));
    } catch {
      onChange(plan);
    }
  };

  const add = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      onChange(await apiFetch<Plan>(`${base}/items/`, { method: "POST", body: { title } }));
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (itemId: number) => {
    onChange(await apiFetch<Plan>(`${base}/items/${itemId}/`, { method: "DELETE" }));
  };

  return (
    <article
      className={cx(
        "overflow-hidden rounded-2xl border bg-white transition",
        done ? "border-green-200" : "border-gray-200 hover:shadow-[0_4px_16px_rgba(19,26,34,0.08)]",
      )}
    >
      <div className="flex items-start gap-3 px-4 pb-2 pt-3.5" style={{ backgroundColor: tint(plan.color, 0.06) }}>
        <span className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: plan.color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cx("text-[15px] font-bold leading-6", done ? "text-gray-500" : "text-navy-900")}>
              {plan.title}
            </h3>
            <button
              type="button"
              onClick={() => onEdit(plan)}
              title={t("day.editPlan")}
              className="-me-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-navy-800"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
                <circle cx="4" cy="10" r="1.6" />
                <circle cx="10" cy="10" r="1.6" />
                <circle cx="16" cy="10" r="1.6" />
              </svg>
            </button>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            <span>{formatRange(plan.start_date, plan.end_date, system, locale, t("day.to"))}</span>
            <span aria-hidden>·</span>
            <CreatedAt at={plan.created_at} />
            {plan.item_total ? (
              <>
                <span aria-hidden>·</span>
                <span>{t("day.itemsDone", { done: n(plan.item_done), total: n(plan.item_total) })}</span>
              </>
            ) : null}
            {done ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">{t("day.planDone")}</span>
            ) : null}
            {overdue ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">{t("day.overdue")}</span>
            ) : null}
          </div>
          {plan.item_total ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200/80">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${plan.progress}%`, backgroundColor: done ? "#16A34A" : plan.color }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <ul className="px-2 py-1.5">
        {plan.items.map((item) => (
          <li key={item.id} className="group flex items-center gap-1 rounded-xl px-2 hover:bg-surface/70">
            <button
              type="button"
              onClick={() => toggle(item.id, !item.is_done)}
              className="flex min-w-0 flex-1 items-center gap-3 py-2 text-start"
              aria-pressed={item.is_done}
            >
              <Check done={item.is_done} color={plan.color} />
              <span
                className={cx(
                  "min-w-0 text-sm leading-6 transition",
                  item.is_done ? "text-gray-400 line-through" : "text-ink",
                )}
              >
                {item.title}
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(item.id)}
              title={t("common.delete")}
              className="rounded-md p-1 text-gray-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {plan.status !== "cancelled" ? (
        <div className="flex items-center gap-2 border-t border-gray-100 px-4 py-2">
          <span className="text-lg leading-none text-gray-300">+</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={t("day.addItem")}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-gray-400"
          />
          {overdue && onMoveToday ? (
            <button
              type="button"
              onClick={() => onMoveToday(plan)}
              className="shrink-0 rounded-full border border-brand-500 px-3 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-50"
            >
              {t("day.moveToday")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
