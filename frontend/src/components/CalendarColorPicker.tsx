"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/ui";
import {
  GOOGLE_CALENDAR_COLORS,
  GOOGLE_CALENDAR_DEFAULT,
  isLightHex,
  normalizeHex,
  sameColor,
} from "@/lib/calendarColors";
import { useI18n } from "@/lib/i18n";

const PANEL_W = 268;
const PANEL_H = 196;
const GAP = 8;

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M9.55 17.3 4.8 12.55l1.4-1.4 3.35 3.35 8.25-8.25 1.4 1.4z"
      />
    </svg>
  );
}

/** Always-visible Google Calendar colour grid. */
export function CalendarColorGrid({
  value,
  onChange,
  showDefault = false,
  busy = false,
}: {
  value?: string | null;
  onChange: (color: string) => void;
  showDefault?: boolean;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const hex = normalizeHex(value);
  const isDefault = showDefault && (!value || value === "default");

  return (
    <div dir="ltr" className="w-[268px] max-w-full">
      <div className="grid grid-cols-9 gap-1.5">
        {GOOGLE_CALENDAR_COLORS.map((color) => {
          const selected = !isDefault && sameColor(color, value);
          const checkOnLight = isLightHex(color);
          return (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={color}
              aria-pressed={selected}
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (sameColor(color, value)) return;
                onChange(color);
              }}
              className="flex size-6 items-center justify-center rounded-full transition hover:scale-110 disabled:opacity-50"
              style={{ backgroundColor: color }}
            >
              {selected && (
                <CheckIcon
                  className={cx(
                    "size-3.5",
                    checkOnLight ? "text-[#1F1F1F]" : "text-white",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      {showDefault && (
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isDefault) return;
            onChange("default");
          }}
          className="mt-2.5 flex h-9 w-full items-center gap-2 rounded-full bg-[#E8EAED] px-2 text-sm text-[#3C4043] transition hover:bg-[#DDE1E5] disabled:opacity-50"
        >
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: isDefault ? GOOGLE_CALENDAR_DEFAULT : "transparent",
            }}
          >
            {isDefault && <CheckIcon className="size-3.5 text-white" />}
          </span>
          {t("common.colorDefault")}
        </button>
      )}
    </div>
  );
}

/**
 * Google Calendar colour popover: 24 circles + optional Default pill.
 */
export default function CalendarColorPicker({
  value,
  onChange,
  busy = false,
  title,
  showDefault = false,
  variant = "swatch",
  triggerColor,
}: {
  value?: string | null;
  onChange: (color: string) => void;
  busy?: boolean;
  title?: string;
  showDefault?: boolean;
  variant?: "swatch" | "icon";
  triggerColor?: string;
}) {
  const { t } = useI18n();
  const pickerTitle = title ?? t("common.color");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hex = normalizeHex(value);
  const isDefault = showDefault && (!value || value === "default");
  const swatch = triggerColor || hex || value || "#616161";

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    let left = rect.left - PANEL_W - GAP;
    if (left < GAP) left = rect.right + GAP;
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

  const pick = (color: string) => {
    setOpen(false);
    if (sameColor(color, value) || (color === "default" && isDefault)) return;
    onChange(color);
  };

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
          "shrink-0 transition disabled:opacity-50",
          variant === "icon"
            ? cx(
                "flex size-8 items-center justify-center rounded-lg border border-white/70 bg-white/80 text-gray-600 shadow-sm",
                "hover:bg-white hover:text-ink",
                open && "bg-white text-ink",
              )
            : cx(
                "size-7 rounded-full border border-black/10 shadow-sm hover:scale-105",
                open && "ring-2 ring-[#1A73E8]/40 ring-offset-1",
              ),
        )}
        style={
          variant === "swatch"
            ? { backgroundColor: isDefault ? "#E8EAED" : swatch }
            : undefined
        }
      >
        {variant === "icon" && (
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
            <circle
              cx="10"
              cy="10"
              r="7.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <circle
              cx="10"
              cy="10"
              r="4"
              fill={isDefault ? "#37475A" : swatch}
            />
          </svg>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            dir="ltr"
            className="fixed z-[100] rounded-lg bg-white p-3 shadow-[0_2px_6px_2px_rgba(60,64,67,.15),0_1px_2px_rgba(60,64,67,.3)]"
            style={{ top: pos.top, left: pos.left, width: PANEL_W }}
            onClick={(event) => event.stopPropagation()}
          >
            <CalendarColorGrid
              value={value}
              onChange={(color) => {
                pick(color);
              }}
              showDefault={showDefault}
              busy={busy}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
