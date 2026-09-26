"use client";

import { useI18n } from "@/lib/i18n";

/** Keep the % after the number in RTL (avoids ٪ jumping to the wrong side). */
export default function Percent({ value }: { value: number }) {
  const { n } = useI18n();
  return (
    <span dir="ltr" className="inline-block tabular-nums">
      {n(value)}%
    </span>
  );
}
