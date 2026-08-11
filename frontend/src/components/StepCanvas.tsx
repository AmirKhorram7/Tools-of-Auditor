"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { cx } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { SHAPE_SIZES, type ProcessStep, type StepConnection } from "@/lib/types";

/** Border-radius / rotation per shape. Dimensions come from SHAPE_SIZES. */
const SHAPE_STYLE: Record<ProcessStep["shape_type"], string> = {
  square: "rounded-xl",
  rectangle: "rounded-xl",
  circle: "rounded-full",
  diamond: "rounded-lg rotate-45",
  oval: "rounded-full",
};

const CANVAS_PADDING = 80;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 520;
/** Pointer travel (px) above which a gesture counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;

type Point = { x: number; y: number };

/**
 * Where the line from a shape's centre towards `target` crosses the shape's
 * bounding box, so arrows stop at the border instead of the centre.
 */
function edgePoint(center: Point, halfW: number, halfH: number, target: Point): Point {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;

  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

type Props = {
  steps: ProcessStep[];
  connections: StepConnection[];
  onMoved: (step: ProcessStep) => void;
  onConnect: (fromStep: number, toStep: number) => Promise<void>;
  onDeleteConnection: (id: number) => Promise<void>;
  onDeleteStep: (step: ProcessStep) => void;
  /** Viewers: navigate only — no drag / connect / delete. */
  readOnly?: boolean;
};

/**
 * Absolute-positioned flow canvas.
 *
 * Normal mode: drag a shape to persist position_x / position_y, click to open
 * the step documentation page.
 * Connect mode: click a source shape then a target shape to draw an arrow.
 */
export default function StepCanvas({
  steps,
  connections,
  onMoved,
  onConnect,
  onDeleteConnection,
  onDeleteStep,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    id: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const [dragPos, setDragPos] = useState<{ id: number; x: number; y: number } | null>(
    null,
  );
  const [connectMode, setConnectMode] = useState(false);
  const [linkSource, setLinkSource] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const positionOf = (step: ProcessStep): Point =>
    dragPos && dragPos.id === step.id
      ? { x: dragPos.x, y: dragPos.y }
      : { x: step.position_x, y: step.position_y };

  const extent = useMemo(() => {
    let width = MIN_WIDTH;
    let height = MIN_HEIGHT;
    for (const step of steps) {
      const size = SHAPE_SIZES[step.shape_type];
      const { x, y } = positionOf(step);
      width = Math.max(width, x + size.width + CANVAS_PADDING);
      height = Math.max(height, y + size.height + CANVAS_PADDING);
    }
    return { width, height };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, dragPos]);

  const edges = useMemo(() => {
    const byId = new Map(steps.map((step) => [step.id, step]));

    return connections.flatMap((connection) => {
      const from = byId.get(connection.from_step);
      const to = byId.get(connection.to_step);
      if (!from || !to) return [];

      const fromSize = SHAPE_SIZES[from.shape_type];
      const toSize = SHAPE_SIZES[to.shape_type];
      const fromPos = positionOf(from);
      const toPos = positionOf(to);

      const fromCenter = {
        x: fromPos.x + fromSize.width / 2,
        y: fromPos.y + fromSize.height / 2,
      };
      const toCenter = {
        x: toPos.x + toSize.width / 2,
        y: toPos.y + toSize.height / 2,
      };

      const start = edgePoint(fromCenter, fromSize.width / 2, fromSize.height / 2, toCenter);
      const end = edgePoint(toCenter, toSize.width / 2, toSize.height / 2, fromCenter);

      return [
        {
          connection,
          start,
          end,
          mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
        },
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, connections, dragPos]);

  const onPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    step: ProcessStep,
  ) => {
    if (connectMode) return;

    // Viewers: still track the gesture so a click (not a drag) can open the step.
    const shapeRect = event.currentTarget.getBoundingClientRect();
    dragState.current = {
      id: step.id,
      offsetX: event.clientX - shapeRect.left,
      offsetY: event.clientY - shapeRect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    if (!readOnly) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragState.current;
    const canvas = canvasRef.current;
    if (!state || !canvas || readOnly) return;

    const travelled =
      Math.abs(event.clientX - state.startX) + Math.abs(event.clientY - state.startY);
    if (!state.moved && travelled < DRAG_THRESHOLD) return;
    state.moved = true;

    const canvasRect = canvas.getBoundingClientRect();
    const x = event.clientX - canvasRect.left + canvas.scrollLeft - state.offsetX;
    const y = event.clientY - canvasRect.top + canvas.scrollTop - state.offsetY;

    setDragPos({ id: state.id, x: Math.max(0, x), y: Math.max(0, y) });
  };

  const onPointerUp = async (step: ProcessStep) => {
    const state = dragState.current;
    dragState.current = null;
    if (!state) return;

    if (!state.moved || readOnly) {
      setDragPos(null);
      router.push(`/explanation/steps/${step.id}`);
      return;
    }

    const moved = dragPos;
    if (!moved || moved.id !== step.id) {
      setDragPos(null);
      return;
    }

    try {
      const updated = await apiFetch<ProcessStep>(`/steps/${step.id}/`, {
        method: "PATCH",
        body: { position_x: moved.x, position_y: moved.y },
      });
      onMoved({ ...step, ...updated });
    } catch {
      // Keep the stored position when saving fails.
    } finally {
      setDragPos(null);
    }
  };

  const handleShapeClick = async (step: ProcessStep) => {
    if (!connectMode) return;

    if (linkSource === null) {
      setLinkSource(step.id);
      return;
    }
    if (linkSource === step.id) {
      setLinkSource(null);
      return;
    }

    setBusy(true);
    try {
      await onConnect(linkSource, step.id);
    } finally {
      setBusy(false);
      setLinkSource(null);
    }
  };

  const removeConnection = async (id: number) => {
    setBusy(true);
    try {
      await onDeleteConnection(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setConnectMode((mode) => !mode);
              setLinkSource(null);
            }}
            className={cx(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
              connectMode
                ? "border-brand-500 bg-brand-500 text-ink"
                : "border-gray-300 bg-white text-navy-800 hover:border-navy-700",
            )}
          >
            {connectMode ? "پایان اتصال" : "اتصال گام‌ها"}
          </button>

          <p className="text-xs text-gray-500">
            {connectMode
              ? linkSource === null
                ? "گام مبدأ را انتخاب کنید."
                : "حالا گام مقصد را انتخاب کنید."
              : "شکل‌ها را بکشید تا جابه‌جا شوند، یا کلیک کنید تا مستندسازی باز شود."}
          </p>

          {busy && <span className="text-xs text-gray-400">در حال ذخیره…</span>}
        </div>
      )}
      {readOnly && (
        <p className="text-xs text-gray-500">
          حالت مشاهده: برای دیدن مستندات هر گام روی شکل کلیک کنید.
        </p>
      )}

      <div
        ref={canvasRef}
        dir="ltr"
        className={cx(
          "relative h-[560px] w-full overflow-auto rounded-xl border bg-white",
          connectMode ? "border-brand-500" : "border-gray-200",
        )}
        style={{
          backgroundImage: "radial-gradient(circle, #d5d9d9 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <div
          className="relative"
          style={{ width: extent.width, height: extent.height }}
        >
          <svg
            width={extent.width}
            height={extent.height}
            className="pointer-events-none absolute inset-0"
          >
            <defs>
              <marker
                id="ta-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#232f3e" />
              </marker>
            </defs>

            {edges.map(({ connection, start, end, mid }) => (
              <g key={connection.id}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#232f3e"
                  strokeWidth={2}
                  markerEnd="url(#ta-arrow)"
                />
                {connection.label && (
                  <text
                    x={mid.x}
                    y={mid.y - 6}
                    textAnchor="middle"
                    className="fill-navy-800 text-[11px]"
                  >
                    {connection.label}
                  </text>
                )}
              </g>
            ))}
          </svg>

          {connectMode &&
            edges.map(({ connection, mid }) => (
              <button
                key={`remove-${connection.id}`}
                type="button"
                onClick={() => removeConnection(connection.id)}
                style={{ left: mid.x - 10, top: mid.y - 10 }}
                className="absolute z-20 flex size-5 items-center justify-center rounded-full border border-red-300 bg-white text-[11px] leading-none text-red-600 shadow-sm transition hover:bg-red-600 hover:text-white"
                title="حذف این اتصال"
              >
                ✕
              </button>
            ))}

          {steps.map((step) => {
            const size = SHAPE_SIZES[step.shape_type];
            const { x, y } = positionOf(step);
            const isSource = linkSource === step.id;

            return (
              <div key={step.id} className="group">
                <div
                  onPointerDown={(event) => onPointerDown(event, step)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(step)}
                  onClick={() => handleShapeClick(step)}
                  style={{
                    left: x,
                    top: y,
                    width: size.width,
                    height: size.height,
                  }}
                  className={cx(
                    "absolute flex touch-none select-none items-center justify-center border-2 p-2 text-center shadow-sm transition",
                    SHAPE_STYLE[step.shape_type],
                    connectMode || readOnly
                      ? "cursor-pointer"
                      : "cursor-grab hover:shadow-md active:cursor-grabbing",
                    isSource
                      ? "border-brand-500 bg-brand-100 ring-4 ring-brand-200"
                      : "border-navy-800 bg-white hover:border-brand-500",
                    dragPos?.id === step.id && "z-10 shadow-lg",
                  )}
                  title={
                    connectMode
                      ? "برای اتصال کلیک کنید"
                      : readOnly
                        ? "برای دیدن مستندات کلیک کنید"
                        : "برای جابه‌جایی بکشید، برای باز کردن کلیک کنید"
                  }
                >
                  <span
                    dir="rtl"
                    className={cx(
                      "pointer-events-none text-xs font-medium text-ink",
                      step.shape_type === "diamond" && "-rotate-45",
                    )}
                  >
                    {step.title}
                  </span>
                </div>

                {!readOnly && !connectMode && (
                  <button
                    type="button"
                    onClick={() => onDeleteStep(step)}
                    style={{ left: x + size.width - 10, top: y - 10 }}
                    className="absolute z-20 flex size-6 items-center justify-center rounded-full border border-red-300 bg-white text-xs leading-none text-red-600 opacity-0 shadow-sm transition hover:bg-red-600 hover:text-white group-hover:opacity-100"
                    title="حذف گام"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {steps.length === 0 && (
            <div
              dir="rtl"
              className="absolute inset-0 flex items-center justify-center text-sm text-gray-400"
            >
              هنوز گامی اضافه نشده است. با دکمه «افزودن گام» شروع کنید.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
