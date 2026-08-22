"use client";

import { cx } from "@/components/ui";

export default function ProgressGauge({
  value,
  size = 56,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  const r = 15.5;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div
      className={cx("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      title={`${pct}٪`}
    >
      <svg viewBox="0 0 40 40" className="size-full -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="#D8EDE0" strokeWidth="4.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="#1AAA55"
          strokeWidth="4.5"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold leading-none text-navy-900">
        {pct}٪
      </span>
    </div>
  );
}
