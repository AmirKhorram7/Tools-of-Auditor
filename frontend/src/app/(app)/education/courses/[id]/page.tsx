"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import CourseLevelBadge from "@/components/education/CourseLevelBadge";
import CourseOutline from "@/components/education/CourseOutline";
import EduProgressBar from "@/components/education/ProgressBar";
import TeacherCard from "@/components/education/TeacherCard";
import { Alert, Button, PageLoader } from "@/components/ui";
import { ApiError, apiFetch, mediaUrl } from "@/lib/api";
import {
  courseLevel,
  courseMinutes,
  doneLessonIds,
  flattenLessons,
  type EduComment,
  type EduCourse,
} from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function CourseSyllabusPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const { t, n } = useI18n();
  const [course, setCourse] = useState<EduCourse | null>(null);
  const [comments, setComments] = useState<EduComment[]>([]);
  const [body, setBody] = useState("");
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [row, noteRows] = await Promise.all([
        apiFetch<EduCourse>(`/education/courses/${courseId}/`),
        apiFetch<EduComment[]>(`/education/courses/${courseId}/comments/`),
      ]);
      setCourse(row);
      setComments(Array.isArray(noteRows) ? noteRows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    if (Number.isFinite(courseId)) load();
  }, [courseId, load]);

  const lessons = useMemo(() => (course ? flattenLessons(course) : []), [course]);
  const done = course ? doneLessonIds(course.id) : [];
  const firstOpen = lessons.find((lesson) => !done.includes(lesson.id)) ?? lessons[0];
  const photo = mediaUrl(course?.thumbnail_url);

  const like = async () => {
    try {
      await apiFetch(`/education/courses/${courseId}/like/`, { method: "POST" });
      setLiked(true);
      if (course) setCourse({ ...course, like_count: course.like_count + (liked ? 0 : 1) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.likeFail"));
    }
  };

  const sendComment = async () => {
    try {
      const row = await apiFetch<EduComment>(`/education/courses/${courseId}/comments/`, {
        method: "POST",
        body: { body },
      });
      setComments((rows) => [...rows, row]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.commentFail"));
    }
  };

  if (loading) return <PageLoader />;
  if (!course) return <Alert>{error || t("edu.notFound")}</Alert>;

  return (
    <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
      <aside className="flex w-full flex-col gap-4 lg:sticky lg:top-24 lg:w-[22.5rem] lg:shrink-0">
        <TeacherCard teacher={course.teacher} />
        <CourseOutline course={course} done={done} sticky={false} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Link href="/education" className="text-[13px] text-gray-500 hover:text-navy-800">
          {t("edu.backCatalog")} ‹
        </Link>

        <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-2xl bg-navy-900 sm:h-[320px]">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-brand-400">{t("edu.course")}</span>
          )}
        </div>

        <CourseLevelBadge level={courseLevel(course.level)} />
        <h1 className="text-[1.75rem] font-bold leading-tight text-ink sm:text-[2rem]">{course.title}</h1>
        {course.summary ? (
          <p className="max-w-xl text-[15px] leading-8 text-gray-700">{course.summary}</p>
        ) : null}

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
          <span>{t("edu.modulesCount", { n: n(course.modules.length) })}</span>
          <span aria-hidden>·</span>
          <span>{t("edu.lessonsCount", { n: n(lessons.length) })}</span>
          <span aria-hidden>·</span>
          <span>{t("edu.minutes", { n: n(courseMinutes(course)) })}</span>
          <span aria-hidden>·</span>
          <span>{t("edu.likes", { n: n(course.like_count) })}</span>
        </p>

        <EduProgressBar done={done.length} total={lessons.length} label={t("edu.yourProgress")} />

        <div className="flex flex-wrap gap-3">
          {firstOpen ? (
            <Link
              href={`/education/courses/${course.id}/learn/${firstOpen.id}`}
              className="inline-flex h-11 items-center justify-center rounded-[10px] bg-brand-500 px-6 text-sm font-semibold text-ink hover:bg-brand-700 hover:text-white"
            >
              {done.length ? t("edu.continue") : t("edu.start")}
            </Link>
          ) : null}
          <Button variant="secondary" onClick={like} className="h-11 px-6 text-sm font-semibold">
            {t("edu.like")}
          </Button>
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <section className="flex flex-col gap-3.5 rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-bold text-ink">{t("edu.courseQuestions")}</h2>
          {comments.length ? (
            <div className="space-y-2">
              {comments.map((row) => (
                <p key={row.id} className="rounded-lg bg-gray-50 px-3 py-2 text-[14px] leading-6 text-ink">
                  {row.body}
                </p>
              ))}
            </div>
          ) : null}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            className="min-h-16 w-full resize-none rounded-[10px] border border-gray-200 px-3 py-3 text-[14px] leading-6 text-ink outline-none placeholder:text-gray-400 focus:border-navy-800"
            placeholder={t("edu.askTeacher")}
          />
          <div>
            <Button onClick={sendComment} disabled={!body.trim()} className="h-11 px-6 text-sm font-semibold">
              {t("edu.sendQuestion")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
