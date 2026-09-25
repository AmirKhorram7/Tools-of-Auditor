"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function TeacherPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [page, setPage] = useState<EduTeacher | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<EduTeacher>(`/education/teachers/${id}/`)
      .then(setPage)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("edu.loadFail")));
  }, [id, t]);

  if (!page && !error) return <PageLoader />;
  if (!page) return <Alert>{error}</Alert>;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-brand-800">{t("edu.teacher")}</p>
        <p className="mt-2 text-sm leading-6 text-gray-600">{page.bio || t("edu.noBio")}</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {page.courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
