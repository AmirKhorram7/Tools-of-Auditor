"use client";

import Link from "next/link";
import { useState } from "react";

import ColorPicker from "@/components/explanation/ColorPicker";
import { cardPalette, faNum, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";

/**
 * Process card (فرایند). Same interaction model as FolderCard, with a leading
 * accent rail so processes read as a different layer than folders.
 */
export default function ProcessCard({
  name,
  href,
  color,
  department,
  stepCount = 0,
  editable = false,
  busy = false,
  onColor,
  onEdit,
  onDelete,
}: {
  name: string;
  href: string;
  color?: string | null;
  department?: string | null;
  stepCount?: number;
  editable?: boolean;
  busy?: boolean;
  onColor?: (next: CardColor) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const palette = cardPalette(color);
  const { t, n, locale } = useI18n();
  const [hover, setHover] = useState(false);
  const showActions = editable && (onColor || onEdit || onDelete);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex h-full flex-col rounded-2xl border p-4 ps-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: hover ? palette.hover : palette.bg,
        borderColor: palette.border,
      }}
    >
      <span
        className="absolute inset-y-0 w-1.5 rounded-s-2xl"
        style={{ backgroundColor: palette.accent, insetInlineStart: 0 }}
        aria-hidden
      />
      <Link
        href={href}
        aria-label={name}
        className="absolute inset-0 z-[1] rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-800"
      />

      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: palette.accent }}
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
            <path
              fill="currentColor"
              d="M4 4h6v4.2H4zm0 11.8h6V20H4zm10-11.8h6v4.2h-6zm0 11.8h6V20h-6z"
            />
            <path
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              d="M7 8.2v7.6M17 8.2v7.6M10 12h4"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold tracking-wide opacity-70"
            style={{ color: palette.text }}
          >
            {t("common.process")}
          </p>
          <p
            className="mt-0.5 truncate text-base font-bold"
            style={{ color: palette.text }}
            title={name}
          >
            {name}
          </p>
          <p
            className="mt-0.5 truncate text-xs"
            style={{ color: palette.muted }}
          >
            {department || t("exp.noDept")}
          </p>
        </div>
      </div>

      <div
        className="mt-3 flex items-center gap-2 text-xs font-medium opacity-80"
        style={{ color: palette.text }}
      >
        <span
          className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: palette.accent }}
          />
          {locale === "fa" ? faNum(stepCount) : n(stepCount)} {t("common.step")}
        </span>
        {stepCount === 0 && (
          <span style={{ color: palette.muted }}>{t("exp.notDocumented")}</span>
        )}
      </div>

      {showActions && (
        <div
          className="relative z-[2] mt-3 flex items-center gap-1 border-t pt-3"
          style={{ borderColor: palette.border }}
        >
          {onColor && (
            <ColorPicker value={color} busy={busy} onSelect={onColor} />
          )}
          <div className="ms-auto flex items-center gap-1 transition focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-medium text-navy-800 transition hover:bg-white"
              >
                {t("common.edit")}
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-white"
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
