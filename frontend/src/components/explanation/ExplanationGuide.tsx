"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const CHIP_KEYS = [
  { key: "exp.guide.chipFolder", color: "#14233A" },
  { key: "exp.guide.chipProcess", color: "#1A2B49" },
  { key: "exp.guide.chipStep", color: "#C2940A" },
  { key: "exp.guide.chipTree", color: "#1E3328" },
  { key: "exp.guide.chipEditor", color: "#4A2C6A" },
] as const;

const SECTION_KEYS = [
  {
    title: "exp.guide.structureTitle",
    body: "exp.guide.structureBody",
    tone: "bg-[#EEF3FA] text-[#14233A] border-[#C5D3E8]",
    mark: "1",
  },
  {
    title: "exp.guide.treeTitle",
    body: "exp.guide.treeBody",
    tone: "bg-[#EEF6F1] text-[#1E3328] border-[#C5DCCE]",
    mark: "2",
  },
  {
    title: "exp.guide.stepTitle",
    body: "exp.guide.stepBody",
    tone: "bg-[#F3F0FA] text-[#3A2430] border-[#D8CDE6]",
    mark: "3",
  },
  {
    title: "exp.guide.editorTitle",
    body: "exp.guide.editorBody",
    tone: "bg-[#FFF6E6] text-[#5C4308] border-[#E8D19A]",
    mark: "4",
  },
  {
    title: "exp.guide.optionsTitle",
    body: "exp.guide.optionsBody",
    tone: "bg-[#EEF3FA] text-[#14233A] border-[#C5D3E8]",
    mark: "5",
  },
  {
    title: "exp.guide.tableTitle",
    body: "exp.guide.tableBody",
    tone: "bg-[#F3F0FA] text-[#3A2430] border-[#D8CDE6]",
    mark: "6",
  },
  {
    title: "exp.guide.linkTitle",
    body: "exp.guide.linkBody",
    tone: "bg-[#EEF6F1] text-[#1E3328] border-[#C5DCCE]",
    mark: "7",
  },
  {
    title: "exp.guide.colorTitle",
    body: "exp.guide.colorBody",
    tone: "bg-[#FFF6E6] text-[#5C4308] border-[#E8D19A]",
    mark: "8",
  },
  {
    title: "exp.guide.rolesTitle",
    body: "exp.guide.rolesBody",
    tone: "bg-[#FDECEC] text-[#6B1C1C] border-[#E8B4B4]",
    mark: "9",
  },
] as const;

export default function ExplanationGuide({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant={compact ? "secondary" : "primary"}
        onClick={() => setOpen(true)}
      >
        {t("exp.guide")}
      </Button>
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
                    {t("exp.guideKicker")}
                  </p>
                  <h2 className="mt-0.5 text-lg font-bold">{t("exp.guideTitle")}</h2>
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
              <p className="mt-2 text-sm leading-6 text-white/85">{t("exp.guideIntro")}</p>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
                {CHIP_KEYS.map((chip) => (
                  <span
                    key={chip.key}
                    className="shrink-0 rounded-md px-2 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: chip.color }}
                  >
                    {t(chip.key)}
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
                {t("exp.guideGotIt")}
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
