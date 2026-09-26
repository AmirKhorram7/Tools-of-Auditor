"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Percent from "@/components/education/Percent";
import { cx } from "@/components/ui";
import { flattenLessons, type EduCourse, type EduModule } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const OPEN_KEY = "ta_edu_outline_open";

function chapterDoneCount(module: EduModule, done: number[]) {
  return module.lessons.filter((lesson) => done.includes(lesson.id)).length;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cx("shrink-0 text-current opacity-80 transition-transform", !open && "-rotate-90")}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Tick({ finished, active }: { finished: boolean; active: boolean }) {
  return (
    <span
      className={cx(
        "flex size-[18px] shrink-0 items-center justify-center rounded-full",
        finished ? "bg-green-600 text-white" : active ? "border-2 border-white" : "border-[1.5px] border-gray-300 bg-white",
      )}
      aria-hidden
    >
      {finished ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 12l6 6L20 6" />
        </svg>
      ) : null}
    </span>
  );
}

export default function CourseOutline({
  course,
  done,
  activeLessonId,
  sticky = true,
  tone = "navy",
}: {
  course: EduCourse;
  done: number[];
  activeLessonId?: number;
  sticky?: boolean;
  tone?: "navy" | "green";
}) {
  const { t, n } = useI18n();
  const lessons = flattenLessons(course);
  const pct = lessons.length ? Math.round((done.length / lessons.length) * 100) : 0;
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
          className="flex h-44 w-11 flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white text-navy-800 hover:border-brand-500"
          aria-expanded={false}
        >
          <span className="text-lg leading-none" aria-hidden>
            ›
          </span>
          <span className="text-xs font-semibold [writing-mode:vertical-rl]">{t("edu.syllabus")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cx(
        "w-full rounded-2xl border border-gray-200 bg-white p-5",
        sticky ? "lg:sticky lg:top-24 lg:w-[340px]" : "lg:w-[340px]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Link href={`/education/courses/${course.id}`} className="text-[15px] font-bold leading-6 text-ink hover:text-navy-800">
          {course.title}
        </Link>
        <button type="button" onClick={toggleOpen} className="shrink-0 text-xs text-gray-500 hover:text-navy-800" aria-expanded>
          {t("edu.hideOutline")}
        </button>
      </div>

      <div className="mt-3.5 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">{t("edu.yourProgress")}</span>
          <span className="text-gray-500">
            <Percent value={pct} />
            <span aria-hidden> · </span>
            <span dir="ltr" className="inline-block tabular-nums">
              {n(done.length)}/{n(lessons.length)}
            </span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={cx("h-full rounded-full", tone === "green" ? "bg-green-600" : "bg-navy-800")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3.5 flex flex-col">
        {course.modules.map((module, index) => {
          const complete = chapterDoneCount(module, done);
          const total = module.lessons.length;
          const chapterPct = total ? Math.round((complete / total) * 100) : 0;
          const isOpen = expanded[module.id] !== false;
          return (
            <div key={module.id} className="mt-3 first:mt-0">
              <button
                type="button"
                onClick={() => setExpanded((row) => ({ ...row, [module.id]: !isOpen }))}
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-navy-800 px-3 py-2.5 text-start text-white"
                aria-expanded={isOpen}
              >
                <span>
                  <span className="block text-[11px] text-white/70">{t("edu.moduleN", { n: n(index + 1) })}</span>
                  <span className="mt-0.5 block text-[14px] font-semibold">
                    {n(index + 1)}: {module.title}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-green-400">
                    <Percent value={chapterPct} />
                  </span>
                  <Chevron open={isOpen} />
                </span>
              </button>
              {isOpen ? (
                <ul className="mt-1 flex flex-col">
                  {module.lessons.map((item) => {
                    const active = item.id === activeLessonId;
                    const finished = done.includes(item.id);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/education/courses/${course.id}/learn/${item.id}`}
                          className={cx(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] leading-5",
                            active ? "bg-navy-900 font-semibold text-white" : "text-gray-700 hover:bg-gray-50",
                          )}
                        >
                          <Tick finished={finished} active={active} />
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
