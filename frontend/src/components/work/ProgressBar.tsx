"use client";

import { cx } from "@/components/ui";

export default function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface", className)}>
      <div
        className="h-full rounded-full bg-brand-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
