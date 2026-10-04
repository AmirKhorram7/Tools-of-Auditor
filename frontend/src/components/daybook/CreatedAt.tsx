"use client";

import { formatClock } from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export default function CreatedAt({ at }: { at: string }) {
  const { t, locale } = useI18n();
  const time = formatClock(at, locale);
  if (!time) return null;
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums text-gray-400"
      title={t("day.created", { time })}
    >
      <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.6V8.2l2.3 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span dir="ltr">{time}</span>
    </span>
  );
}
