"use client";

import { useEffect, useState } from "react";

import { catLabel, copy } from "./copy";
import { sourceColor } from "./colors";
import { useSignal } from "./SignalContext";
import type { DrawerMode, NewsArticle, NewsSource } from "./types";

export default function SignalDrawer({
  article,
  sources,
  onClose,
  onPrev,
  onNext,
}: {
  article: NewsArticle | null;
  sources: NewsSource[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { lang } = useSignal();
  const L = copy(lang);
  const [mode, setMode] = useState<DrawerMode>("cur");
  const open = Boolean(article);

  useEffect(() => {
    setMode("cur");
  }, [article?.id]);

  const source = sources.find((row) => row.id === article?.source);
  const color = sourceColor(article?.source_slug ?? "");
  const category = source?.category ?? "";
  const li = lang === "fa" ? 1 : 0;
  const shown = mode === "cur" ? li : mode === "both" ? 0 : mode;

  const title = (which: 0 | 1) => {
    if (!article) return "";
    if (which === 1) return article.title_fa || article.title;
    return article.title;
  };
  const summary = (which: 0 | 1) => {
    if (!article) return "";
    if (which === 1) return article.summary_fa || article.summary;
    return article.summary;
  };

  const col = (which: 0 | 1, lab: string) => (
    <div
      className="col"
      dir={which ? "rtl" : "ltr"}
      style={which ? { fontFamily: "var(--font-vazirmatn), Vazirmatn, sans-serif" } : undefined}
    >
      <small>{lab}</small>
      <h3>{title(which)}</h3>
      <p>{summary(which)}</p>
    </div>
  );

  return (
    <>
      <div className={open ? "scrim on" : "scrim"} onClick={onClose} />
      <aside className={open ? "drawer on" : "drawer"} aria-hidden={!open}>
        {article ? (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", ["--c" as string]: color }}>
              <span className="chip on" style={{ ["--c" as string]: color }}>
                <i />
                {article.source_name}
              </span>
              {category ? (
                <span className="tag meta" style={{ margin: 0 }}>
                  {catLabel(category, lang)}
                </span>
              ) : null}
              <span className="sp" />
              <button type="button" className="ib" onClick={onClose}>
                ✕
              </button>
            </div>
            <h2 dir={shown === 1 ? "rtl" : "ltr"}>{title(shown === 1 ? 1 : 0)}</h2>
            <div className="seg" style={{ alignSelf: "flex-start" }}>
              <button type="button" className={mode !== "both" && shown === 0 ? "on" : ""} onClick={() => setMode(0)}>
                EN
              </button>
              <button type="button" className={mode !== "both" && shown === 1 ? "on" : ""} onClick={() => setMode(1)}>
                فا
              </button>
              <button type="button" className={mode === "both" ? "on" : ""} onClick={() => setMode("both")}>
                {L.both}
              </button>
            </div>
            <div className={mode === "both" ? "cols both" : "cols"}>
              {mode === "both" ? (
                <>
                  {col(0, "EN")}
                  {col(1, "فا")}
                </>
              ) : (
                col(shown === 1 ? 1 : 0, shown === 1 ? "فا" : "EN")
              )}
            </div>
            <a className="btn" href={article.url} target="_blank" rel="noreferrer" style={{ marginTop: "auto" }}>
              {L.read}
            </a>
            <div className="nav">
              <button type="button" className="ib" onClick={onPrev}>
                {L.prev}
              </button>
              <button type="button" className="ib" onClick={onNext}>
                {L.next}
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
