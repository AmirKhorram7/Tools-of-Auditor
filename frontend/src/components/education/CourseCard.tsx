import Link from "next/link";

import type { EduCourseCard } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function CourseCard({ course }: { course: EduCourseCard }) {
  const { t, n } = useI18n();
  return (
    <Link
      href={`/education/courses/${course.id}`}
      className="flex min-h-[10rem] flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-500 hover:shadow-md"
    >
      <p className="text-[11px] font-semibold text-brand-800">{t("edu.course")}</p>
      <h3 className="mt-1 text-sm font-bold leading-6 text-ink">{course.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-xs leading-5 text-gray-500">{course.summary}</p>
      <p className="mt-3 text-[11px] text-gray-500">{t("edu.likes", { n: n(course.like_count) })}</p>
    </Link>
  );
}
