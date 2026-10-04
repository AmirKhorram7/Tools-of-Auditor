"use client";

import { useEffect, useState } from "react";

import ColorDots from "@/components/daybook/ColorDots";
import DayDateField from "@/components/daybook/DayDateField";
import NoteEditor from "@/components/daybook/NoteEditor";
import { Alert, Button, cx, Modal } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  DAY_COLORS,
  DEFAULT_DAY_COLOR,
  type CalendarSystem,
  type DayNote,
} from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

export type NoteDraft = { date: string; note?: DayNote };

export default function NoteComposer({
  draft,
  system,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: NoteDraft | null;
  system: CalendarSystem;
  onClose: () => void;
  onSaved: (note: DayNote) => void;
  onDeleted: (id: number) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState(DEFAULT_DAY_COLOR);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = draft?.note;

  useEffect(() => {
    if (!draft) return;
    setDate(draft.note?.date ?? draft.date);
    setTitle(draft.note?.title ?? "");
    setBody(draft.note?.body ?? "");
    setColor(draft.note?.color ?? DEFAULT_DAY_COLOR);
    setPinned(draft.note?.is_pinned ?? false);
    setError(null);
  }, [draft]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { date, title, body, color, is_pinned: pinned };
      const note = editing
        ? await apiFetch<DayNote>(`/daybook/notes/${editing.id}/`, { method: "PATCH", body: payload })
        : await apiFetch<DayNote>("/daybook/notes/", { method: "POST", body: payload });
      onSaved(note);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("day.error"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    await apiFetch(`/daybook/notes/${editing.id}/`, { method: "DELETE" });
    onDeleted(editing.id);
  };

  return (
    <Modal
      open={draft !== null}
      title={editing ? t("day.editNote") : t("day.newNote")}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            save();
          }
        }}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("day.noteTitle")}
          maxLength={160}
          className="w-full border-0 bg-transparent text-xl font-bold text-navy-900 outline-none placeholder:text-gray-300"
        />
        {draft ? <NoteEditor value={body} onChange={setBody} autoFocus={!editing} /> : null}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,13rem)_1fr]">
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">{t("day.date")}</p>
            <DayDateField value={date} onChange={setDate} system={system} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-500">{t("day.color")}</p>
            <div className="flex min-h-[42px] flex-wrap items-center gap-3">
              <ColorDots colors={DAY_COLORS} value={color} onChange={setColor} />
              <button
                type="button"
                onClick={() => setPinned(!pinned)}
                aria-pressed={pinned}
                className={cx(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  pinned ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-300 text-gray-600 hover:border-navy-700",
                )}
              >
                📌 {t("day.pin")}
              </button>
            </div>
          </div>
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-4">
          {editing ? (
            <button type="button" onClick={remove} className="text-sm text-red-600 hover:underline">
              {t("common.delete")}
            </button>
          ) : (
            <span className="text-xs text-gray-400 max-sm:hidden">{t("day.saveHint")}</span>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="button" loading={saving} onClick={save}>
              {t("day.saveNote")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
