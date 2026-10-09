"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { LanguageSwitch, useI18n } from "@/lib/i18n";

const LINKEDIN_URL = "https://www.linkedin.com/in/amir-hossein-khorram-niaky-75b596264";
const TELEGRAM_URL = "https://t.me/amirkhorram7";

function SummitArt() {
  return (
    <svg viewBox="0 0 760 420" className="w-full" role="img" aria-hidden>
      <rect width="760" height="420" rx="36" fill="#0c2b4e" />
      <g fill="#1c4d82">
        <ellipse cx="156" cy="102" rx="36" ry="15" />
        <ellipse cx="188" cy="94" rx="26" ry="17" />
        <ellipse cx="216" cy="104" rx="30" ry="13" />
        <ellipse cx="548" cy="124" rx="24" ry="11" />
        <ellipse cx="570" cy="118" rx="18" ry="13" />
        <ellipse cx="590" cy="126" rx="20" ry="10" />
      </g>

      <path d="M36 400 168 188 292 400Z" fill="#1a63c4" />
      <path d="M168 188 292 400 168 400Z" fill="#3b90ee" />
      <path d="M96 400 168 268 168 400Z" fill="#1456ad" />
      <path d="M168 236 236 400 168 400Z" fill="#63b0f8" />
      <path d="M168 188 140 228 196 228Z" fill="#f7fafc" />
      <path d="M168 188 196 228 168 228Z" fill="#e7eef6" />

      <path d="M612 400 694 214 760 400Z" fill="#1458b2" />
      <path d="M694 214 760 400 694 400Z" fill="#2f82e4" />
      <path d="M694 214 674 246 714 246Z" fill="#f4f8fc" />

      <path d="M468 400 586 156 708 400Z" fill="#1b68cc" />
      <path d="M586 156 708 400 586 400Z" fill="#3d94f0" />
      <path d="M520 400 586 246 586 400Z" fill="#124fa8" />
      <path d="M586 214 648 400 586 400Z" fill="#6bb4f8" />
      <path d="M586 156 558 198 614 198Z" fill="#f7fafc" />
      <path d="M586 156 614 198 586 198Z" fill="#e6eef6" />

      <path d="M188 408 386 46 590 408Z" fill="#1e74d8" />
      <path d="M386 46 590 408 386 408Z" fill="#1768c8" />
      <path d="M230 408 330 250 386 408Z" fill="#145aaf" />
      <path d="M386 150 500 408 386 408Z" fill="#4ea2f6" />
      <path d="M386 96 458 210 386 248Z" fill="#1664c0" />
      <path d="M330 220 386 150 386 300Z" fill="#2b82e6" />
      <path d="M386 46 352 102 422 102Z" fill="#f7fafc" />
      <path d="M386 46 422 102 386 102Z" fill="#e8eef6" />

      <path
        d="M250 372c28-42 48-78 70-112s36-62 52-96"
        fill="none"
        stroke="#f4f7fb"
        strokeWidth="2.2"
        strokeDasharray="1.6 8"
        strokeLinecap="round"
      />
      <g fill="#f7fafc">
        <circle cx="258" cy="360" r="4.2" />
        <circle cx="292" cy="312" r="4.2" />
        <circle cx="322" cy="264" r="4.2" />
        <circle cx="348" cy="216" r="4.2" />
        <circle cx="366" cy="174" r="4" />
      </g>

      <path d="M386 46V14" stroke="#ff9900" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M388 16h38l-9 10 9 10h-38Z" fill="#ff9900" />
    </svg>
  );
}

function Mark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-[#ff9900] text-sm font-bold text-[#1a1206]">
      ت
    </span>
  );
}

