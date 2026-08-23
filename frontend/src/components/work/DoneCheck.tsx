"use client";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function DoneCheck({
  done,
  busy,
  onToggle,
}: {
  done: boolean;
  busy?: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      title={done ? t("work.reopen") : t("work.markDone")}
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
      aria-label={done ? t("work.doneLabel") : t("work.colDone")}
    >
      ✓
    </button>
  );
}
