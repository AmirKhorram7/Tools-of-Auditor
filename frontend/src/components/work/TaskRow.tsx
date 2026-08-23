"use client";

import Link from "next/link";

import { Badge } from "@/components/ui";
import DoneCheck from "@/components/work/DoneCheck";
import ProgressBar from "@/components/work/ProgressBar";
import { useI18n } from "@/lib/i18n";
import {
  formatWorkDate,
  isOverdue,
  priorityTone,
  taskStatusTone,
  workStatusLabel,
  type WorkTaskRow,
  type WorkTaskStatus,
} from "@/lib/work";

export default function TaskRow({
  task,
  busy,
  onToggleDone,
}: {
  task: Pick<
    WorkTaskRow,
    | "id"
    | "title"
    | "status"
    | "priority"
    | "due_date"
    | "project_name"
    | "progress_percent"
  > & { status: WorkTaskStatus };
  busy?: boolean;
  onToggleDone?: (id: number, done: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const overdue = isOverdue(task.due_date, task.status);
  const done = task.status === "done";

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-500 hover:shadow-md">
      {onToggleDone && (
        <div className="flex items-start pt-0.5">
          <DoneCheck
            done={done}
            busy={busy}
            onToggle={(next) => onToggleDone(task.id, next)}
          />
        </div>
      )}
      <Link href={`/work/tasks/${task.id}`} className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-medium ${
                done ? "text-gray-400 line-through" : "text-ink"
              }`}
            >
              {task.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{task.project_name}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge tone={taskStatusTone(task.status)}>
              {workStatusLabel(t, task.status)}
            </Badge>
            <Badge tone={priorityTone(task.priority)}>
              {t("work.priorityN", { n: task.priority })}
            </Badge>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <ProgressBar value={task.progress_percent} className="max-w-[140px]" />
          <span
            className={`text-[11px] ${overdue ? "font-medium text-red-600" : "text-gray-500"}`}
          >
            {overdue ? `${t("work.overdueShort")} · ` : ""}
            {formatWorkDate(task.due_date, locale, t("work.noDue"))}
          </span>
        </div>
      </Link>
    </div>
  );
}
