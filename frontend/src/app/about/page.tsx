"use client";

import Link from "next/link";

import TopBar from "@/components/TopBar";
import AppFooter from "@/components/AppFooter";
import { useAuth } from "@/lib/auth";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const LINKEDIN_URL = "https://www.linkedin.com/in/amir-hossein-khorram-niaky-75b596264";
const TELEGRAM_URL = "https://t.me/amirkhorram7";

function Mark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-[#ff9900] text-sm font-bold text-[#1a1206]">
      ت
    </span>
  );
}

function Essay({ light }: { light: boolean }) {
  const { t } = useI18n();
  const notes = [
    ["about.n1", "about.n1b"],
    ["about.n2", "about.n2b"],
    ["about.n3", "about.n3b"],
  ] as const;
  const kicker = light ? "text-[#c7511f]" : "text-[#ffb433]";
  const title = light ? "text-[#0f1111]" : "text-white";
  const body = light ? "text-[#3a3d3d]" : "text-[#b7c0ca]";
  const prose = light ? "text-[#222]" : "text-[#d7dee6]";
  const mute = light ? "text-[#565959]" : "text-[#9aa6b2]";
  const line = light ? "border-[#d5d9d9]" : "border-white/10";
  const link = light ? "text-[#0f1111] hover:text-[#c7511f]" : "text-[#c5ced8] hover:text-white";

  return (
    <article className="mx-auto max-w-6xl px-5 pb-24 pt-16 md:pt-24">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <p className={`text-[12px] font-medium tracking-[0.18em] ${kicker}`}>{t("about.kicker")}</p>
          <h1 className={`mt-5 text-[32px] font-semibold leading-[1.55] tracking-tight md:text-[44px] md:leading-[1.4] ${title}`}>
            {t("about.hello")}
          </h1>
          <p className={`mt-6 text-[15px] leading-8 md:text-base md:leading-9 ${body}`}>{t("about.p1")}</p>
        </div>
        <figure className="mx-auto w-full" style={{ maxWidth: 420 }}>
          <img
            src="/about-original.jpg"
            alt={t("about.name")}
            className="block h-auto w-full rounded-[28px]"
          />
        </figure>
      </div>

      <div className={`mx-auto mt-20 grid max-w-5xl gap-10 border-t pt-12 md:grid-cols-3 ${line}`}>
        {notes.map(([name, copy]) => (
          <div key={name}>
            <p className={`text-sm font-semibold ${title}`}>{t(name)}</p>
            <p className={`mt-2 text-sm leading-7 ${mute}`}>{t(copy)}</p>
          </div>
        ))}
      </div>

      <div className={`mx-auto mt-16 max-w-2xl space-y-8 text-[17px] leading-9 ${prose}`}>
        <p>{t("about.p2")}</p>
        <p>{t("about.p3")}</p>
      </div>

      <blockquote className="mx-auto mt-16 max-w-2xl border-s-2 border-[#ff9900] ps-6">
        <p className={`text-[12px] font-medium tracking-[0.16em] ${kicker}`}>{t("land.missionLabel")}</p>
        <p className={`mt-4 text-xl font-medium leading-10 md:text-2xl md:leading-[1.7] ${title}`}>{t("about.mission")}</p>
      </blockquote>

      <p className={`mx-auto mt-12 max-w-2xl text-[17px] leading-9 ${prose}`}>{t("about.hope")}</p>

      <div className={`mx-auto mt-16 flex max-w-2xl flex-wrap items-end justify-between gap-6 border-t pt-8 ${line}`}>
        <div>
          <p className={`text-lg font-semibold ${title}`}>{t("about.name")}</p>
          <p className={`mt-1 text-sm ${mute}`}>{t("about.role")}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className={link} dir="ltr">
            LinkedIn
          </a>
          <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className={link} dir="ltr">
            Telegram
          </a>
        </div>
      </div>
    </article>
  );
}

export default function AboutPage() {
  const { ready, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const { t } = useI18n();
  const light = isAuthenticated && theme === "light";

  if (!ready) return <div className="min-h-screen bg-[#07090c]" />;

  const pageBg = !isAuthenticated ? "bg-[#07090c]" : light ? "bg-[#eaeded]" : "bg-[#232f3e]";

  return (
    <div className={`min-h-screen ${pageBg}`}>
      {isAuthenticated ? (
        <TopBar />
      ) : (
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07090c]/80 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="flex items-center gap-2.5">
              <Mark />
              <span className="text-sm font-semibold tracking-tight">{t("brand.name")}</span>
            </Link>
            <nav className="hidden text-[13px] text-white md:block">{t("nav.about")}</nav>
            <div className="ms-auto flex items-center gap-2">
              <LanguageSwitch />
              <Link href="/login" className="rounded-full px-3 py-1.5 text-sm text-[#d7dde6] hover:text-white">
                {t("land.login")}
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-[#ffffff] px-3.5 py-1.5 text-sm font-semibold text-[#12160c] hover:bg-[#ffe7c2]"
              >
                {t("land.start")}
              </Link>
            </div>
          </div>
        </header>
      )}
      <Essay light={light} />
      {isAuthenticated ? <AppFooter /> : null}
    </div>
  );
}
