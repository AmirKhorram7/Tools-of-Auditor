"use client";

import { useEffect, useMemo, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import CourseFilter from "@/components/education/CourseFilter";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  courseCategories,
  filterCourses,
  type CourseLevel,
  type EduCourseCard,
  type EduMe,
} from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function EducationCatalogPage() {
  const { t, n } = useI18n();
  const [courses, setCourses] = useState<EduCourseCard[]>([]);
  const [me, setMe] = useState<EduMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<CourseLevel | "">("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

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

  const categories = useMemo(() => courseCategories(courses), [courses]);
  const visible = useMemo(() => filterCourses(courses, level, categoryId), [courses, level, categoryId]);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{t("edu.catalogTitle")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("edu.catalogHint")}</p>
        </div>
        {me?.can_build_course ? (
          <a
            href={me.cms_url || "/cms/"}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-navy-900 hover:bg-brand-400"
          >
            {t("edu.makeCourse")}
          </a>
        ) : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <CourseFilter
          categories={categories}
          level={level}
          categoryId={categoryId}
          onLevel={setLevel}
          onCategory={setCategoryId}
        />
        <div className="min-w-0">
          <p className="mb-4 text-sm text-gray-500">{t("edu.catalogCount", { n: n(visible.length) })}</p>
          {visible.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
              {courses.length ? t("edu.filterEmpty") : t("edu.empty")}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
