"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CourseCard from "@/components/education/CourseCard";
import { Alert, Button } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { currentUserId, type EduMe, type EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function EducationStudioPage() {
  const { t } = useI18n();
  const teacherId = currentUserId();
  const [me, setMe] = useState<EduMe | null>(null);
  const [page, setPage] = useState<EduTeacher | null>(null);
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<EduMe>("/education/me/")
      .then(setMe)
      .catch(() => setMe(null));
    if (!teacherId) return;
    apiFetch<EduTeacher>(`/education/teachers/${teacherId}/`)
      .then((row) => {
        setPage(row);
        setBio(row.bio);
      })
      .catch(() => setPage({ user: teacherId, bio: "", courses: [] }));
  }, [teacherId]);

  const saveBio = async () => {
    setError(null);
    setSaved(false);
    try {
      const row = await apiFetch<{ user: number; bio: string }>("/education/teacher-profile/", {
        method: "PUT",
        body: { bio },
      });
      setBio(row.bio);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.studioDenied"));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-ink">{t("edu.studio")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("edu.studioHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={me?.cms_url || "/cms/"}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink hover:bg-brand-700 hover:text-white"
          >
            {t("edu.makeCourse")}
          </a>
          <Link href="/education">
            <Button variant="secondary">{t("edu.previewStudent")}</Button>
          </Link>
        </div>
      </section>
      {error ? <Alert>{error}</Alert> : null}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-ink">{t("edu.teacherBio")}</h2>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={4}
          className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={saveBio}>
            {t("common.save")}
          </Button>
          {saved ? <span className="text-xs text-green-700">{t("edu.saved")}</span> : null}
        </div>
      </section>
      {page?.courses.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {page.courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">{t("edu.studioEmpty")}</p>
      )}
    </div>
  );
}
