"use client";

import JalaliDateField from "@/components/work/JalaliDateField";
import type { CalendarSystem } from "@/lib/daybook";

export default function DayDateField({
  value,
  onChange,
  system,
  min,
}: {
  value: string;
  onChange: (iso: string) => void;
  system: CalendarSystem;
  min?: string;
}) {
  if (system === "jalali") return <JalaliDateField value={value} onChange={(iso) => iso && onChange(iso)} />;
  return (
    <input
      type="date"
      dir="ltr"
      value={value}
      min={min}
      onChange={(event) => event.target.value && onChange(event.target.value)}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
    />
  );
}
