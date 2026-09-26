"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import CourseOutline from "@/components/education/CourseOutline";
import LessonConversation from "@/components/education/LessonConversation";
import LessonStream from "@/components/education/LessonStream";
import { Alert, Button, cx, PageLoader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  doneLessonIds,
  flattenLessons,
  markLessonDone,
  unmarkLessonDone,
  type EduComment,
  type EduCourse,
  type EduQuiz,
} from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const OPTIONS = ["a", "b", "c", "d"] as const;

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <path d="M4 12l6 6L20 6" />
    </svg>
  );
}

export default function LessonPlayerPage() {
  const { id, lessonId } = useParams<{ id: string; lessonId: string }>();
  const courseId = Number(id);
  const currentId = Number(lessonId);
  const router = useRouter();
  const { t, n } = useI18n();
  const [course, setCourse] = useState<EduCourse | null>(null);
  const [quiz, setQuiz] = useState<EduQuiz | null>(null);
  const [comments, setComments] = useState<EduComment[]>([]);
  const [choice, setChoice] = useState("");
  const [quizResult, setQuizResult] = useState<boolean | null>(null);
  const [examAnswer, setExamAnswer] = useState("");
  const [examSent, setExamSent] = useState(false);
  const [done, setDone] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lesson" | "talk">("lesson");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTab("lesson");
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
  const chapterIndex = course?.modules.findIndex((module) => module.lessons.some((item) => item.id === currentId)) ?? 0;
  const lessonInChapter =
    (course?.modules[chapterIndex]?.lessons.findIndex((item) => item.id === currentId) ?? 0) + 1;
  const finished = done.includes(currentId);
  const index = lessons.findIndex((item) => item.id === currentId);
  const next = index >= 0 ? lessons[index + 1] : undefined;

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

  const toggleDone = () => {
    if (finished) {
      unmarkLessonDone(courseId, currentId);
      setDone(doneLessonIds(courseId));
      return;
    }
    complete();
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

  if (loading) return <PageLoader />;
  if (!course || !lesson) return <Alert>{error || t("edu.notFound")}</Alert>;

  return (
    <div>
      <div className="flex flex-col-reverse items-start gap-8 lg:flex-row">
        <CourseOutline course={course} done={done} activeLessonId={currentId} sticky={false} tone="green" />

        <div className="flex min-w-0 w-full flex-1 flex-col gap-5">
          <div className="flex w-fit gap-1 rounded-[10px] bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setTab("lesson")}
              className={cx(
                "rounded-lg px-[22px] py-2 text-[13px] font-semibold",
                tab === "lesson" ? "bg-navy-900 text-white" : "text-gray-600",
              )}
            >
              {t("edu.lesson")}
            </button>
            <button
              type="button"
              onClick={() => setTab("talk")}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-lg px-[22px] py-2 text-[13px] font-semibold",
                tab === "talk" ? "bg-navy-900 text-white" : "text-gray-600",
              )}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M4 4h16v12H8l-4 4z" />
              </svg>
              {t("edu.talk")}
            </button>
          </div>

          {error ? <Alert>{error}</Alert> : null}

          {tab === "lesson" ? (
              <article className="flex flex-col gap-5 rounded-2xl border border-gray-200 bg-white p-7">
                <Link href={`/education/courses/${course.id}`} className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-navy-800 hover:text-brand-800">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                  {t("edu.backToCourse")}
                </Link>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] text-gray-500">
                    {t("edu.chapterLesson", { c: n(chapterIndex + 1), l: n(lessonInChapter) })}
                  </p>
                  <h1 className="text-[26px] font-bold leading-tight text-ink">{lesson.title}</h1>
                </div>
                <LessonStream lesson={lesson} />

                {quiz ? (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-[15px] font-bold text-ink">{quiz.prompt}</p>
                    <div className="mt-2 space-y-1.5">
                      {OPTIONS.map((key) => (
                        <label key={key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[14px] hover:bg-gray-50">
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
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-[15px] font-bold text-ink">{t("edu.exam")}</p>
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

                <div className="h-px bg-gray-200" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleDone}
                    className={cx(
                      "inline-flex h-[46px] items-center gap-2.5 rounded-[10px] border-2 px-5 text-sm font-semibold",
                      finished
                        ? "border-green-600 bg-green-600 text-white"
                        : "border-green-600 bg-white text-ink hover:bg-green-50",
                    )}
                  >
                    <span
                      className={cx(
                        "flex size-[18px] items-center justify-center rounded-[5px] border-[1.5px]",
                        finished ? "border-white bg-white text-green-600" : "border-green-600",
                      )}
                    >
                      {finished ? <CheckIcon /> : null}
                    </span>
                    {t("edu.markDone")}
                  </button>
                  <button
                    type="button"
                    disabled={!finished}
                    onClick={() => {
                      if (!finished) return;
                      if (next) router.push(`/education/courses/${course.id}/learn/${next.id}`);
                      else router.push(`/education/courses/${course.id}`);
                    }}
                    className={cx(
                      "inline-flex h-[46px] items-center gap-2 rounded-[10px] border px-5 text-sm font-semibold",
                      finished
                        ? "border-navy-800 bg-navy-800 text-white hover:bg-navy-900"
                        : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400",
                    )}
                  >
                    {t("edu.next")}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </button>
                </div>
              </article>
          ) : (
            <LessonConversation
              courseId={courseId}
              lessonId={currentId}
              comments={comments}
              onComments={setComments}
            />
          )}
        </div>
      </div>
    </div>
  );
}
