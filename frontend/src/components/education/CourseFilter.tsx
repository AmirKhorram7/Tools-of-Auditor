"use client";

import { cx } from "@/components/ui";
import type { CourseLevel } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const LEVELS: CourseLevel[] = ["basic", "advanced", "professional"];

const LEVEL_KEYS = {
  basic: "edu.levelBasic",
  advanced: "edu.levelAdvanced",
  professional: "edu.levelProfessional",
} as const;

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "block w-full rounded-lg px-3 py-2 text-start text-sm",
        active ? "bg-navy-800 font-medium text-white" : "text-ink hover:bg-gray-50",
      )}
    >
      {label}
    </button>
  );
}

export default function CourseFilter({
  categories,
  level,
  categoryId,
  onLevel,
  onCategory,
}: {
  categories: { id: number; title: string }[];
  level: CourseLevel | "";
  categoryId: number | null;
  onLevel: (value: CourseLevel | "") => void;
  onCategory: (value: number | null) => void;
}) {
  const { t } = useI18n();

  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] lg:sticky lg:top-24 lg:w-[16.5rem]">
      <p className="px-3 pb-2 text-xs font-bold text-gray-500">{t("edu.filterTitle")}</p>
      <FilterButton
        active={!level && !categoryId}
        label={t("edu.filterAll")}
        onClick={() => {
          onLevel("");
          onCategory(null);
        }}
      />

      <p className="mt-4 px-3 pb-1 text-xs font-bold text-gray-500">{t("edu.filterLevel")}</p>
      {LEVELS.map((item) => (
        <FilterButton
          key={item}
          active={level === item}
          label={t(LEVEL_KEYS[item])}
          onClick={() => onLevel(level === item ? "" : item)}
        />
      ))}

      {categories.length ? (
        <>
          <p className="mt-4 px-3 pb-1 text-xs font-bold text-gray-500">{t("edu.filterCategory")}</p>
          {categories.map((item) => (
            <FilterButton
              key={item.id}
              active={categoryId === item.id}
              label={item.title}
              onClick={() => onCategory(categoryId === item.id ? null : item.id)}
            />
          ))}
        </>
      ) : null}
    </aside>
  );
}
