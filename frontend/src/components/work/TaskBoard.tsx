"use client";

import { useState } from "react";

import TaskCard from "@/components/work/TaskCard";
import { useI18n } from "@/lib/i18n";
import {
  type WorkBoard,
  type WorkBoardColumn,
  type WorkTask,
} from "@/lib/work";

export default function TaskBoard({
  board,
  canManage,
  canAddTask,
  requireApproval,
  mineOnly,
  currentUserId,
  onMove,
  onAddTask,
  onBlockedClose,
}: {
  board: WorkBoard;
  canManage: boolean;
  canAddTask?: boolean;
  requireApproval?: boolean;
  mineOnly?: boolean;
  currentUserId?: number | null;
  onMove: (task: WorkTask, column: WorkBoardColumn) => Promise<void> | void;
  onAddTask?: (column: WorkBoardColumn) => void;
  onBlockedClose?: () => void;
}) {
  const { t } = useI18n();
  const showAddTask = Boolean(canAddTask ?? canManage) && Boolean(onAddTask);
  const [dropId, setDropId] = useState<number | null>(null);

  const visibleColumns = board.columns.map((column) => ({
    ...column,
    tasks: (column.tasks || []).filter((task) => {
      if (!mineOnly) return true;
      return task.assignee_user_id === currentUserId;
    }),
  }));

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 items-stretch gap-3 overflow-x-auto overflow-y-hidden overscroll-contain">
      {visibleColumns.map((column) => (
        <section
          key={column.id}
          onDragOver={(event) => {
            event.preventDefault();
            setDropId(column.id);
          }}
          onDragLeave={() => setDropId((current) => (current === column.id ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            setDropId(null);
            const raw =
              event.dataTransfer.getData("text/task-id") ||
              event.dataTransfer.getData("text/plain");
            const taskId = Number(raw);
            const task = board.columns
              .flatMap((item) => item.tasks || [])
              .find((item) => item.id === taskId);
            if (!task || task.column === column.id || !task.can_move) return;
            if (requireApproval && !canManage && (column.is_closed || column.status_key === "done")) {
              onBlockedClose?.();
              return;
            }
            void onMove(task, column);
          }}
          className={`flex h-full min-h-0 w-[270px] shrink-0 flex-col overflow-hidden rounded-xl border bg-white ${
            dropId === column.id ? "border-navy-400 shadow-md" : "border-gray-200"
          }`}
        >
          <div className="h-1.5 shrink-0" style={{ backgroundColor: column.color }} />
          <header className="flex shrink-0 items-center gap-2 px-3 py-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: column.color }}
            />
            <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">
              {column.name}
            </p>
            {showAddTask && (
              <button
                type="button"
                onClick={() => onAddTask?.(column)}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-lg leading-none text-gray-400 hover:bg-surface hover:text-navy-800"
                title={t("work.addTask")}
                aria-label={t("work.addTask")}
              >
                +
              </button>
            )}
          </header>
          <div className="relative min-h-0 flex-1">
            <div
              className={`absolute inset-x-2 top-0 bottom-2 flex flex-col gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain rounded-lg border p-1.5 ${
                dropId === column.id
                  ? "border-navy-400 bg-white"
                  : "border-dashed border-gray-300 bg-[#F7F8FA]"
              }`}
            >
              {column.tasks.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-3 text-center">
                  <p className="text-sm font-bold text-gray-400">{t("work.emptyColumn")}</p>
                  <p className="mt-1 text-[11px] leading-5 text-gray-400">
                    {t("work.emptyColumnHint")}
                  </p>
                </div>
              ) : (
                column.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    draggable={task.can_move}
                    mine={Boolean(currentUserId && task.assignee_user_id === currentUserId)}
                    columnName={column.name}
                    columnColor={column.color}
                  />
                ))
              )}
            </div>
          </div>
          {showAddTask && (
            <button
              type="button"
              onClick={() => onAddTask?.(column)}
              className="mx-2 mb-2 shrink-0 rounded-lg bg-[#F2F3F5] px-2 py-2 text-[12px] font-bold text-gray-600 hover:bg-surface hover:text-navy-800"
            >
              + {t("work.addTask")}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
