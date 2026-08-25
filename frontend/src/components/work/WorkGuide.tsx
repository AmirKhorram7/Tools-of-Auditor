"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { BOARD_COLUMN_COLORS } from "@/lib/calendarColors";
import { useI18n } from "@/lib/i18n";

const COLUMN_KEYS = [
  { key: "work.col.todo", color: BOARD_COLUMN_COLORS.todo },
  { key: "work.col.doing", color: BOARD_COLUMN_COLORS.inProgress },
  { key: "work.col.test", color: BOARD_COLUMN_COLORS.test },
  { key: "work.col.wait", color: BOARD_COLUMN_COLORS.waiting },
  { key: "work.col.done", color: BOARD_COLUMN_COLORS.done },
] as const;

const SECTION_KEYS = [
  { title: "work.guide.boardTitle", body: "work.guide.boardBody", tone: "bg-[#EEF3FA] text-[#14233A] border-[#C5D3E8]", mark: "1" },
  { title: "work.guide.settingsTitle", body: "work.guide.settingsBody", tone: "bg-[#F3F0FA] text-[#3A2430] border-[#D8CDE6]", mark: "2" },
  { title: "work.guide.standardTitle", body: "work.guide.standardBody", tone: "bg-[#EEF6F1] text-[#1E3328] border-[#C5DCCE]", mark: "3" },
  { title: "work.guide.policyTitle", body: "work.guide.policyBody", tone: "bg-[#FFF6E6] text-[#5C4308] border-[#E8D19A]", mark: "4" },
  { title: "work.guide.rolesTitle", body: "work.guide.rolesBody", tone: "bg-[#FDECEC] text-[#6B1C1C] border-[#E8B4B4]", mark: "5" },
] as const;

export default function WorkGuide({
  compact = false,
  icon = false,
}: {
  compact?: boolean;
  icon?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      {icon ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-base font-bold text-navy-800 shadow-sm transition hover:bg-surface"
          aria-label={t("work.guide")}
          title={t("work.guide")}
        >
          ?
        </button>
      ) : (
        <Button
          size="sm"
          variant={compact ? "secondary" : "primary"}
          onClick={() => setOpen(true)}
        >
          {t("work.guide")}
        </Button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-[#14233A]/55"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(20,35,58,0.28)]">
            <header className="shrink-0 bg-gradient-to-l from-[#1A2B49] to-[#14233A] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold tracking-wide text-white/70">
                    {t("work.guideKicker")}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">{t("work.guideTitle")}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white/80 hover:bg-white/20"
                  aria-label={t("common.close")}
                >
                  ✕
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/85">{t("work.guideIntro")}</p>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
                {COLUMN_KEYS.map((column) => (
                  <span
                    key={column.key}
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: column.color }}
                  >
                    {t(column.key)}
                  </span>
                ))}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
              {SECTION_KEYS.map((section) => (
                <section
                  key={section.title}
                  className={`rounded-xl border px-3 py-3 ${section.tone}`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-white/80 text-[11px] font-bold">
                      {section.mark}
                    </span>
                    <h3 className="text-sm font-bold">{t(section.title)}</h3>
                  </div>
                  <p className="text-[13px] leading-7">{t(section.body)}</p>
                </section>
              ))}
            </div>

            <footer className="shrink-0 border-t border-black/[0.06] bg-[#F7F8FA] px-4 py-3">
              <Button className="w-full" onClick={() => setOpen(false)}>
                {t("work.guideGotIt")}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
