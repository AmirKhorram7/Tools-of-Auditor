"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";

export default function ProductDemos() {
  const { t } = useI18n();
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-xs font-semibold tracking-[0.14em]" style={{ color: "var(--d-faint)" }}>
          {t("dash.demoTitle")}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--d-muted)" }}>
          {t("dash.demoHint")}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DemoCard
          name={t("char.sara")}
          src="/characters/realistic-sara.png"
          href="/explanation"
          openLabel={t("dash.enterExplanation")}
          title={t("dash.demoSaraTitle")}
          body={t("dash.demoSaraBody")}
          scene="sara"
        >
          <SaraScene />
        </DemoCard>
        <DemoCard
          name={t("char.kian")}
          src="/characters/realistic-kian.png"
          href="/knowledge"
          openLabel={t("dash.enterKnowledge")}
          title={t("dash.demoKianTitle")}
          body={t("dash.demoKianBody")}
          scene="kian"
        >
          <KianScene />
        </DemoCard>
        <DemoCard
          name={t("char.neda")}
          src="/characters/realistic-neda.png"
          href="/daybook"
          openLabel={t("dash.enterDaybook")}
          title={t("dash.demoNedaTitle")}
          body={t("dash.demoNedaBody")}
          scene="neda"
        >
          <NedaScene />
        </DemoCard>
        <DemoCard
          name={t("char.arash")}
          src="/characters/realistic-arash.png"
          href="/minutes"
          openLabel={t("dash.enterMinutes")}
          title={t("dash.demoArashTitle")}
          body={t("dash.demoArashBody")}
          scene="arash"
        >
          <ArashScene />
        </DemoCard>
      </div>
    </section>
  );
}

function DemoCard({
  name,
  src,
  href,
  openLabel,
  title,
  body,
  scene,
  children,
}: {
  name: string;
  src: string;
  href: string;
  openLabel: string;
  title: string;
  body: string;
  scene: "sara" | "kian" | "neda" | "arash";
  children: ReactNode;
}) {
  const [on, setOn] = useState(false);
  const { t } = useI18n();
  return (
    <article
      className={`dash-panel dash-demo dash-demo-${scene}${on ? " is-on" : ""}`}
      tabIndex={0}
      onPointerEnter={() => setOn(true)}
      onPointerLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--d-muted)" }}>
            {title}
          </p>
        </div>
        <Link href={href} className="dash-link shrink-0">
          {openLabel}
        </Link>
      </div>
      <p className="px-4 pt-1 text-[11px] leading-5" style={{ color: "var(--d-faint)" }}>
        {body}
      </p>
      <div className="dash-demo-stage">
        <div className="dash-demo-face">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" />
        </div>
        <p className="dash-demo-idle">{t("dash.demoWatch")}</p>
        <span className="dash-demo-cursor" aria-hidden />
        {children}
      </div>
    </article>
  );
}

function SaraScene() {
  const { t } = useI18n();
  return (
    <div className="dash-demo-window" dir="rtl">
      <div className="dash-demo-bar">
        <span className="dash-demo-dot" />
        <span>{t("nav.explanation")}</span>
        <span className="dash-sara-new">{t("exp.createFolder")}</span>
      </div>
      <div className="dash-sara-body">
        <div className="dash-sara-cards">
          <div className="dash-sara-folder dash-sara-f1">
            <span className="dash-sara-chip" />
            <b>{t("dash.demoFolder1")}</b>
            <small>{t("dash.person.docs")}</small>
          </div>
          <div className="dash-sara-folder dash-sara-f2">
            <span className="dash-sara-chip alt" />
            <b>{t("dash.demoFolder2")}</b>
            <small>{t("dash.person.docs")}</small>
          </div>
        </div>
        <div className="dash-sara-tree">
          <div className="dash-tree-root">{t("nav.explanation")}</div>
          <div className="dash-tree-stem" />
          <div className="dash-tree-kids">
            <div className="dash-tree-node">{t("dash.demoFolder2")}</div>
            <div className="dash-tree-node">{t("dash.demoFolder1")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KianScene() {
  const { t } = useI18n();
  return (
    <div className="dash-demo-window dash-kian-window" dir="rtl">
      <div className="dash-demo-bar dash-kian-bar">
        <span className="dash-demo-dot" />
        <span>{t("nav.knowledge")}</span>
      </div>
      <div className="dash-kian-body">
        <aside className="dash-kian-side">
          <div className="dash-kian-actions">
            <span className="dash-kian-new dash-kian-page-btn">{t("km.newPage")}</span>
            <span className="dash-kian-new dash-kian-folder-btn">{t("km.newFolder")}</span>
          </div>
          <div className="dash-kian-tree">
            <div className="dash-kian-folder">{t("dash.demoKmFolder")}</div>
            <div className="dash-kian-page">{t("dash.demoKmPage")}</div>
          </div>
        </aside>
        <div className="dash-kian-editor">
          <p className="dash-kian-line">{t("dash.demoKmLine1")}</p>
          <p className="dash-kian-line dash-kian-color">{t("dash.demoKmLine2")}</p>
        </div>
      </div>
    </div>
  );
}

function NedaScene() {
  const { t } = useI18n();
  const days = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
  return (
    <div className="dash-demo-window" dir="rtl">
      <div className="dash-demo-bar">
        <span className="dash-demo-dot" />
        <span>{t("nav.daybook")}</span>
        <span className="dash-neda-new dash-neda-plan-btn">{t("day.newPlan")}</span>
        <span className="dash-neda-new dash-neda-note-btn">{t("day.newNote")}</span>
      </div>
      <div className="dash-neda-body">
        <div className="dash-neda-week">
          {days.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="dash-neda-grid">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className={i === 8 ? "dash-neda-day" : undefined}>
              {i + 8}
            </span>
          ))}
        </div>
        <div className="dash-neda-plan">
          <i />
          <b>{t("dash.demoDayPlan")}</b>
          <small>{t("dash.demoDayWhen")}</small>
        </div>
        <div className="dash-neda-note">
          <b>{t("day.notes")}</b>
          <small>{t("dash.demoDayNote")}</small>
        </div>
      </div>
    </div>
  );
}

function ArashScene() {
  const { t } = useI18n();
  const rows = [
    [t("dash.demoMinTask1"), t("dash.demoMinWho1"), t("dash.demoMinWhen1")],
    [t("dash.demoMinTask2"), t("dash.demoMinWho2"), t("dash.demoMinWhen2")],
    [t("dash.demoMinTask3"), t("dash.demoMinWho3"), t("dash.demoMinWhen3")],
  ];
  return (
    <div className="dash-demo-window" dir="rtl">
      <div className="dash-demo-bar">
        <span className="dash-demo-dot" />
        <span>{t("nav.minutes")}</span>
        <span className="dash-arash-new">{t("minutes.addLine")}</span>
      </div>
      <div className="dash-arash-body">
        <p className="dash-arash-meet">{t("dash.demoMeetTitle")}</p>
        <ul className="dash-arash-list">
          {rows.map(([title, who, when], i) => (
            <li key={title} className={`dash-arash-item dash-arash-i${i + 1}`}>
              <span className="dash-arash-dot" />
              <span className="dash-arash-task">{title}</span>
              <span className="dash-arash-who">{who}</span>
              <span className="dash-arash-when">{when}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
