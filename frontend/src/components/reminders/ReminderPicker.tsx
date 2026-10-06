"use client";

import { useEffect, useState } from "react";

import ChannelIcon from "@/components/reminders/ChannelIcon";
import Paywall from "@/components/reminders/Paywall";
import SpecFields from "@/components/reminders/SpecFields";
import { cx } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import type { CalendarSystem } from "@/lib/daybook";
import {
  emptyDraft,
  timeHm,
  toReminderBody,
  type Reminder,
  type ReminderDraft,
  type ReminderGroup,
} from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";

export default function ReminderPicker({
  targetType,
  targetId,
  system,
  draft,
  onDraft,
}: {
  targetType: "daybook.plan" | "daybook.note";
  targetId?: number;
  system: CalendarSystem;
  draft: ReminderDraft | null;
  onDraft: (next: ReminderDraft | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [groups, setGroups] = useState<ReminderGroup[]>([]);
  const [rows, setRows] = useState<Reminder[]>([]);
  const [manual, setManual] = useState(emptyDraft());

  useEffect(() => {
    apiList<ReminderGroup>("/reminders/groups/").then(setGroups).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!targetId) {
      setRows([]);
      return;
    }
    apiList<Reminder>(`/reminders/items/?target_type=${targetType}&target_id=${targetId}`)
      .then(setRows)
      .catch(() => undefined);
  }, [targetId, targetType]);

  const start = () => {
    setOpen(true);
    if (!draft) onDraft(emptyDraft());
  };

  const pickGroup = (id: number) => {
    onDraft({ ...emptyDraft(), group: id });
    setOpen(true);
  };

  const saveLive = async (body: ReminderDraft) => {
    if (!targetId) {
      onDraft(body);
      return;
    }
    try {
      const row = await apiFetch<Reminder>("/reminders/items/", {
        method: "POST",
        body: { target_type: targetType, target_id: targetId, ...toReminderBody(body) },
      });
      setRows((current) => [...current, row]);
      onDraft(null);
      setOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setPaywall(true);
    }
  };

  const remove = async (id: number) => {
    await apiFetch(`/reminders/items/${id}/`, { method: "DELETE" });
    setRows((current) => current.filter((row) => row.id !== id));
  };

  return (
    <section className="rounded-xl border border-dashed border-gray-300 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-500">{t("rem.attach")}</p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-navy-800 px-3 py-1 text-[11px] font-medium text-white"
        >
          + {t("rem.add")}
        </button>
      </div>

      {rows.length ? (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5">
              <span className="flex gap-0.5">
                {row.channels.map((channel) => (
                  <ChannelIcon key={channel} channel={channel} className="size-4" />
                ))}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-navy-800">
                {row.group_name || t(`rem.mode.${row.mode}`)}
              </span>
              <button type="button" onClick={() => remove(row.id)} className="text-gray-400 hover:text-red-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && !targetId ? (
        <div className="mt-3 space-y-3">
          {groups.length ? (
            <div className="flex flex-wrap gap-1.5">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => pickGroup(group.id)}
                  className={cx(
                    "rounded-full border px-3 py-1 text-xs",
                    draft?.group === group.id
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-300 text-navy-800",
                  )}
                >
                  {group.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onDraft({ ...manual, group: undefined })}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs",
                  draft && !draft.group ? "border-navy-900 bg-navy-900 text-white" : "border-dashed border-gray-400",
                )}
              >
                {t("rem.manual")}
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">{t("rem.manualHint")}</p>
          )}
          {draft && !draft.group ? (
            <SpecFields
              draft={manual}
              system={system}
              onChange={(next) => {
                setManual(next);
                onDraft(next);
              }}
            />
          ) : null}
          <button type="button" onClick={() => { onDraft(null); setOpen(false); }} className="text-[11px] text-gray-500">
            {t("rem.clear")}
          </button>
        </div>
      ) : null}

      {open && targetId ? (
        <div className="mt-3 space-y-3">
          {groups.length ? (
            <div className="flex flex-wrap gap-1.5">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => saveLive({ ...emptyDraft(), group: group.id })}
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs text-navy-800 hover:border-navy-700"
                >
                  {group.name}
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-[11px] font-medium text-gray-500">{t("rem.manual")}</p>
          <SpecFields draft={manual} system={system} onChange={setManual} />
          <button
            type="button"
            onClick={() => saveLive(manual)}
            className="rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white"
          >
            {t("rem.saveOne")}
          </button>
        </div>
      ) : null}

      {draft && !targetId ? (
        <p className="mt-2 text-[11px] text-navy-800">
          {draft.group
            ? t("rem.willUseGroup", { name: groups.find((g) => g.id === draft.group)?.name ?? "" })
            : t("rem.willUseManual")}
        </p>
      ) : null}

      <Paywall open={paywall} onClose={() => setPaywall(false)} />
    </section>
  );
}

export { timeHm };
