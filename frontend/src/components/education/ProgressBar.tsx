"use client";

import Percent from "@/components/education/Percent";
import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function EduProgressBar({
  done,
  total,
  label,
  tone = "navy",
}: {
  done: number;
  total: number;
  label?: string;
  tone?: "navy" | "green";
}) {
  const { n } = useI18n();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        {label ? <span className="font-semibold text-ink">{label}</span> : <span />}
        <span className="text-gray-500">
          <Percent value={pct} />
          <span aria-hidden> · </span>
          <span dir="ltr" className="inline-block tabular-nums">
            {n(done)}/{n(total)}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cx("h-full rounded-full transition-all", tone === "green" ? "bg-green-600" : "bg-navy-800")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
