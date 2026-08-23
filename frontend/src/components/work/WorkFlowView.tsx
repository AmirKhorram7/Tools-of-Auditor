"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState, cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  labelTextColor,
  workStatusLabel,
  type WorkTask,
} from "@/lib/work";

const CARD_W = 220;
const CARD_H = 112;
const GAP_X = 72;
const GAP_Y = 28;
const PAD = 28;

type Placed = {
  task: WorkTask;
  x: number;
  y: number;
};

function isLinked(task: WorkTask, all: WorkTask[]) {
  if ((task.prerequisites || []).some((item) => all.some((row) => row.id === item.id))) {
    return true;
  }
  return all.some((row) =>
    (row.prerequisites || []).some((item) => item.id === task.id),
  );
}

function rankTasks(tasks: WorkTask[]) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ranks = new Map<number, number>();

  const rankOf = (id: number, stack: Set<number>): number => {
    const cached = ranks.get(id);
    if (cached !== undefined) return cached;
    if (stack.has(id)) return 0;
    stack.add(id);
    const task = byId.get(id);
    const prereqs = (task?.prerequisites || []).filter((item) => byId.has(item.id));
    const rank =
      prereqs.length === 0
        ? 0
        : Math.max(...prereqs.map((item) => rankOf(item.id, stack))) + 1;
    stack.delete(id);
    ranks.set(id, rank);
    return rank;
  };

  for (const task of tasks) rankOf(task.id, new Set());

  const columns: WorkTask[][] = [];
  for (const task of tasks) {
    const rank = ranks.get(task.id) ?? 0;
    while (columns.length <= rank) columns.push([]);
    columns[rank].push(task);
  }
  return columns;
}

export default function WorkFlowView({
  tasks,
  emptyAction,
}: {
  tasks: WorkTask[];
  emptyAction?: ReactNode;
}) {
  const { t } = useI18n();
  const linked = tasks.filter((task) => isLinked(task, tasks));
  const unlinked = tasks.filter((task) => !isLinked(task, tasks));
  const columns = rankTasks(linked);
  const placed: Placed[] = [];
  columns.forEach((column, col) => {
    column.forEach((task, row) => {
      placed.push({
        task,
        x: PAD + col * (CARD_W + GAP_X),
        y: PAD + row * (CARD_H + GAP_Y),
      });
    });
  });
  const byId = new Map(placed.map((item) => [item.task.id, item]));
  const width = Math.max(
    PAD * 2 + CARD_W,
    PAD * 2 + Math.max(columns.length, 1) * CARD_W + Math.max(columns.length - 1, 0) * GAP_X,
  );
  const height = Math.max(
    PAD * 2 + CARD_H,
    PAD * 2 +
      Math.max(...columns.map((column) => column.length), 1) * CARD_H +
      Math.max(Math.max(...columns.map((column) => column.length), 1) - 1, 0) * GAP_Y,
  );

  if (tasks.length === 0) {
    return (
      <EmptyState title={t("work.flowEmpty")} description={t("work.flowEmptyDesc")} action={emptyAction} />
    );
  }

  return (
    <div className="space-y-4">
      {linked.length === 0 ? (
        <EmptyState title={t("work.flowNoLinks")} description={t("work.flowNoLinksDesc")} />
      ) : (
        <div
          className="overflow-auto rounded-2xl border border-gray-200 bg-white p-4"
          style={{
            backgroundImage:
              "linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maxHeight: "72vh",
          }}
        >
          <div dir="ltr" className="relative" style={{ width, height, minWidth: "100%" }}>
            <svg
              width={width}
              height={height}
              className="pointer-events-none absolute inset-0"
              aria-hidden
            >
              <defs>
                <marker
                  id="work-flow-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#1A2B49" fillOpacity="0.55" />
                </marker>
              </defs>
              {placed.flatMap(({ task }) =>
                (task.prerequisites || []).map((prereq) => {
                  const from = byId.get(prereq.id);
                  const to = byId.get(task.id);
                  if (!from || !to) return null;
                  const x1 = from.x + CARD_W;
                  const y1 = from.y + CARD_H / 2;
                  const x2 = to.x;
                  const y2 = to.y + CARD_H / 2;
                  const mid = (x1 + x2) / 2;
                  return (
                    <path
                      key={`${prereq.id}-${task.id}`}
                      d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#1A2B49"
                      strokeOpacity={0.45}
                      strokeWidth={2}
                      strokeLinecap="round"
                      markerEnd="url(#work-flow-arrow)"
                    />
                  );
                }),
              )}
            </svg>
            {placed.map(({ task, x, y }) => (
              <FlowCard key={task.id} task={task} x={x} y={y} />
            ))}
          </div>
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">{t("work.flowUnlinked")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unlinked.map((task) => (
              <FlowCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500">{t("work.flowHint")}</p>
    </div>
  );
}

function FlowCard({
  task,
  x,
  y,
}: {
  task: WorkTask;
  x?: number;
  y?: number;
}) {
  const { t } = useI18n();
  const closed = task.status === "done" || task.status === "cancelled";
  const needs = (task.prerequisites || []).map((item) => item.title).filter(Boolean);

  const card = (
    <Link
      href={`/work/tasks/${task.id}`}
      className={cx(
        "flex h-full flex-col justify-between rounded-xl border bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md",
        closed ? "border-gray-200" : "border-navy-900/15",
      )}
    >
      <div>
        {(task.column_name || (task.labels || []).length > 0) && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {task.column_name && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: task.column_color || "#1A2B49",
                  color: labelTextColor(task.column_color || "#1A2B49"),
                }}
              >
                {task.column_name}
              </span>
            )}
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
      </div>
      <div className="mt-2 space-y-0.5 text-[10px] text-gray-500">
        <p>
          {workStatusLabel(t, task.status)}
          {task.assignee_name ? ` · ${task.assignee_name}` : ""}
        </p>
        {needs.length > 0 && (
          <p className="line-clamp-1 text-navy-700">
            {t("work.needs")}: {needs.join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );

  if (x === undefined || y === undefined) {
    return <div className="h-[112px]">{card}</div>;
  }

  return (
    <div className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H }}>
      {card}
    </div>
  );
}
