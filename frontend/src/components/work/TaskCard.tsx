"use client";

import Link from "next/link";

import { Avatar, cx } from "@/components/ui";
import {
  isOverdue,
  labelTextColor,
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
  href,
  mine,
  columnName,
  columnColor,
  draggable,
  onDragStart,
}: {
  task: TaskCardModel;
  href?: string;
  mine?: boolean;
  columnName?: string;
  columnColor?: string;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  const overdue = isOverdue(task.due_date, task.status);
  const closed = task.status === "done" || task.status === "cancelled";
  const labels = task.labels || [];
  const snippet = (task.description || "").replace(/\s+/g, " ").trim();

  return (
    <Link
      href={href || `/work/tasks/${task.id}`}
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
        "block rounded-lg border bg-white px-2.5 py-2 transition",
        mine
          ? "border-2 border-brand-500 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]"
          : "border-black/[0.08] hover:border-navy-300/60",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      {(columnName || labels.length > 0) && (
        <div dir="ltr" className="mb-1.5 flex flex-wrap gap-1">
          {columnName && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: columnColor || "#1A2B49",
                color: labelTextColor(columnColor || "#1A2B49"),
              }}
            >
              {columnName}
            </span>
          )}
          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: label.color,
                color: labelTextColor(label.color),
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}
      <p
        className={cx(
          "line-clamp-2 text-[13px] font-semibold leading-5",
          closed ? "text-gray-400 line-through" : "text-navy-900",
        )}
      >
        {task.title}
      </p>
      {snippet && (
        <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">{snippet}</p>
      )}
      <div className="mt-1.5 flex items-end justify-between gap-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span dir="ltr">#{task.id}</span>
          {task.due_date && (
            <span className={overdue ? "font-medium text-red-600" : ""}>
              {shortFaDate(task.due_date)}
            </span>
          )}
        </span>
        {task.assignee_name ? (
          <span className="flex max-w-[46%] flex-col items-center gap-0.5 text-center">
            <Avatar src={task.assignee_avatar} name={task.assignee_name} size={36} />
            <span className="w-full truncate font-medium text-navy-900" title={task.assignee_name}>
              {task.assignee_name}
            </span>
          </span>
        ) : (
          <span className="text-gray-400">بدون مسئول</span>
        )}
      </div>
    </Link>
  );
}
