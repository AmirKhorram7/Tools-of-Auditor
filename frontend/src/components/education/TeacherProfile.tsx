"use client";

import Link from "next/link";

import { mediaUrl } from "@/lib/api";
import type { EduCourseCard, EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

type SocialKind = "web" | "in" | "tg" | "ig";

function WebsiteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.3 2.4 3.6 5.6 3.6 9s-1.3 6.6-3.6 9c-2.3-2.4-3.6-5.6-3.6-9s1.3-6.6 3.6-9z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.54 8.5H3.22V21h3.32V8.5ZM4.88 3.1A1.94 1.94 0 1 0 4.9 7a1.94 1.94 0 0 0-.02-3.9ZM20.78 13.3c0-3.86-2.06-5.66-4.8-5.66-2.21 0-3.2 1.22-3.75 2.07V8.5H9V21h3.32v-6.58c0-1.74.33-3.42 2.48-3.42 2.12 0 2.66 1.62 2.66 3.52V21h3.32Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.54 3.16 2.86 10.4c-1.28.5-1.27 1.2-.22 1.52l4.78 1.49 11.08-7c.52-.32.99-.14.6.2l-9 8.14-.34 5.12c.5 0 .72-.23.99-.5l2.38-2.32 4.94 3.64c.91.5 1.56.24 1.79-.84l3.24-15.28c.33-1.33-.5-1.93-1.56-1.41Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2Zm0 7.92A3.12 3.12 0 1 1 15.12 12 3.12 3.12 0 0 1 12 15.12ZM17.52 6.84a1.12 1.12 0 1 1-1.12 1.12 1.12 1.12 0 0 1 1.12-1.12ZM12 4.32c2.14 0 2.4.01 3.24.05a4.43 4.43 0 0 1 1.48.27 2.94 2.94 0 0 1 1.64 1.64 4.43 4.43 0 0 1 .27 1.48c.04.84.05 1.1.05 3.24s-.01 2.4-.05 3.24a4.43 4.43 0 0 1-.27 1.48 2.94 2.94 0 0 1-1.64 1.64 4.43 4.43 0 0 1-1.48.27c-.84.04-1.1.05-3.24.05s-2.4-.01-3.24-.05a4.43 4.43 0 0 1-1.48-.27 2.94 2.94 0 0 1-1.64-1.64 4.43 4.43 0 0 1-.27-1.48C4.33 14.4 4.32 14.14 4.32 12s.01-2.4.05-3.24a4.43 4.43 0 0 1 .27-1.48A2.94 2.94 0 0 1 6.28 5.64a4.43 4.43 0 0 1 1.48-.27C8.6 4.33 8.86 4.32 12 4.32Zm0-2.16c-2.18 0-2.45.01-3.3.05a6.6 6.6 0 0 0-2.18.42 5.1 5.1 0 0 0-2.91 2.91 6.6 6.6 0 0 0-.42 2.18c-.04.85-.05 1.12-.05 3.3s.01 2.45.05 3.3a6.6 6.6 0 0 0 .42 2.18 5.1 5.1 0 0 0 2.91 2.91 6.6 6.6 0 0 0 2.18.42c.85.04 1.12.05 3.3.05s2.45-.01 3.3-.05a6.6 6.6 0 0 0 2.18-.42 5.1 5.1 0 0 0 2.91-2.91 6.6 6.6 0 0 0 .42-2.18c.04-.85.05-1.12.05-3.3s-.01-2.45-.05-3.3a6.6 6.6 0 0 0-.42-2.18 5.1 5.1 0 0 0-2.91-2.91 6.6 6.6 0 0 0-2.18-.42C14.45 2.17 14.18 2.16 12 2.16Z" />
    </svg>
  );
}

const SOCIAL_STYLE: Record<SocialKind, string> = {
  web: "bg-navy-800 text-white hover:bg-navy-900",
  in: "bg-[#0A66C2] text-white hover:bg-[#004182]",
  tg: "bg-[#26A5E4] text-white hover:bg-[#1d8ec6]",
  ig: "text-white hover:opacity-90",
};

