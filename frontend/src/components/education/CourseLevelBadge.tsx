import { cx } from "@/components/ui";
import { courseLevel, type CourseLevel } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const KEYS: Record<CourseLevel, "edu.levelBasic" | "edu.levelAdvanced" | "edu.levelProfessional"> = {
  basic: "edu.levelBasic",
  advanced: "edu.levelAdvanced",
  professional: "edu.levelProfessional",
};

export default function CourseLevelBadge({ level }: { level?: string }) {
  const { t } = useI18n();
  const value = courseLevel(level);
  return (
    <span className={cx("inline-block rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-800")}>
      {t(KEYS[value])}
    </span>
  );
}
