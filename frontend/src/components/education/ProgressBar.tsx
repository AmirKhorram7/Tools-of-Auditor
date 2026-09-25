import { cx } from "@/components/ui";

export default function EduProgressBar({
  done,
  total,
  label,
}: {
  done: number;
  total: number;
  label?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      {label ? <p className="mb-1 text-xs font-medium text-gray-500">{label}</p> : null}
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className={cx("h-full rounded-full bg-brand-500 transition-all")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {done}/{total} · {pct}%
      </p>
    </div>
  );
}
