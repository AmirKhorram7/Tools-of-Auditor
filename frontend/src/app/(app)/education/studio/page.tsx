"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import TeacherProfileEditor from "@/components/education/TeacherProfileEditor";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { currentUserId, type EduMe, type EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function EducationStudioPage() {
  const { t } = useI18n();
  const teacherId = currentUserId();
  const [me, setMe] = useState<EduMe | null>(null);
  const [page, setPage] = useState<EduTeacher | null>(null);

  useEffect(() => {
    apiFetch<EduMe>("/education/me/")
      .then(setMe)
      .catch(() => setMe(null));
    if (!teacherId) return;
    apiFetch<EduTeacher>(`/education/teachers/${teacherId}/`)
      .then(setPage)
      .catch(() => setPage({ user: teacherId, bio: "", courses: [] }));
  }, [teacherId]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-ink">{t("edu.studio")}</h1>
        <p className="mt-2 text-[15px] leading-7 text-gray-600">{t("edu.studioHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={me?.cms_url || "/cms/"}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink hover:bg-brand-700 hover:text-white"
          >
            {t("edu.makeCourse")}
          </a>
          {teacherId ? (
            <Link href={`/education/teachers/${teacherId}`}>
              <Button variant="secondary">{t("edu.previewTeacherPage")}</Button>
            </Link>
          ) : null}
          <Link href="/education">
            <Button variant="secondary">{t("edu.previewStudent")}</Button>
          </Link>
        </div>
      </section>
      <TeacherProfileEditor />
      {page?.courses.length ? (
        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">{t("edu.teacherCourses")}</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {page.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{t("edu.studioEmpty")}</p>
      )}
    </div>
  );
}
