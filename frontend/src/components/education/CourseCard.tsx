"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";

import CourseLevelBadge from "@/components/education/CourseLevelBadge";
import { mediaUrl } from "@/lib/api";
import type { EduCourseCard } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

const SAVED_KEY = "ta_edu_saved";

function readSaved(): number[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export default function CourseCard({ course }: { course: EduCourseCard }) {
  const { t, n } = useI18n();
  const photo = mediaUrl(course.thumbnail_url);
  const teacher = course.teacher?.name || "";
  const chapters = course.chapter_count ?? 0;
  const lessons = course.lesson_count ?? 0;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSaved().includes(course.id));
  }, [course.id]);

  const toggleSave = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const next = saved
      ? readSaved().filter((id) => id !== course.id)
      : [...readSaved(), course.id];
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(!saved);
  };

  return (
    <Link
      href={`/education/courses/${course.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(15,23,42,0.10)]"
    >
      <div className="relative h-[190px] overflow-hidden bg-navy-900">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-brand-400">
            {t("edu.course")}
          </div>
        )}
        <button
          type="button"
          onClick={toggleSave}
          aria-label={saved ? t("edu.bookmarked") : t("edu.bookmark")}
          className="absolute start-auto end-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm hover:bg-white"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 4h12v16l-6-4-6 4z" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-[18px]">
        {teacher ? <p className="text-xs font-semibold text-navy-800">{teacher}</p> : null}
        <h3 className="line-clamp-2 text-base font-bold leading-6 text-ink">{course.title}</h3>
        {course.summary ? (
          <p className="line-clamp-2 text-[13px] leading-[1.6] text-gray-500">{course.summary}</p>
        ) : null}
        <p className="flex flex-wrap items-center gap-x-3 text-[13px] text-gray-500">
          <span>{t("edu.likes", { n: n(course.like_count) })}</span>
          <span aria-hidden>·</span>
          <span>{t("edu.lessonsCount", { n: n(lessons) })}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <CourseLevelBadge level={course.level} />
          {course.category_title ? (
            <span className="rounded-full bg-navy-800/10 px-2.5 py-1 text-[11px] font-semibold text-navy-800">
              {course.category_title}
            </span>
          ) : null}
          {chapters ? <span className="text-[13px] text-gray-500">{t("edu.modulesCount", { n: n(chapters) })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
