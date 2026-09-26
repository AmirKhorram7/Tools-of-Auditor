"use client";

import { useState } from "react";

import { cx } from "@/components/ui";
import type { CourseLevel, EduCategoryNode } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const LEVELS: CourseLevel[] = ["basic", "advanced", "professional"];

const LEVEL_KEYS = {
  basic: "edu.levelBasic",
  advanced: "edu.levelAdvanced",
  professional: "edu.levelProfessional",
} as const;

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={cx(
        "flex size-4 shrink-0 items-center justify-center rounded border-[1.5px]",
        on ? "border-navy-800 bg-navy-800 text-white" : "border-gray-300 bg-white",
      )}
      aria-hidden
    >
      {on ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 12l6 6L20 6" />
        </svg>
      ) : null}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cx("shrink-0 text-gray-500 transition-transform", !open && "-rotate-90")}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-start">
      <Check on={checked} />
      <span className={cx("text-[13px] leading-5", checked ? "font-semibold text-ink" : "text-gray-700")}>{label}</span>
    </button>
  );
}

export default function CourseFilter({
  categories,
  levels,
  folderIds,
  onLevels,
  onFolders,
}: {
  categories: EduCategoryNode[];
  levels: CourseLevel[];
  folderIds: number[];
  onLevels: (value: CourseLevel[]) => void;
  onFolders: (value: number[]) => void;
}) {
  const { t } = useI18n();
  const allOn = !levels.length && !folderIds.length;
  const [levelOpen, setLevelOpen] = useState(true);
  const [catsOpen, setCatsOpen] = useState(true);
  const [openCats, setOpenCats] = useState<Record<number, boolean>>({});

  const clear = () => {
    onLevels([]);
    onFolders([]);
  };

  return (
    <aside className="w-full rounded-2xl border border-gray-200 bg-white lg:sticky lg:top-24 lg:w-[300px] lg:shrink-0">
      <div className="flex flex-col gap-5 p-[22px]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-bold text-ink">{t("edu.filterTitle")}</p>
          <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-navy-800">
            {t("edu.filterClear")}
          </button>
        </div>

        <button
          type="button"
          onClick={clear}
          className={cx(
            "inline-flex h-8 w-full items-center justify-center rounded-[10px] text-[13px] font-semibold",
            allOn ? "bg-navy-900 text-white" : "border border-gray-200 bg-white text-ink hover:border-navy-800",
          )}
        >
          {t("edu.filterAll")}
        </button>

        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setLevelOpen((value) => !value)}
            className="flex w-full items-center justify-between"
            aria-expanded={levelOpen}
          >
            <span className="text-[13px] font-bold text-ink">{t("edu.filterLevel")}</span>
            <Chevron open={levelOpen} />
          </button>
          {levelOpen
            ? LEVELS.map((item) => (
                <CheckRow
                  key={item}
                  checked={levels.includes(item)}
                  label={t(LEVEL_KEYS[item])}
                  onToggle={() => onLevels(toggleValue(levels, item))}
                />
              ))
            : null}
        </div>

        {categories.length ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setCatsOpen((value) => !value)}
              className="flex w-full items-center justify-between"
              aria-expanded={catsOpen}
            >
              <span className="text-[13px] font-bold text-ink">{t("edu.filterCategory")}</span>
              <Chevron open={catsOpen} />
            </button>
            {catsOpen
              ? categories.map((cat) => {
                  const kidsOpen = openCats[cat.id] !== false && Boolean(cat.children.length);
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <CheckRow
                            checked={folderIds.includes(cat.id)}
                            label={cat.title}
                            onToggle={() => onFolders(toggleValue(folderIds, cat.id))}
                          />
                        </div>
                        {cat.children.length ? (
                          <button
                            type="button"
                            onClick={() => setOpenCats((row) => ({ ...row, [cat.id]: !kidsOpen }))}
                            className="p-1 text-gray-500"
                            aria-expanded={kidsOpen}
                            aria-label={cat.title}
                          >
                            <Chevron open={kidsOpen} />
                          </button>
                        ) : null}
                      </div>
                      {cat.children.length && kidsOpen ? (
                        <div className="mt-2.5 flex flex-col gap-2.5 ps-6">
                          {cat.children.map((child) => (
                            <CheckRow
                              key={child.id}
                              checked={folderIds.includes(child.id)}
                              label={child.title}
                              onToggle={() => onFolders(toggleValue(folderIds, child.id))}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
