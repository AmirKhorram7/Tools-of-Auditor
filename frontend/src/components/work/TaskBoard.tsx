"use client";

import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import TaskCard from "@/components/work/TaskCard";
import { useI18n } from "@/lib/i18n";
import {
  LABEL_COLORS,
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
  onAddColumn,
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
  onAddColumn?: (name: string, color: string) => Promise<void> | void;
  onBlockedClose?: () => void;
}) {
  const { t } = useI18n();
  const showAddTask = Boolean(canAddTask ?? canManage) && Boolean(onAddTask);
  const [dropId, setDropId] = useState<number | null>(null);
  const [columnName, setColumnName] = useState("");
  const [columnColor, setColumnColor] = useState(LABEL_COLORS[1]);
  const [adding, setAdding] = useState(false);

  const visibleColumns = board.columns.map((column) => ({
    ...column,
    tasks: (column.tasks || []).filter((task) => {
      if (!mineOnly) return true;
      return task.assignee_user_id === currentUserId;
    }),
  }));

  const addColumn = async () => {
    if (!onAddColumn || !columnName.trim()) return;
    setAdding(true);
    try {
      await onAddColumn(columnName.trim(), columnColor);
      setColumnName("");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="-mx-1 flex items-start gap-3 overflow-x-auto pb-3">
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
          className={`flex h-[calc(100vh-16.5rem)] min-h-[280px] w-[270px] shrink-0 flex-col overflow-hidden rounded-xl border bg-white ${
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
          <div className="min-h-0 flex-1 px-2 pb-1">
            <div
              className={`flex h-full flex-col gap-1.5 overflow-y-auto rounded-lg border p-1.5 ${
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
      {canManage && onAddColumn && (
        <section className="w-[240px] shrink-0 rounded-xl border border-dashed border-gray-300 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-ink">{t("work.newColumn")}</p>
          <Field label={t("work.columnName")}>
            <Input
              value={columnName}
              onChange={(event) => setColumnName(event.target.value)}
              placeholder={t("work.columnExample")}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LABEL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setColumnColor(color)}
                className={`size-6 rounded-full ${
                  columnColor === color ? "ring-2 ring-navy-900/30 ring-offset-1" : ""
                }`}
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            ))}
          </div>
          <Button className="mt-3 w-full" size="sm" loading={adding} onClick={() => void addColumn()}>
            {t("common.add")}
          </Button>
        </section>
      )}
    </div>
  );
}
