"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch, mediaUrl } from "@/lib/api";
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

  const photo = mediaUrl(page.photo_url);
  const name = page.name || t("edu.teacher");
  const socials = [
    page.website ? { href: page.website, label: t("edu.teacherWebsite") } : null,
    page.linkedin_url ? { href: page.linkedin_url, label: t("edu.teacherLinkedin") } : null,
    page.telegram_url ? { href: page.telegram_url, label: t("edu.teacherTelegram") } : null,
    page.instagram_url ? { href: page.instagram_url, label: t("edu.teacherInstagram") } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-brand-800">{t("edu.teacher")}</p>
        <div className="mt-3 flex items-start gap-4">
          {photo ? (
            <img src={photo} alt="" className="size-20 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xl font-bold text-brand-400">
              {name.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink">{name}</h1>
            {page.headline ? <p className="mt-1 text-sm text-gray-600">{page.headline}</p> : null}
            <p className="mt-2 text-sm leading-6 text-gray-600">{page.bio || t("edu.noBio")}</p>
            {socials.length ? (
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                {socials.map((item) => (
                  <a key={item.href} href={item.href} className="text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {page.projects?.length ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-ink">{t("edu.teacherProjects")}</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-gray-600">
            {page.projects.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-bold text-ink">{t("edu.teacherCourses")}</h2>
        {page.courses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {page.courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("edu.studioEmpty")}</p>
        )}
      </div>
      <Link href="/education" className="inline-block text-xs font-medium text-navy-800 hover:text-link">
        {t("edu.backCatalog")}
      </Link>
    </div>
  );
}
