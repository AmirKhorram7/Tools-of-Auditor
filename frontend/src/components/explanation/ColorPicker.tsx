"use client";

import CalendarColorPicker from "@/components/CalendarColorPicker";
import { cardPalette, type CardColor } from "@/lib/explanation";

/**
 * Folder / process card colour control. Opens the Google Calendar palette.
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
  return (
    <CalendarColorPicker
      value={value}
      onChange={onSelect}
      busy={busy}
      title={title}
      showDefault
      variant="icon"
      triggerColor={cardPalette(value).accent}
    />
  );
}