function LineArt({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 220 150" className="h-44 w-full" fill="none" aria-hidden>
      <g stroke="#d7dee8" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

function Plates() {
  return (
    <LineArt>
      <path d="M34 108 110 68l76 40-76 40z" />
      <path d="M46 94 110 58l64 36-64 36z" />
      <path d="M58 80 110 48l52 32-52 32z" />
      <ellipse cx="110" cy="48" rx="18" ry="8" />
    </LineArt>
  );
}

function cube(x: number, y: number, s = 22) {
  const dx = s;
  const dy = s * 0.55;
  const h = s * 1.15;
  return `M${x} ${y} l${dx} ${-dy} l${dx} ${dy} l${-dx} ${dy} z M${x} ${y} v${h} l${dx} ${dy} v${-h} M${x + dx * 2} ${y} v${h} l${-dx} ${dy}`;
}

function Cubes() {
  return (
    <LineArt>
      <path d={cube(78, 78, 26)} />
      <path d={cube(28, 96, 20)} />
      <path d={cube(132, 96, 20)} />
      <path d={cube(92, 48, 16)} />
    </LineArt>
  );
}

function Slats() {
  return (
    <LineArt>
      {Array.from({ length: 7 }).map((_, i) => {
        const y = 118 - i * 12;
        const x = 28 + i * 6;
        return <path key={i} d={`M${x} ${y} l108 -22 10 6-108 22z`} />;
      })}
    </LineArt>
  );
}

function Window({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121820] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="size-2 rounded-full bg-[#ff9900]" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="ms-2 text-[11px] text-[#9aa6b2]">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DayMock() {
  const { t } = useI18n();
  const days = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  return (
    <Window title={t("land.dayEyebrow")}>
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-[10px] text-[#8b97a6]">
        {days.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className={
              i === 8
                ? "rounded-md bg-[#ff9900] py-1.5 text-center text-[11px] font-bold text-[#1a1206]"
                : "rounded-md bg-white/[0.04] py-1.5 text-center text-[11px] text-[#c5ced8]"
            }
          >
            {i + 8}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-[#0c1218] p-3">
        <div className="mb-2 h-1 w-10 rounded-full bg-[#ff9900]" />
        <p className="text-sm font-semibold text-[#f4f1ea]">{t("land.mockPlan")}</p>
        <p className="mt-1 text-[11px] text-[#8b97a6]">۱۵ مهر · ۲ از ۳</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#d7dde6]">
          <span className="rounded-md bg-[#243040] px-1.5 py-0.5">پیامک</span>
          <span>۱۵ مهر · ۰۸:۰۰</span>
        </div>
      </div>
    </Window>
  );
}

function MinutesMock() {
  const { t } = useI18n();
  const rows = [
    [t("land.mockTask"), "حسین", "۲۰ مهر"],
    ["پیگیری قرارداد", "مریم", "۱۸ مهر"],
    ["جمع‌بندی تصمیم", "علی", "۲۵ مهر"],
  ];
  return (
    <Window title={t("land.minEyebrow")}>
      <p className="mb-3 text-sm font-semibold text-[#f4f1ea]">{t("land.mockMeet")}</p>
      <ul className="space-y-2">
        {rows.map(([title, who, when]) => (
          <li key={title} className="flex items-center gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#7dc4d0]" />
            <span className="min-w-0 flex-1 truncate text-xs text-[#e7edf3]">{title}</span>
            <span className="text-[10px] text-[#8b97a6]">{who}</span>
            <span className="text-[10px] text-[#ffb433]">{when}</span>
          </li>
        ))}
      </ul>
    </Window>
  );
}

function ExplainMock() {
  const { t } = useI18n();
  return (
    <Window title={t("land.exEyebrow")}>
      <div className="space-y-2">
        <div className="rounded-lg border border-[#ff9900]/40 bg-[#ff9900]/10 px-3 py-2 text-xs font-semibold text-[#ffd27a]">
          {t("land.mockFlow")}
        </div>
        <div className="ms-4 space-y-2 border-s border-white/15 ps-3">
          {["درخواست خرید", "تأیید مدیر", "پرداخت و ثبت"].map((step, i) => (
            <div key={step} className="rounded-lg bg-white/[0.04] px-3 py-2">
              <p className="text-xs text-[#e7edf3]">{step}</p>
              <p className="mt-0.5 text-[10px] text-[#8b97a6]">
                {i === 1 ? "ریسک: تأیید صوری · کنترل: دو امضا" : "ریسک و کنترل ثبت شده"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}

function RemindMock() {
  const { t } = useI18n();
  return (
    <Window title={t("land.remEyebrow")}>
      <div className="space-y-2">
        {[
          ["پیامک", "۱۵ مهر · ۰۸:۰۰", "#ff9900"],
          ["ایمیل", "۱۴ مهر · ۰۹:۰۰", "#7dc4d0"],
          ["تلگرام", "۱۵ مهر · ۰۸:۰۰", "#6cb6ff"],
        ].map(([ch, when, color]) => (
          <div key={ch} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
            <span className="size-2 rounded-full" style={{ background: color }} />
            <span className="w-16 text-xs font-medium text-[#f4f1ea]">{ch}</span>
            <span className="text-[11px] text-[#8b97a6]">{when}</span>
            <span className="ms-auto text-[10px] text-[#9aa6b2]">{t("land.mockPlan")}</span>
          </div>
        ))}
      </div>
    </Window>
  );
}

function WorkMock() {
  const { t } = useI18n();
  const cols = [
    ["باز", [t("land.mockTask"), "تماس با مشتری"]],
    ["در جریان", ["نوشتن پیشنهاد"]],
    ["تمام", ["جلسه معرفی"]],
  ];
  return (
    <Window title={t("land.workEyebrow")}>
      <div className="grid grid-cols-3 gap-2">
        {cols.map(([name, cards]) => (
          <div key={name as string}>
            <p className="mb-2 text-[10px] font-medium text-[#8b97a6]">{name as string}</p>
            <div className="space-y-2">
              {(cards as string[]).map((card) => (
                <div key={card} className="rounded-lg border border-white/10 bg-[#0c1218] px-2 py-2 text-[11px] text-[#e7edf3]">
                  {card}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

const FIGS = [
  { k: "0.1", title: "land.fig1t", body: "land.fig1b", art: <Plates /> },
  { k: "0.2", title: "land.fig2t", body: "land.fig2b", art: <Cubes /> },
  { k: "0.3", title: "land.fig3t", body: "land.fig3b", art: <Slats /> },
];

export default function Landing({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const enter = signedIn ? "/dashboard" : "/login";
  const enterLabel = signedIn ? t("land.open") : t("land.login");

  const blocks = [
    { id: "minutes", eyebrow: "land.minEyebrow", title: "land.minTitle", body: "land.minBody", mock: <MinutesMock /> },
    { id: "explain", eyebrow: "land.exEyebrow", title: "land.exTitle", body: "land.exBody", mock: <ExplainMock /> },
    { id: "remind", eyebrow: "land.remEyebrow", title: "land.remTitle", body: "land.remBody", mock: <RemindMock /> },
    { id: "work", eyebrow: "land.workEyebrow", title: "land.workTitle", body: "land.workBody", mock: <WorkMock /> },
  ];

  return (
    <div className="min-h-screen bg-[#07090c] text-[#f4f1ea]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07090c]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <a href="#top" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-sm font-semibold tracking-tight">{t("brand.name")}</span>
          </a>
          <nav className="hidden items-center gap-5 text-[13px] text-[#b7c0ca] md:flex">
            {[
              ["#daybook", "land.dayEyebrow"],
              ["#minutes", "land.minEyebrow"],
              ["#explain", "land.exEyebrow"],
              ["#remind", "land.remEyebrow"],
              ["#work", "land.workEyebrow"],
            ].map(([href, key]) => (
              <a key={href} href={href} className="transition hover:text-white">
                {t(key)}
              </a>
            ))}
            <Link href="/about" className="transition hover:text-white">
              {t("nav.about")}
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitch />
            <Link
              href={enter}
              className="hidden rounded-full px-3 py-1.5 text-sm text-[#d7dde6] transition hover:text-white sm:inline"
            >
              {enterLabel}
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[#ffffff] px-3.5 py-1.5 text-sm font-semibold text-[#12160c] transition hover:bg-[#ffe7c2]"
            >
              {t("land.start")}
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-4xl px-5 pb-8 pt-20 text-center md:pt-28">
          <p className="mb-5 text-[12px] font-medium tracking-[0.18em] text-[#ffb433]">{t("land.kicker")}</p>
          <h1 className="text-balance text-[40px] font-semibold leading-[1.25] tracking-tight text-white md:text-[64px] md:leading-[1.15]">
            {t("land.hero")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#b7c0ca] md:text-lg">{t("land.heroSub")}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#ffffff] px-5 py-2.5 text-sm font-semibold text-[#12160c] transition hover:bg-[#ffe7c2]"
            >
              {t("land.start")}
            </Link>
            <Link
              href={enter}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-[#e7edf3] transition hover:border-white/40"
            >
              {enterLabel}
            </Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-8 pt-20 md:grid-cols-2">
          <h2 className="text-3xl font-semibold leading-[1.7] tracking-tight text-white md:text-4xl md:leading-[1.55]">
            {t("land.summit")}
          </h2>
          <SummitArt />
        </section>

        <section id="daybook" className="mx-auto mt-16 max-w-5xl scroll-mt-24 px-5">
          <p className="mb-3 text-center text-[12px] font-medium tracking-[0.16em] text-[#ffb433]">{t("land.dayEyebrow")}</p>
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight text-white md:text-4xl">{t("land.dayTitle")}</h2>
          <DayMock />
          <p className="mx-auto mt-5 max-w-xl text-center text-sm leading-7 text-[#9aa6b2]">{t("land.dayBody")}</p>
        </section>

        <section className="mx-auto mt-8 max-w-5xl border-t border-white/10 px-5 pt-20">
          <div className="grid gap-14 md:grid-cols-3 md:gap-0">
            {FIGS.map((fig, index) => (
              <article
                key={fig.k}
                className={index ? "md:border-s md:border-white/10 md:px-8" : "md:pe-8"}
              >
                <p className="text-[11px] tracking-[0.18em] text-[#6f7c8a]">FIG {fig.k}</p>
                <div className="mt-6">{fig.art}</div>
                <h2 className="mt-6 text-lg font-semibold text-white">{t(fig.title)}</h2>
                <p className="mt-2 text-sm leading-7 text-[#9aa6b2]">{t(fig.body)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <p className="text-[12px] font-medium tracking-[0.18em] text-[#ffb433]">{t("land.missionLabel")}</p>
          <p className="mt-4 text-2xl font-semibold leading-10 tracking-tight text-white md:text-[28px] md:leading-[1.7]">
            {t("land.mission")}
          </p>
          <Link href="/about" className="mt-6 inline-block text-sm font-medium text-[#ffb433] hover:text-white">
            {t("land.aboutCta")}
          </Link>
        </section>

        <div className="mx-auto max-w-6xl space-y-28 px-5 pb-24">
          {blocks.map((block, index) => (
            <section
              key={block.id}
              id={block.id}
              className="grid items-center gap-10 scroll-mt-24 md:grid-cols-2"
            >
              <div className={index % 2 ? "md:order-2" : ""}>
                <p className="text-[12px] font-medium tracking-[0.16em] text-[#ffb433]">{t(block.eyebrow)}</p>
                <h2 className="mt-3 text-3xl font-semibold leading-snug tracking-tight text-white md:text-4xl">
                  {t(block.title)}
                </h2>
                <p className="mt-4 max-w-md text-sm leading-8 text-[#b7c0ca] md:text-base">{t(block.body)}</p>
              </div>
              <div className={index % 2 ? "md:order-1" : ""}>{block.mock}</div>
            </section>
          ))}
        </div>

        <section className="border-t border-white/10 px-5 py-24 text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">{t("land.close")}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#9aa6b2]">{t("land.closeSub")}</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#ffffff] px-5 py-2.5 text-sm font-semibold text-[#12160c] hover:bg-[#ffe7c2]"
            >
              {t("land.start")}
            </Link>
            <Link
              href={enter}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#e7edf3] hover:border-white/40"
            >
              {enterLabel}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <Mark />
            <span className="text-sm font-semibold">{t("brand.name")}</span>
          </div>
          <div>
            <p className="mb-3 text-[11px] tracking-[0.14em] text-[#6f7c8a]">{t("land.product")}</p>
            <ul className="space-y-2 text-sm text-[#c5ced8]">
              <li>
                <a href="#daybook" className="hover:text-white">
                  {t("land.dayEyebrow")}
                </a>
              </li>
              {blocks.map((block) => (
                <li key={block.id}>
                  <a href={`#${block.id}`} className="hover:text-white">
                    {t(block.eyebrow)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[11px] tracking-[0.14em] text-[#6f7c8a]">{t("land.account")}</p>
            <ul className="space-y-2 text-sm text-[#c5ced8]">
              <li>
                <Link href="/about" className="hover:text-white">
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link href={enter} className="hover:text-white">
                  {enterLabel}
                </Link>
              </li>
              <li>
                <a href={LINKEDIN_URL} target="_blank" rel="noreferrer" className="hover:text-white" dir="ltr">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" className="hover:text-white" dir="ltr">
                  Telegram · @amirkhorram7
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
