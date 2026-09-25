"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import CourseLevelBadge from "@/components/education/CourseLevelBadge";
import CourseOutline from "@/components/education/CourseOutline";
import EduProgressBar from "@/components/education/ProgressBar";
import TeacherCard from "@/components/education/TeacherCard";
import { Alert, Button, PageLoader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
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
    <div className="grid items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="space-y-3 lg:sticky lg:top-24">
        <CourseOutline course={course} done={done} sticky={false} />
        <TeacherCard teacher={course.teacher} />
      </div>
      <div className="min-w-0 space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <Link href="/education" className="text-xs font-medium text-navy-800 hover:text-link">
          {t("edu.backCatalog")}
        </Link>
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt="" className="mt-3 h-48 w-full rounded-xl object-cover sm:h-56" />
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CourseLevelBadge level={courseLevel(course.level)} />
        </div>
        <h1 className="mt-2 text-xl font-bold text-ink">{course.title}</h1>
        <p className="mt-1 text-sm leading-6 text-gray-600">{course.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span>{t("edu.modulesCount", { n: n(course.modules.length) })}</span>
          <span>{t("edu.lessonsCount", { n: n(lessons.length) })}</span>
          <span>{t("edu.minutes", { n: n(courseMinutes(course)) })}</span>
          <span>{t("edu.likes", { n: n(course.like_count) })}</span>
        </div>
        <div className="mt-4 max-w-md">
          <EduProgressBar done={done.length} total={lessons.length} label={t("edu.yourProgress")} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {firstOpen ? (
            <Link href={`/education/courses/${course.id}/learn/${firstOpen.id}`}>
              <Button>{done.length ? t("edu.continue") : t("edu.start")}</Button>
            </Link>
          ) : null}
          <Button variant="secondary" onClick={like}>
            {t("edu.like")}
          </Button>
        </div>
      </section>

      {error ? <Alert>{error}</Alert> : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-ink">{t("edu.courseQuestions")}</h2>
        <div className="mt-3 space-y-2">
          {comments.map((row) => (
            <p key={row.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-ink">
              {row.body}
            </p>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          placeholder={t("edu.askTeacher")}
        />
        <div className="mt-2">
          <Button size="sm" onClick={sendComment} disabled={!body.trim()}>
            {t("edu.sendQuestion")}
          </Button>
        </div>
      </section>
      </div>
    </div>
  );
}
