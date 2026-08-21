"use client";

import { useState } from "react";

import { Button, Field, Input } from "@/components/ui";
import TaskCard from "@/components/work/TaskCard";
import {
  LABEL_COLORS,
  colorAlpha,
  type WorkBoard,
  type WorkBoardColumn,
  type WorkTask,
} from "@/lib/work";

export default function TaskBoard({
  board,
  canManage,
  mineOnly,
  currentUserId,
  onMove,
  onAddTask,
  onAddColumn,
}: {
  board: WorkBoard;
  canManage: boolean;
  mineOnly?: boolean;
  currentUserId?: number | null;
  onMove: (task: WorkTask, column: WorkBoardColumn) => Promise<void> | void;
  onAddTask: (column: WorkBoardColumn) => void;
  onAddColumn?: (name: string, color: string) => Promise<void> | void;
}) {
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
            void onMove(task, column);
          }}
          className={`flex w-[300px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-white ${
            dropId === column.id
              ? "border-navy-400 shadow-[0_8px_24px_rgba(26,43,73,0.12)]"
              : "border-black/[0.06] shadow-[0_1px_2px_rgba(26,43,73,0.05)]"
          }`}
          style={{
            borderInlineStartWidth: 3,
            borderInlineStartColor: column.color,
          }}
        >
          <header
            className="flex items-center justify-between gap-2 px-3 py-3"
            style={{ backgroundColor: colorAlpha(column.color, 0.1) }}
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-wide text-navy-900">
                {column.name}
              </p>
              <p className="mt-0.5 text-[11px] text-navy-800/55">{column.tasks.length} کار</p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => onAddTask(column)}
                className="flex size-7 items-center justify-center rounded-full text-base leading-none text-navy-800/70 hover:bg-white/70"
                aria-label="کار جدید"
              >
                +
              </button>
            )}
          </header>
          <div
            className="flex min-h-[220px] max-h-[min(72vh,720px)] flex-col gap-2 overflow-y-auto p-2"
            style={{ backgroundColor: colorAlpha(column.color, 0.04) }}
          >
            {column.tasks.length === 0 ? (
              <p className="px-1 py-8 text-center text-xs text-navy-800/35">خالی</p>
            ) : (
              column.tasks.map((task) => (
                <TaskCard key={task.id} task={task} draggable={task.can_move} />
              ))
            )}
          </div>
        </section>
      ))}
      {canManage && onAddColumn && (
        <section className="w-[240px] shrink-0 rounded-2xl border border-dashed border-black/10 bg-white/80 p-3">
          <p className="mb-2 text-sm font-semibold text-ink">ستون جدید</p>
          <Field label="نام">
            <Input
              value={columnName}
              onChange={(event) => setColumnName(event.target.value)}
              placeholder="مثلاً بازبینی"
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
            افزودن
          </Button>
        </section>
      )}
    </div>
  );
}
