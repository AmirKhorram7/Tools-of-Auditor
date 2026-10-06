"use client";

import DayDateField from "@/components/daybook/DayDateField";
import ChannelIcon from "@/components/reminders/ChannelIcon";
import { cx, Input } from "@/components/ui";
import type { CalendarSystem } from "@/lib/daybook";
import { CHANNELS, type ReminderChannel, type ReminderDraft } from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";

export default function SpecFields({
  draft,
  onChange,
  system,
}: {
  draft: ReminderDraft;
  onChange: (next: ReminderDraft) => void;
  system: CalendarSystem;
}) {
  const { t } = useI18n();
  const date = (draft.fixed_at || "").slice(0, 10);
  const clock = draft.fixed_at && draft.fixed_at.length >= 16 ? draft.fixed_at.slice(11, 16) : "08:00";

  const toggle = (channel: ReminderChannel) => {
    const next = draft.channels.includes(channel)
      ? draft.channels.filter((item) => item !== channel)
      : [...draft.channels, channel];
    onChange({ ...draft, channels: next.length ? next : [channel] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1.5">
        {CHANNELS.map((channel) => {
          const on = draft.channels.includes(channel);
          return (
            <button
              key={channel}
              type="button"
              onClick={() => toggle(channel)}
              className={cx(
                "flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-[11px] font-medium transition",
                on
                  ? "border-navy-900 bg-navy-900 text-white shadow-sm"
                  : "border-gray-200 bg-white text-navy-800 hover:border-navy-700",
              )}
            >
              <ChannelIcon channel={channel} className="size-6" />
              {t(`rem.ch.${channel}`)}
            </button>
          );
        })}
      </div>

      <div className="inline-flex w-full rounded-xl bg-navy-800/10 p-1">
        {(["before", "at"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...draft, mode })}
            className={cx(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              draft.mode === mode ? "bg-white text-navy-900 shadow-sm" : "text-navy-700 hover:text-navy-900",
            )}
          >
            {t(`rem.mode.${mode}`)}
          </button>
        ))}
      </div>

      {draft.mode === "before" ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">{t("rem.daysBefore")}</span>
            <Input
              type="number"
              min={0}
              max={60}
              dir="ltr"
              value={draft.offset_days}
              onChange={(event) => onChange({ ...draft, offset_days: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">{t("rem.atHour")}</span>
            <Input
              type="time"
              dir="ltr"
              value={draft.at_time}
              onChange={(event) => onChange({ ...draft, at_time: event.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">{t("day.date")}</p>
            <DayDateField
              value={date}
              system={system}
              onChange={(iso) => onChange({ ...draft, fixed_at: `${iso}T${clock}:00` })}
            />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-500">{t("rem.atHour")}</span>
            <Input
              type="time"
              dir="ltr"
              value={clock}
              onChange={(event) => onChange({ ...draft, fixed_at: `${date || "1970-01-01"}T${event.target.value}:00` })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
