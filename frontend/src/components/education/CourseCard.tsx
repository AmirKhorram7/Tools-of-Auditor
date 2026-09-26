import Link from "next/link";

import CourseLevelBadge from "@/components/education/CourseLevelBadge";
import { mediaUrl } from "@/lib/api";
import type { EduCourseCard } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function CourseCard({ course }: { course: EduCourseCard }) {
  const { t, n } = useI18n();
  const photo = mediaUrl(course.thumbnail_url);
  const teacher = course.teacher?.name || "";
  const chapters = course.chapter_count ?? 0;
  const lessons = course.lesson_count ?? 0;

  return (
    <Link
      href={`/education/courses/${course.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_16px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
    >
      {photo ? (
        <img src={photo} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-navy-800 text-sm font-bold text-brand-400">
          {t("edu.course")}
        </div>
      )}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        {teacher ? <p className="text-xs font-medium text-gray-500">{teacher}</p> : null}
        <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-6 text-ink group-hover:text-navy-800">
          {course.title}
        </h3>
        {course.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">{course.summary}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          <span>{t("edu.likes", { n: n(course.like_count) })}</span>
          {lessons ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("edu.lessonsCount", { n: n(lessons) })}</span>
            </>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          <CourseLevelBadge level={course.level} />
          {course.category_title ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-navy-800">
              {course.category_title}
            </span>
          ) : null}
          {chapters ? (
            <span className="text-[11px] text-gray-400">{t("edu.modulesCount", { n: n(chapters) })}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
