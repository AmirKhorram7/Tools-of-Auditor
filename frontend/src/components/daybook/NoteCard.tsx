"use client";

import CreatedAt from "@/components/daybook/CreatedAt";
import { cx } from "@/components/ui";
import type { DayNote } from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export default function NoteCard({ note, onOpen }: { note: DayNote; onOpen: (note: DayNote) => void }) {
  const { t } = useI18n();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(note)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(note);
      }}
      className="group block w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-card text-start transition hover:shadow-[0_4px_16px_rgba(19,26,34,0.08)]"
    >
      <div className="h-1.5" style={{ backgroundColor: note.color }} />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          {note.title ? (
            <h3 className="text-[15px] font-bold leading-6 text-navy-900">{note.title}</h3>
          ) : (
            <span className="text-xs font-medium text-gray-400">{t("day.note")}</span>
          )}
          <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
            {note.is_pinned ? <span title={t("day.pinned")}>📌</span> : null}
            <CreatedAt at={note.created_at} />
          </span>
        </div>
        {note.body ? (
          <div className="relative mt-1 max-h-40 overflow-hidden">
            <div
              className={cx("rich-content text-sm leading-7 text-gray-700")}
              dangerouslySetInnerHTML={{ __html: note.body }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
