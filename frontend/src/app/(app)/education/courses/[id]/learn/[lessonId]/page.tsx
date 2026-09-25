"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import EduProgressBar from "@/components/education/ProgressBar";
import { Alert, Button, PageLoader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  doneLessonIds,
  flattenLessons,
  markLessonDone,
  safeHtml,
  type EduComment,
  type EduCourse,
  type EduLesson,
  type EduQuiz,
} from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const OPTIONS = ["a", "b", "c", "d"] as const;

export default function LessonPlayerPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const courseId = Number(id);
  const currentId = Number(lessonId);
  const router = useRouter();
  const { t } = useI18n();
  const [course, setCourse] = useState<EduCourse | null>(null);
  const [quiz, setQuiz] = useState<EduQuiz | null>(null);
  const [comments, setComments] = useState<EduComment[]>([]);
  const [choice, setChoice] = useState<string>("");
  const [quizResult, setQuizResult] = useState<boolean | null>(null);
  const [examAnswer, setExamAnswer] = useState("");
  const [examSent, setExamSent] = useState(false);
  const [note, setNote] = useState("");
  const [done, setDone] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<EduCourse>(`/education/courses/${courseId}/`);
      setCourse(row);
      setDone(doneLessonIds(row.id));
      const lesson = flattenLessons(row).find((item) => item.id === currentId);
      if (lesson?.has_quiz) {
        const quizRow = await apiFetch<EduQuiz>(`/education/lessons/${currentId}/quiz/`);
        setQuiz(quizRow);
      } else {
        setQuiz(null);
      }
      const notes = await apiFetch<EduComment[]>(
        `/education/courses/${courseId}/comments/?lesson=${currentId}`,
      );
      setComments(Array.isArray(notes) ? notes : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [courseId, currentId, t]);

  useEffect(() => {
    if (Number.isFinite(courseId) && Number.isFinite(currentId)) load();
  }, [courseId, currentId, load]);

  const lessons = useMemo(() => (course ? flattenLessons(course) : []), [course]);
  const lesson = lessons.find((item) => item.id === currentId) ?? null;
  const index = lessons.findIndex((item) => item.id === currentId);
  const next = index >= 0 ? lessons[index + 1] : undefined;
  const prev = index > 0 ? lessons[index - 1] : undefined;

  const go = (target: EduLesson) => {
    router.push(`/education/courses/${courseId}/learn/${target.id}`);
  };

  const complete = async () => {
    try {
      await apiFetch(`/education/lessons/${currentId}/complete/`, { method: "POST" });
      markLessonDone(courseId, currentId);
      setDone(doneLessonIds(courseId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        markLessonDone(courseId, currentId);
        setDone(doneLessonIds(courseId));
        return;
      }
      setError(err instanceof ApiError ? err.message : t("edu.completeFail"));
    }
  };

  const submitQuiz = async () => {
    try {
      const result = await apiFetch<{ is_correct: boolean }>(
        `/education/lessons/${currentId}/quiz/attempt/`,
        { method: "POST", body: { selected_option: choice } },
      );
      setQuizResult(result.is_correct);
      if (result.is_correct) {
        markLessonDone(courseId, currentId);
        setDone(doneLessonIds(courseId));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.quizFail"));
    }
  };

  const submitExam = async () => {
    try {
      await apiFetch(`/education/lessons/${currentId}/exam/submit/`, {
        method: "POST",
        body: { answer: examAnswer },
      });
      setExamSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.examFail"));
    }
  };

  const sendNote = async () => {
    try {
      const row = await apiFetch<EduComment>(`/education/courses/${courseId}/comments/`, {
        method: "POST",
        body: { body: note, lesson: currentId },
      });
      setComments((rows) => [...rows, row]);
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("edu.commentFail"));
    }
  };

  if (loading) return <PageLoader />;
  if (!course || !lesson) return <Alert>{error || t("edu.notFound")}</Alert>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
        <Link href={`/education/courses/${course.id}`} className="text-xs font-medium text-navy-800 hover:text-link">
          {course.title}
        </Link>
        <div className="mt-3">
          <EduProgressBar done={done.length} total={lessons.length} label={t("edu.yourProgress")} />
        </div>
        <div className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto">
          {course.modules.map((module) => (
            <div key={module.id}>
              <p className="px-1 text-[11px] font-bold text-gray-500">{module.title}</p>
              <ul className="mt-1 space-y-0.5">
                {module.lessons.map((item) => {
                  const active = item.id === currentId;
                  const complete = done.includes(item.id);
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/education/courses/${course.id}/learn/${item.id}`}
                        className={
                          active
                            ? "flex items-center gap-2 rounded-lg bg-navy-800 px-2 py-1.5 text-xs font-medium text-white"
                            : "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink hover:bg-gray-50"
                        }
                      >
                        <span
                          className={
                            complete
                              ? "size-2 shrink-0 rounded-full bg-brand-500"
                              : "size-2 shrink-0 rounded-full border border-gray-300"
                          }
                        />
                        <span className="line-clamp-2">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold text-brand-800">{t("edu.lesson")}</p>
          <h1 className="mt-1 text-lg font-bold text-ink">{lesson.title}</h1>
          {lesson.video_url ? (
            <p className="mt-3">
              <a href={lesson.video_url} className="text-sm text-navy-800 hover:text-link" target="_blank" rel="noreferrer">
                {t("edu.watchVideo")}
              </a>
            </p>
          ) : null}
          <div
            className="mt-4 space-y-3 text-sm leading-7 text-ink [&_a]:text-navy-800 [&_li]:ms-5 [&_ol]:list-decimal [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: safeHtml(lesson.body) }}
          />

          {quiz ? (
            <div className="mt-5 rounded-xl border border-gray-200 p-3">
              <p className="text-sm font-bold text-ink">{quiz.prompt}</p>
              <div className="mt-2 space-y-1.5">
                {OPTIONS.map((key) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
                    <input
                      type="radio"
                      name="quiz"
                      value={key}
                      checked={choice === key}
                      onChange={() => setChoice(key)}
                    />
                    <span>{quiz[`option_${key}` as const]}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={submitQuiz} disabled={!choice}>
                  {t("edu.checkAnswer")}
                </Button>
                {quizResult === true ? <span className="text-xs font-medium text-green-700">{t("edu.correct")}</span> : null}
                {quizResult === false ? <span className="text-xs font-medium text-red-600">{t("edu.wrong")}</span> : null}
              </div>
            </div>
          ) : null}

          {lesson.has_exam ? (
            <div className="mt-5 rounded-xl border border-gray-200 p-3">
              <p className="text-sm font-bold text-ink">{t("edu.exam")}</p>
              <textarea
                value={examAnswer}
                onChange={(event) => setExamAnswer(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder={t("edu.examPlaceholder")}
              />
              <div className="mt-2">
                <Button size="sm" onClick={submitExam} disabled={!examAnswer.trim() || examSent}>
                  {examSent ? t("edu.examSent") : t("edu.sendExam")}
                </Button>
              </div>
            </div>
          ) : null}

          {!lesson.has_quiz && !lesson.has_exam ? (
            <div className="mt-4">
              <Button size="sm" variant="secondary" onClick={complete}>
                {t("edu.markDone")}
              </Button>
            </div>
          ) : null}
        </article>

        <div className="flex flex-wrap justify-between gap-2">
          {prev ? (
            <Button variant="secondary" onClick={() => go(prev)}>
              {t("edu.prev")}
            </Button>
          ) : (
            <span />
          )}
          {next ? (
            <Button onClick={() => go(next)}>{t("edu.next")}</Button>
          ) : (
            <Link href={`/education/courses/${course.id}`}>
              <Button>{t("edu.backToCourse")}</Button>
            </Link>
          )}
        </div>

        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-ink">{t("edu.lessonQuestions")}</h2>
          <div className="mt-3 space-y-2">
            {comments.map((row) => (
              <p key={row.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-ink">
                {row.body}
              </p>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            placeholder={t("edu.askTeacher")}
          />
          <div className="mt-2">
            <Button size="sm" onClick={sendNote} disabled={!note.trim()}>
              {t("edu.sendQuestion")}
            </Button>
          </div>
        </article>
      </section>
    </div>
  );
}
