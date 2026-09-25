"use client";

import { useEffect, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import type { EduCourseCard, EduMe } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function EducationCatalogPage() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<EduCourseCard[]>([]);
  const [me, setMe] = useState<EduMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all([
      apiList<EduCourseCard>("/education/courses/"),
      apiFetch<EduMe>("/education/me/").catch(() => null),
    ])
      .then(([rows, profile]) => {
        if (!live) return;
        setCourses(rows);
        setMe(profile);
      })
      .catch((err) => {
        if (live) setError(err instanceof ApiError ? err.message : t("edu.loadFail"));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [t]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-gradient-to-l from-navy-900 to-navy-700 px-5 py-5 text-white sm:px-6">
        <p className="text-xs font-semibold text-brand-400">{t("nav.education")}</p>
        <h1 className="mt-1 text-xl font-bold">{t("edu.catalogTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-300">{t("edu.catalogHint")}</p>
        {me?.can_build_course ? (
          <div className="mt-4">
            <a
              href={me.cms_url || "/cms/"}
              className="mt-1 inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-navy-900 hover:bg-brand-400"
            >
              {t("edu.makeCourse")}
            </a>
            <p className="mt-2 text-xs text-gray-300">
              {t("edu.cmsLoginHint", { phone: me.login })}
              {me.default_password ? ` ${t("edu.cmsDefaultPassword", { password: me.default_password })}` : ""}
            </p>
          </div>
        ) : null}
      </section>
      {error ? <Alert>{error}</Alert> : null}
      {courses.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          {t("edu.empty")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