function SocialButton({
  href,
  label,
  kind,
}: {
  href: string;
  label: string;
  kind: SocialKind;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={`flex size-10 items-center justify-center rounded-full shadow-sm ${SOCIAL_STYLE[kind]}`}
      style={
        kind === "ig"
          ? { background: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)" }
          : undefined
      }
    >
      {kind === "web" ? <WebsiteIcon /> : null}
      {kind === "in" ? <LinkedInIcon /> : null}
      {kind === "tg" ? <TelegramIcon /> : null}
      {kind === "ig" ? <InstagramIcon /> : null}
    </a>
  );
}

function TeacherCourseTile({ course }: { course: EduCourseCard }) {
  const { t, n } = useI18n();
  const photo = mediaUrl(course.thumbnail_url);
  const students = course.student_count ?? 0;
  const likes = course.like_count ?? 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {photo ? (
        <img src={photo} alt="" className="h-[140px] w-full object-cover" />
      ) : (
        <div className="flex h-[140px] w-full items-center justify-center bg-brand-50 text-xs font-medium text-navy-800">
          {t("edu.course")}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold leading-6 text-ink">{course.title}</h3>
        <p className="text-[13px] text-gray-500">
          {t("edu.statStudentsCount", { n: n(students) })}
          <span aria-hidden> · </span>
          {t("edu.likes", { n: n(likes) })}
        </p>
        <Link href={`/education/courses/${course.id}`} className="mt-auto text-[13px] font-semibold text-navy-800 hover:text-brand-800">
          {t("edu.viewCourse")}
        </Link>
      </div>
    </article>
  );
}

export default function TeacherProfile({ teacher }: { teacher: EduTeacher }) {
  const { t, n } = useI18n();
  const photo = mediaUrl(teacher.photo_url);
  const name = teacher.name || t("edu.teacher");
  const socials = [
    teacher.website ? { href: teacher.website, label: t("edu.teacherWebsite"), kind: "web" as const } : null,
    teacher.linkedin_url ? { href: teacher.linkedin_url, label: t("edu.teacherLinkedin"), kind: "in" as const } : null,
    teacher.telegram_url ? { href: teacher.telegram_url, label: t("edu.teacherTelegram"), kind: "tg" as const } : null,
    teacher.instagram_url ? { href: teacher.instagram_url, label: t("edu.teacherInstagram"), kind: "ig" as const } : null,
  ].filter(Boolean) as { href: string; label: string; kind: SocialKind }[];

  return (
    <div className="flex flex-col gap-8">
      <section className="grid overflow-hidden rounded-[20px] border border-gray-200 bg-white md:grid-cols-[minmax(0,1fr)_minmax(18rem,36%)]">
        <div className="flex min-w-0 flex-col gap-4 p-8 md:p-10">
          <span className="w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            {t("edu.verifiedInstructor")}
          </span>
          <h1 className="text-3xl font-bold leading-tight text-ink md:text-4xl">{name}</h1>
          {teacher.headline ? <p className="text-lg text-gray-600">{teacher.headline}</p> : null}
          <p className="max-w-xl text-[15px] leading-7 text-gray-700">{teacher.bio || t("edu.noBio")}</p>
          <div className="mt-2 flex flex-wrap gap-8">
            <div>
              <b className="block text-[22px] font-bold text-ink">{n(teacher.course_count ?? teacher.courses.length)}</b>
              <span className="text-[13px] text-gray-500">{t("edu.statCourses")}</span>
            </div>
            <div>
              <b className="block text-[22px] font-bold text-ink">{n(teacher.student_count ?? 0)}</b>
              <span className="text-[13px] text-gray-500">{t("edu.statStudents")}</span>
            </div>
            <div>
              <b className="block text-[22px] font-bold text-ink">{n(teacher.like_count ?? 0)}</b>
              <span className="text-[13px] text-gray-500">{t("edu.statLikes")}</span>
            </div>
          </div>
          {socials.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {socials.map((item) => (
                <SocialButton key={item.href} href={item.href} label={item.label} kind={item.kind} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="min-h-[240px] md:min-h-[340px]">
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[240px] w-full items-center justify-center bg-brand-50 text-sm text-navy-800 md:min-h-[340px]">
              {name.slice(0, 1)}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-ink">{t("edu.teacherCoursesBy", { name })}</h2>
        {teacher.courses.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {teacher.courses.map((course) => (
              <TeacherCourseTile key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t("edu.studioEmpty")}</p>
        )}
      </section>
    </div>
  );
}
