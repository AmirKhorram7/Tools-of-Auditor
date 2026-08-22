"use client";

import Link from "next/link";

import { Avatar, cx } from "@/components/ui";
import ProgressBar from "@/components/work/ProgressBar";
import {
  colorAlpha,
  isOverdue,
  shortFaDate,
  type WorkLabel,
  type WorkTaskStatus,
} from "@/lib/work";

export type TaskCardModel = {
  id: number;
  title: string;
  status: WorkTaskStatus;
  due_date: string | null;
  description?: string;
  labels?: WorkLabel[];
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  progress_percent?: number;
  can_move?: boolean;
};

export default function TaskCard({
  task,
  draggable,
  onDragStart,
}: {
  task: TaskCardModel;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  const overdue = isOverdue(task.due_date, task.status);
  const closed = task.status === "done" || task.status === "cancelled";
  const progress = task.progress_percent ?? 0;
  const labels = task.labels || [];
  const snippet = (task.description || "").replace(/\s+/g, " ").trim();

  return (
    <Link
      href={`/work/tasks/${task.id}`}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", String(task.id));
        event.dataTransfer.setData("text/task-id", String(task.id));
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      className={cx(
        "block min-h-[88px] rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_1px_1px_rgba(26,43,73,0.04)] transition hover:border-navy-300/60 hover:shadow-[0_6px_18px_rgba(26,43,73,0.08)]",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <p
        className={cx(
          "text-[15px] font-semibold leading-6",
          closed ? "text-gray-400 line-through" : "text-navy-900",
        )}
      >
        {task.title}
      </p>
      {snippet && (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500">{snippet}</p>
      )}
      {labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: colorAlpha(label.color, 0.14),
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      {progress > 0 && progress < 100 && (
        <ProgressBar value={progress} className="mt-2" />
      )}
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-2">
          <span dir="ltr">#{task.id}</span>
          {task.due_date && (
            <span className={overdue ? "font-medium text-red-600" : ""}>
              {shortFaDate(task.due_date)}
            </span>
          )}
        </span>
        {task.assignee_name ? (
          <Avatar src={task.assignee_avatar} name={task.assignee_name} size={22} />
        ) : (
          <span className="text-gray-400">بدون مسئول</span>
        )}
      </div>
    </Link>
  );
}
