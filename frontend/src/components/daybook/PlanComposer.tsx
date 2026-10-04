"use client";

import { useEffect, useRef, useState } from "react";

import ColorDots from "@/components/daybook/ColorDots";
import DayDateField from "@/components/daybook/DayDateField";
import { Alert, Button, cx, Modal } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  addDays,
  DAY_COLORS,
  DEFAULT_DAY_COLOR,
  diffDays,
  formatRange,
  monthEnd,
  startOfWeek,
  type CalendarSystem,
  type Plan,
  type PlanStatus,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export type PlanDraft = { date: string; plan?: Plan };

export default function PlanComposer({
  draft,
  system,
  weekStart,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: PlanDraft | null;
  system: CalendarSystem;
  weekStart: number;
  onClose: () => void;
  onSaved: (plan: Plan) => void;
  onDeleted: (id: number) => void;
}) {
  const { t, n, locale } = useI18n();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [color, setColor] = useState(DEFAULT_DAY_COLOR);
  const [items, setItems] = useState<string[]>([]);
  const [line, setLine] = useState("");
  const [custom, setCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);
  const editing = draft?.plan;

  useEffect(() => {
    if (!draft) return;
    const plan = draft.plan;
    setTitle(plan?.title ?? "");
    setStart(plan?.start_date ?? draft.date);
    setEnd(plan?.end_date ?? draft.date);
    setColor(plan?.color ?? DEFAULT_DAY_COLOR);
    setItems([]);
    setLine("");
    setCustom(false);
    setError(null);
    window.setTimeout(() => titleRef.current?.focus(), 30);
  }, [draft]);

  if (!draft || !start || !end) return null;

  const spans = [
    { key: "day.spanDay", end: start },
    { key: "day.span3", end: addDays(start, 2) },
    { key: "day.spanWeekEnd", end: addDays(startOfWeek(start, weekStart), 6) },
    { key: "day.span7", end: addDays(start, 6) },
    { key: "day.spanMonthEnd", end: monthEnd(start, system) },
  ];
  const days = diffDays(start, end) + 1;

  const changeStart = (iso: string) => {
    const length = diffDays(start, end);
    setStart(iso);
    setEnd(addDays(iso, Math.max(0, length)));
  };

  const pushLines = (raw: string) => {
    const rows = raw.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
    if (rows.length) setItems((current) => [...current, ...rows].slice(0, 100));
    setLine("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const pending = line.trim() ? [...items, line.trim()] : items;
      const plan = editing
        ? await apiFetch<Plan>(`/daybook/plans/${editing.id}/`, {
            method: "PATCH",
            body: { title, start_date: start, end_date: end, color },
          })
        : await apiFetch<Plan>("/daybook/plans/", {
            method: "POST",
            body: { title, start_date: start, end_date: end, color, item_titles: pending },
          });
      onSaved(plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("day.error"));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: PlanStatus) => {
    if (!editing) return;
    onSaved(await apiFetch<Plan>(`/daybook/plans/${editing.id}/`, { method: "PATCH", body: { status } }));
  };

  const remove = async () => {
    if (!editing) return;
    await apiFetch(`/daybook/plans/${editing.id}/`, { method: "DELETE" });
    onDeleted(editing.id);
  };

  return (
    <Modal open title={editing ? t("day.editPlan") : t("day.newPlan")} onClose={onClose} className="max-w-xl">
      <div
        className="space-y-5"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
          }
        }}
      >
        <div className="flex items-center gap-3">
          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <input
            ref={titleRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                if (editing) save();
                else lineRef.current?.focus();
              }
            }}
            placeholder={t("day.planTitle")}
            maxLength={160}
            className="min-w-0 flex-1 border-0 bg-transparent text-xl font-bold text-navy-900 outline-none placeholder:text-gray-300"
          />
        </div>

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">{t("day.period")}</p>
            <p className="text-xs text-navy-800">
              {formatRange(start, end, system, locale, t("day.to"))} ·{" "}
              {t("day.daysCount", { count: n(days) })}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {spans.map((span) => {
              const active = !custom && span.end === end;
              return (
                <button
                  key={span.key}
                  type="button"
                  onClick={() => {
                    setCustom(false);
                    setEnd(span.end);
                  }}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-300 bg-white text-navy-800 hover:border-navy-700",
                  )}
                >
                  {t(span.key)}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setCustom(!custom)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                custom
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-dashed border-gray-400 text-navy-800 hover:border-navy-700",
              )}
            >
              {t("day.spanCustom")}
            </button>
          </div>
          {custom || editing ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] text-gray-500">{t("day.from")}</p>
                <DayDateField value={start} onChange={changeStart} system={system} />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-gray-500">{t("day.until")}</p>
                <DayDateField
                  value={end}
                  min={start}
                  onChange={(iso) => setEnd(iso < start ? start : iso)}
                  system={system}
                />
              </div>
            </div>
          ) : null}
        </section>

        {!editing ? (
          <section>
            <p className="mb-2 text-xs font-medium text-gray-500">{t("day.checklist")}</p>
            {items.length ? (
              <ul className="mb-2 space-y-1">
                {items.map((item, index) => (
                  <li key={`${index}-${item}`} className="group flex items-center gap-3 rounded-xl bg-surface/70 px-3 py-2">
                    <span className="size-[18px] shrink-0 rounded-full border-2" style={{ borderColor: color }} />
                    <span className="min-w-0 flex-1 text-sm text-ink">{item}</span>
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                      className="text-gray-300 transition hover:text-red-600"
                      aria-label={t("common.delete")}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-3 py-1.5 focus-within:border-brand-500">
              <span className="text-lg leading-none text-gray-300">+</span>
              <input
                ref={lineRef}
                value={line}
                onChange={(event) => setLine(event.target.value)}
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text");
                  if (text.includes("\n")) {
                    event.preventDefault();
                    pushLines(text);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    pushLines(line);
                  } else if (event.key === "Backspace" && !line && items.length) {
                    setItems(items.slice(0, -1));
                  }
                }}
                placeholder={t("day.itemPlaceholder")}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-gray-400"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">{t("day.itemHint")}</p>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-xs font-medium text-gray-500">{t("day.color")}</p>
          <ColorDots colors={DAY_COLORS} value={color} onChange={setColor} />
        </section>

        {editing ? (
          <section className="flex flex-wrap gap-2">
            {editing.status === "open" ? (
              <>
                <button
                  type="button"
                  onClick={() => setStatus("done")}
                  className="rounded-full border-2 border-green-600 px-3 py-1 text-xs font-medium text-green-700 transition hover:bg-green-600 hover:text-white"
                >
                  ✓ {t("day.markDone")}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("cancelled")}
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-navy-700"
                >
                  {t("day.cancelPlan")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setStatus("open")}
                className="rounded-full border border-navy-800 px-3 py-1 text-xs font-medium text-navy-800 transition hover:bg-navy-800 hover:text-white"
              >
                ↺ {t("day.reopen")}
              </button>
            )}
          </section>
        ) : null}

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
          {editing ? (
            <button type="button" onClick={remove} className="text-sm text-red-600 hover:underline">
              {t("day.deletePlan")}
            </button>
          ) : (
            <span className="text-xs text-gray-400 max-sm:hidden">{t("day.saveHint")}</span>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" loading={saving} onClick={save} disabled={!title.trim()}>
              {editing ? t("common.save") : t("day.createPlan")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
