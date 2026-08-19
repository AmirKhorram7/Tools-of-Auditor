"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import ColorPicker from "@/components/explanation/ColorPicker";
import { cardPalette, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";

/**
 * Folder card (پوشه / زیرپوشه). The whole card is the link target; the action
 * row sits above it so the colour picker and edit/delete stay clickable.
 */
export default function FolderCard({
  name,
  href,
  color,
  kindLabel,
  subtitle,
  meta,
  badge,
  editable = false,
  busy = false,
  onColor,
  onEdit,
  onDelete,
}: {
  name: string;
  href: string;
  color?: string | null;
  kindLabel: string;
  subtitle?: string | null;
  meta?: ReactNode;
  badge?: ReactNode;
  editable?: boolean;
  busy?: boolean;
  onColor?: (next: CardColor) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const palette = cardPalette(color);
  const { t } = useI18n();
  const [hover, setHover] = useState(false);
  const showActions = editable && (onColor || onEdit || onDelete);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative flex h-full flex-col rounded-2xl border p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md"
      style={{
        backgroundColor: hover ? palette.hover : palette.bg,
        borderColor: palette.border,
      }}
    >
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
              d="M4 5.5A2.5 2.5 0 0 1 6.5 3h3.2c.7 0 1.35.33 1.76.9l.72 1.02c.15.2.38.33.63.33h4.69A2.5 2.5 0 0 1 20 7.75v9.75A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"
            />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[11px] font-semibold tracking-wide opacity-70"
            style={{ color: palette.text }}
          >
            {kindLabel}
          </p>
          <p
            className="mt-0.5 truncate text-base font-bold"
            style={{ color: palette.text }}
            title={name}
          >
            {name}
          </p>
          {subtitle && (
            <p
              className="mt-0.5 truncate text-xs"
              style={{ color: palette.muted }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {badge && <div className="relative z-[2] flex flex-col items-end gap-1">{badge}</div>}
      </div>

      {meta && (
        <div
          className="mt-3 flex items-center gap-3 text-xs opacity-80"
          style={{ color: palette.text }}
        >
          {meta}
        </div>
      )}

      {showActions && (
        <div className="relative z-[2] mt-3 flex items-center gap-1 border-t pt-3" style={{ borderColor: palette.border }}>
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
