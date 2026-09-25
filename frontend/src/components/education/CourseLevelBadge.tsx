import { cx } from "@/components/ui";
import { courseLevel, type CourseLevel } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const STYLES: Record<CourseLevel, string> = {
  basic: "bg-brand-100 text-brand-800",
  advanced: "bg-navy-800 text-white",
  professional: "bg-navy-900 text-brand-400",
};

const KEYS: Record<CourseLevel, "edu.levelBasic" | "edu.levelAdvanced" | "edu.levelProfessional"> = {
  basic: "edu.levelBasic",
  advanced: "edu.levelAdvanced",
  professional: "edu.levelProfessional",
};

export default function CourseLevelBadge({ level }: { level?: string }) {
  const { t } = useI18n();
  const value = courseLevel(level);
  return (
    <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold", STYLES[value])}>
      {t(KEYS[value])}
    </span>
  );
}
