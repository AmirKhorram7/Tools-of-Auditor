"use client";

import { useI18n } from "@/lib/i18n";
import { MAX_TASK_PREREQUISITES, togglePrerequisiteIds } from "@/lib/work";

type Option = {
  id: number;
  title: string;
};

export default function PrerequisitePicker({
  tasks,
  selected,
  onChange,
  disabled,
}: {
  tasks: Option[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const atMax = selected.length >= MAX_TASK_PREREQUISITES;

  if (tasks.length === 0) {
    return <p className="text-xs text-gray-500">{t("work.prereqNone")}</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500">{t("work.prereqHint")}</p>
      <div className="flex flex-wrap gap-1.5">
        {tasks.map((task) => {
          const active = selected.includes(task.id);
          const locked = disabled || (!active && atMax);
          return (
            <button
              key={task.id}
              type="button"
              disabled={locked}
              onClick={() => onChange(togglePrerequisiteIds(selected, task.id))}
              className={`max-w-full rounded-full border px-2.5 py-0.5 text-xs font-semibold disabled:opacity-50 ${
                active
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-gray-200 bg-white text-navy-900"
              }`}
            >
              <span className="line-clamp-1">{task.title}</span>
            </button>
          );
        })}
      </div>
      {atMax && <p className="text-[11px] text-gray-500">{t("work.prereqMax")}</p>}
    </div>
  );
}
