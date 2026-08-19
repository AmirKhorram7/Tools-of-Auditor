"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/ui";
import { CARD_COLORS, cardPalette, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";

const PANEL_W = 232;
const PANEL_H = 140;
const GAP = 8;

/**
 * Google-Drive style colour picker: a small palette button that opens a
 * swatch grid. Used on folder and process cards.
 *
 * The panel is portalled to <body> with fixed coordinates so card `overflow`
 * and hover `transform` can never clip it, and it opens towards the physical
 * left (then flips if it would leave the viewport).
 */
export default function ColorPicker({
  value,
  onSelect,
  busy = false,
  title,
}: {
  value?: string | null;
  onSelect: (color: CardColor) => void;
  busy?: boolean;
  title?: string;
}) {
  const { t, locale } = useI18n();
  const pickerTitle = title ?? t("common.color");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const active = cardPalette(value);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Open to the physical left of the trigger so the full palette stays on-screen.
    let left = rect.left - PANEL_W - GAP;
    if (left < GAP) {
      left = rect.right + GAP;
    }
    left = Math.min(
      Math.max(GAP, left),
      Math.max(GAP, window.innerWidth - PANEL_W - GAP),
    );

    const below = rect.bottom + GAP;
    const top =
      below + PANEL_H > window.innerHeight - GAP
        ? Math.max(GAP, rect.top - PANEL_H - GAP)
        : below;

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={pickerTitle}
        aria-label={pickerTitle}
        aria-expanded={open}
        disabled={busy}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          place();
          setOpen(true);
        }}
        className={cx(
          "flex size-8 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-gray-600 shadow-sm transition",
          "hover:bg-white hover:text-ink disabled:opacity-50",
          open && "bg-white text-ink",
        )}
      >
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <circle
            cx="10"
            cy="10"
            r="7.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="10" cy="10" r="4" fill={active.accent} />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            dir={locale === "fa" ? "rtl" : "ltr"}
            className="fixed z-[100] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl"
            style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          >
            <p className="mb-2 px-0.5 text-[11px] font-semibold text-gray-500">
              {pickerTitle}
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {CARD_COLORS.map((palette) => {
                const selected = palette.key === active.key;
                const label = locale === "en" ? palette.labelEn : palette.label;
                return (
                  <button
                    key={palette.key}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setOpen(false);
                      if (!selected) onSelect(palette.key);
                    }}
                    className={cx(
                      "flex size-7 items-center justify-center rounded-full border transition hover:scale-110",
                      selected ? "ring-2 ring-navy-800 ring-offset-1" : "",
                    )}
                    style={{
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }}
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: palette.accent }}
                    />
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
