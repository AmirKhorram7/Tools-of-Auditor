"use client";

import { useEffect, useMemo, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import CourseFilter from "@/components/education/CourseFilter";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  courseCategoryTree,
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
  const [levels, setLevels] = useState<CourseLevel[]>([]);
  const [folderIds, setFolderIds] = useState<number[]>([]);

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

  const categories = useMemo(() => courseCategoryTree(courses), [courses]);
  const visible = useMemo(() => filterCourses(courses, levels, folderIds), [courses, levels, folderIds]);

  if (loading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[1.875rem] font-bold leading-tight text-ink">{t("edu.catalogTitle")}</h1>
          <p className="text-[13px] leading-6 text-gray-500">{t("edu.catalogHint")}</p>
        </div>
        {me?.can_build_course ? (
          <a
            href={me.cms_url || "/cms/"}
            className="inline-flex h-11 items-center justify-center rounded-[10px] bg-brand-500 px-[22px] text-sm font-semibold text-white hover:bg-brand-700"
          >
            {t("edu.makeCourse")}
          </a>
        ) : null}
      </div>

      <p className="text-[13px] text-gray-500">{t("edu.catalogCount", { n: n(visible.length) })}</p>
      {error ? <Alert>{error}</Alert> : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <CourseFilter
          categories={categories}
          levels={levels}
          folderIds={folderIds}
          onLevels={setLevels}
          onFolders={setFolderIds}
        />
        <div className="min-w-0 flex-1">
          {visible.length === 0 ? (
            <p className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-[15px] text-gray-500">
              {courses.length ? t("edu.filterEmpty") : t("edu.empty")}
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
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
