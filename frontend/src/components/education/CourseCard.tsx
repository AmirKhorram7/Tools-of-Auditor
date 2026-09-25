import Link from "next/link";

import type { EduCourseCard } from "@/lib/education";
import { courseLevel } from "@/lib/education";
import { useI18n } from "@/lib/i18n";
import CourseLevelBadge from "@/components/education/CourseLevelBadge";

export default function CourseCard({ course }: { course: EduCourseCard }) {
  const { t, n } = useI18n();
  return (
    <Link
      href={`/education/courses/${course.id}`}
      className="flex min-h-[10rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-brand-500 hover:shadow-md"
    >
      {course.thumbnail_url ? (
        <img src={course.thumbnail_url} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-navy-800 text-sm font-bold text-brand-400">
          {t("edu.course")}
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-brand-800">{t("edu.course")}</p>
          <CourseLevelBadge level={courseLevel(course.level)} />
        </div>
        <h3 className="mt-1 text-sm font-bold leading-6 text-ink">{course.title}</h3>
        <p className="mt-1 line-clamp-3 flex-1 text-xs leading-5 text-gray-500">{course.summary}</p>
        <p className="mt-3 text-[11px] text-gray-500">{t("edu.likes", { n: n(course.like_count) })}</p>
      </div>
    </Link>
  );
}
