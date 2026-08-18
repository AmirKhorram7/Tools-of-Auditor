"use client";

import { cx } from "@/components/ui";

export default function DoneCheck({
  done,
  busy,
  onToggle,
}: {
  done: boolean;
  busy?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      title={done ? "بازگشت به کار باز" : "علامت تمام شدن"}
      disabled={busy}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle(!done);
      }}
      className={cx(
        "flex size-6 shrink-0 items-center justify-center rounded-md border text-sm transition",
        done
          ? "border-green-600 bg-green-600 text-white"
          : "border-gray-300 bg-white text-transparent hover:border-brand-500",
        busy && "opacity-50",
      )}
      aria-pressed={done}
      aria-label={done ? "کار تمام شده" : "تمام کردن کار"}
    >
      ✓
    </button>
  );
}
