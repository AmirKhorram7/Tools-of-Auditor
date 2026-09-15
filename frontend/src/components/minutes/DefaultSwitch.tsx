"use client";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function DefaultSwitch({
  on,
  disabled,
  onToggle,
  name,
}: {
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  name?: string;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className="inline-flex items-center gap-2"
      title={t("minutes.defaultHint")}
    >
      <span
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          on ? "bg-green-600" : "bg-gray-300",
          disabled && "opacity-50",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            on ? "end-0.5 start-auto" : "start-0.5 end-auto",
          )}
        />
      </span>
      <span
        className={cx(
          "text-xs font-medium leading-5",
          on ? "font-bold text-green-700" : "text-navy-800",
        )}
      >
        {on ? name || t("minutes.defaultOn") : t("minutes.defaultOff")}
      </span>
    </button>
  );
}
