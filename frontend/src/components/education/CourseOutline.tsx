"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cx } from "@/components/ui";
import { flattenLessons, type EduCourse, type EduModule } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const OPEN_KEY = "ta_edu_outline_open";

function chapterDoneCount(module: EduModule, done: number[]) {
  return module.lessons.filter((lesson) => done.includes(lesson.id)).length;
}

export default function CourseOutline({
  course,
  done,
  activeLessonId,
  sticky = true,
}: {
  course: EduCourse;
  done: number[];
  activeLessonId?: number;
  sticky?: boolean;
}) {
  const { t, n } = useI18n();
  const lessons = flattenLessons(course);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const start: Record<number, boolean> = {};
    course.modules.forEach((module) => {
      start[module.id] = !activeLessonId || module.lessons.some((lesson) => lesson.id === activeLessonId);
    });
    return start;
  });

  useEffect(() => {
    if (window.localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  };

  if (!open) {
    return (
      <aside className={sticky ? "lg:sticky lg:top-24" : undefined}>
        <button
          type="button"
          onClick={toggleOpen}
          className="flex h-44 w-11 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-navy-800 shadow-sm hover:border-brand-500"
          aria-expanded={false}
        >
          <span className="text-lg leading-none" aria-hidden>
            ›
          </span>
          <span className="text-[11px] font-bold [writing-mode:vertical-rl]">{t("edu.syllabus")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className={cx("w-full rounded-2xl border border-gray-200 bg-white p-3 shadow-sm lg:w-[19.5rem]", sticky && "lg:sticky lg:top-24")}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/education/courses/${course.id}`} className="text-xs font-bold leading-5 text-navy-800 hover:text-link">
          {course.title}
        </Link>
        <button
          type="button"
          onClick={toggleOpen}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-50 hover:text-navy-800"
          aria-expanded
        >
          {t("edu.hideOutline")}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {t("edu.yourProgress")} · {n(done.length)}/{n(lessons.length)}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${lessons.length ? Math.round((done.length / lessons.length) * 100) : 0}%` }}
        />
      </div>

      <div className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto">
        {course.modules.map((module, index) => {
          const complete = chapterDoneCount(module, done);
          const total = module.lessons.length;
          const pct = total ? Math.round((complete / total) * 100) : 0;
          const isOpen = expanded[module.id] !== false;
          return (
            <div key={module.id}>
              <button
                type="button"
                onClick={() => setExpanded((row) => ({ ...row, [module.id]: !isOpen }))}
                className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start hover:bg-gray-50"
                aria-expanded={isOpen}
              >
                <span className="w-3 shrink-0 text-[10px] text-gray-400" aria-hidden>
                  {isOpen ? "▾" : "◂"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-semibold text-brand-800">
                    {t("edu.moduleN", { n: n(index + 1) })}
                  </span>
                  <span className="block truncate text-xs font-bold text-ink">{module.title}</span>
                </span>
                <span className="shrink-0 text-[10px] font-medium text-gray-500">{n(pct)}%</span>
              </button>
              {isOpen ? (
                <ul className="ms-4 space-y-0.5 border-s border-gray-200 ps-2">
                  {module.lessons.map((item) => {
                    const active = item.id === activeLessonId;
                    const finished = done.includes(item.id);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/education/courses/${course.id}/learn/${item.id}`}
                          className={cx(
                            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                            active
                              ? "bg-navy-800 font-medium text-white"
                              : "text-ink hover:bg-gray-50",
                          )}
                        >
                          <span
                            className={cx(
                              "flex size-4 shrink-0 items-center justify-center rounded-full text-[9px]",
                              finished
                                ? "bg-brand-500 text-navy-900"
                                : active
                                  ? "border border-white/70"
                                  : "border border-gray-300",
                            )}
                            aria-hidden
                          >
                            {finished ? "✓" : ""}
                          </span>
                          <span className="line-clamp-2">{item.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
