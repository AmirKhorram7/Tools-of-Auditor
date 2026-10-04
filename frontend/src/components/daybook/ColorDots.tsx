"use client";

import { cx } from "@/components/ui";
import type { DayColor } from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export default function ColorDots({
  colors,
  value,
  onChange,
  size = "md",
}: {
  colors: DayColor[];
  value: string;
  onChange: (hex: string) => void;
  size?: "sm" | "md";
}) {
  const { locale } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => {
        const active = color.hex.toUpperCase() === value.toUpperCase();
        return (
          <button
            key={color.hex}
            type="button"
            title={locale === "fa" ? color.label : color.labelEn}
            aria-label={locale === "fa" ? color.label : color.labelEn}
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(color.hex)}
            className={cx(
              "shrink-0 rounded-full transition hover:scale-110",
              size === "sm" ? "size-5" : "size-6",
              active ? "ring-2 ring-offset-2 ring-navy-800" : "ring-1 ring-black/10",
            )}
            style={{ backgroundColor: color.hex }}
          />
        );
      })}
    </div>
  );
}
