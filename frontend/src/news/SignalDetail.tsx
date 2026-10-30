"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getArticleDetail } from "./api";
import { sourceColor } from "./colors";
import { catLabel, copy, fmtN } from "./copy";
import { useSignal } from "./SignalContext";
import type { ArticleDetail, NewsLang } from "./types";
import "./signal-detail.css";

const FEED_IDS_KEY = "ta_signal_feed_ids";
const FS_KEY = "ta_signal_fs";
const FOCUS_KEY = "ta_signal_focus";
const SPLIT_KEY = "ta_signal_split";

function minutesAgo(iso: string | null) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function readIds(): number[] {
  try {
    const raw = sessionStorage.getItem(FEED_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function entityTypeLabel(type: string, lang: NewsLang) {
  const map: Record<string, [string, string]> = {
    model: ["Model", "مدل"],
    org: ["Org", "سازمان"],
    topic: ["Topic", "موضوع"],
    person: ["Person", "شخص"],
  };
  const row = map[type.toLowerCase()];
  if (!row) return type;
  return lang === "fa" ? row[1] : row[0];
}

function tlLabel(status: string, L: ReturnType<typeof copy>) {
  if (status === "done") return L.dDone;
  if (status === "pending") return L.dPending;
  if (status === "failed") return L.dFailed;
  if (status === "skipped") return L.dSkipped;
  return status;
}

export default function SignalDetail({ articleId }: { articleId: number }) {
  const { lang, setLang, toggleTheme } = useSignal();
  const router = useRouter();
  const params = useSearchParams();
  const [split, setSplit] = useState(false);
  const [focus, setFocus] = useState(false);
  const [fs, setFs] = useState(18);
  const [data, setData] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeToc, setActiveToc] = useState("brief");
  const toastTimer = useRef<number | null>(null);
  const idsParam = params.get("ids") || "";
  const feedIds = useMemo(() => {
    const fromQuery = idsParam
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (fromQuery.length) {
      try {
        sessionStorage.setItem(FEED_IDS_KEY, JSON.stringify(fromQuery));
      } catch {
        /* ignore */
      }
      return fromQuery;
    }
    return readIds();
  }, [articleId, idsParam]);

  const uiLang: NewsLang = lang;
  const L = copy(uiLang);
  const faMode = uiLang === "fa";
  const translationDone = data?.translation_status === "done";
  // Spec: FA with translation pending → English text + translating badge (never empty).
  const showFa = faMode && translationDone;
  const canSplit = Boolean(data && translationDone);
  const effectiveSplit = split && canSplit;

  useEffect(() => {
    try {
      const storedFs = Number(localStorage.getItem(FS_KEY));
      if (storedFs >= 15 && storedFs <= 26) setFs(storedFs);
      setFocus(localStorage.getItem(FOCUS_KEY) === "1");
      setSplit(localStorage.getItem(SPLIT_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FS_KEY, String(fs));
      localStorage.setItem(FOCUS_KEY, focus ? "1" : "0");
      localStorage.setItem(SPLIT_KEY, split ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [fs, focus, split]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getArticleDetail(articleId, feedIds.length ? feedIds : undefined)
      .then((row) => {
        setData(row);
        setLoading(false);
      })
      .catch(() => {
        setData(null);
        setError(true);
        setLoading(false);
      });
  }, [articleId, feedIds]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" in window ? ("instant" as ScrollBehavior) : "auto" });
  }, [articleId]);

  const color = data ? sourceColor(data.source.slug, data.source.color) : "#e8a87c";
  const minutes = data?.reading_minutes || 1;

  useEffect(() => {
    const node = document.querySelector(".signal-root.detail") as HTMLElement | null;
    if (!node) return;
    node.style.setProperty("--c", color);
    node.style.setProperty("--fs", `${fs}px`);
    node.classList.toggle("split", effectiveSplit);
    node.classList.toggle("focus", focus);
    return () => {
      node.classList.remove("split", "focus");
    };
  }, [color, fs, effectiveSplit, focus]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const el = document.documentElement;
        const h = el.scrollHeight - window.innerHeight;
        const p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
        setProgress(p);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [data?.id]);

  const tocIds = useMemo(() => {
    if (!data) return [] as string[];
    const ids: string[] = [];
    const brief = showFa ? data.brief_fa : data.brief;
    if ((brief && brief.length) || data.brief.length) ids.push("brief");
    if (data.key_points.length) ids.push("points");
    if (data.paragraphs.length) ids.push("story");
    const why = showFa ? data.why_it_matters_fa || data.why_it_matters : data.why_it_matters;
    if (why) ids.push("why");
    if (data.related.length) ids.push("rel");
    return ids;
  }, [data, showFa]);

  useEffect(() => {
    if (!tocIds.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveToc(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    tocIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) io.observe(node);
    });
    return () => io.disconnect();
  }, [tocIds, data?.id, split, showFa]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1600);
  };

  const goBack = () => {
    if (typeof document !== "undefined" && document.referrer.includes("/news")) {
      router.back();
      return;
    }
    router.push("/news");
  };

  const goNeighbor = (id: number | null | undefined) => {
    if (!id) return;
    const q = feedIds.length ? `?ids=${feedIds.join(",")}` : "";
    router.push(`/news/${id}${q}`);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select") || target.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const k = event.key.toLowerCase();
      if (k === "l") {
        setSplit(false);
        setLang(lang === "en" ? "fa" : "en");
      } else if (k === "s") {
        if (canSplit) setSplit((v) => !v);
      } else if (k === "f") {
        setFocus((v) => !v);
      } else if (event.key === "ArrowRight") {
        goNeighbor(data?.next_id);
      } else if (event.key === "ArrowLeft") {
        goNeighbor(data?.prev_id);
      } else if (k === "b") {
        goBack();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lang, setLang, canSplit, data?.next_id, data?.prev_id]);

  const title = data ? (showFa ? data.title_fa || data.title : data.title) : "";
  const category = data ? catLabel(data.category, uiLang) : "";
  const brief = data ? (showFa && data.brief_fa.length ? data.brief_fa : data.brief) : [];
  const why = data
    ? showFa
      ? data.why_it_matters_fa || data.why_it_matters
      : data.why_it_matters
    : "";
  const pub = data?.published_at
    ? new Intl.DateTimeFormat(faMode ? "fa-IR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(data.published_at),
      )
    : "—";
  const fetchedMins = minutesAgo(data?.fetched_at ?? null);
  const leftMins = Math.max(0, Math.ceil(minutes * (1 - progress)));
  const pct = Math.round(progress * 100);
  const ringOffset = 226.2 * (1 - progress);
  const showTrace = Boolean(data?.fetch_trace);

  const tabLabel = (id: string) => {
    const map: Record<string, number> = { brief: 0, points: 1, story: 2, why: 3, rel: 4 };
    return L.dTab[map[id] ?? 0];
  };

  return (
    <div style={{ ["--c" as string]: color, ["--fs" as string]: `${fs}px` }}>
      <div className="d-bar" aria-hidden style={{ transform: `scaleX(${progress})` }} />

      <header className="d-top">
        <button type="button" className="d-ib" id="back" onClick={goBack}>
          {L.dBack}
        </button>
        <div className="d-logo">
          <i />
          tauditor
        </div>
        <div className="d-sp" />
        <Link href="/dashboard" className="d-ib">
          {L.homeBtn}
        </Link>
        <button type="button" className="d-ib" aria-label="theme" onClick={toggleTheme}>
          ◐
        </button>
        <div className="d-seg" role="radiogroup" aria-label="language">
          <button
            type="button"
            role="radio"
            aria-checked={!effectiveSplit && lang === "en"}
            className={!effectiveSplit && lang === "en" ? "on" : ""}
            onClick={() => {
              setSplit(false);
              setLang("en");
            }}
          >
            EN
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!effectiveSplit && lang === "fa"}
            className={!effectiveSplit && lang === "fa" ? "on" : ""}
            onClick={() => {
              setSplit(false);
              setLang("fa");
            }}
          >
            فا
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={effectiveSplit}
            className={effectiveSplit ? "on" : ""}
            disabled={!canSplit && !data}
            onClick={() => {
              if (!canSplit) return;
              setSplit((v) => !v);
            }}
          >
            ⇄
          </button>
        </div>
      </header>

      {error ? (
        <div className="d-banner" role="alert">
          <span>{L.dErr}</span>
          <button type="button" className="d-ib" onClick={load}>
            {L.dRetry}
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <section className="d-hero" style={{ marginBottom: 0 }}>
          <div className="d-skel" style={{ width: "40%", height: 14, marginBottom: 16 }} />
          <div className="d-skel" style={{ width: "70%", height: 48, marginBottom: 12 }} />
          <div className="d-skel" style={{ width: "55%", height: 48, marginBottom: 22 }} />
          <div className="d-chips">
            <div className="d-skel" style={{ width: 120, height: 28, borderRadius: 99 }} />
            <div className="d-skel" style={{ width: 140, height: 28, borderRadius: 99 }} />
          </div>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="d-hero" style={{ marginBottom: 0 }}>
            <div className="d-kick">
              {data.source.name} · {category}
              {faMode && !translationDone ? <span className="d-badge">{L.dTranslating}</span> : null}
            </div>
            <h1>{title}</h1>
            <div className="d-chips">
              <span className="d-pill">
                <i />
                {L.dPub} {pub}
              </span>
              <span className="d-pill live">
                <i />
                {L.dFet} {L.dAgo(fmtN(fetchedMins, uiLang))}
              </span>
              <span className="d-pill">
                {fmtN(minutes, uiLang)} {L.dMin}
              </span>
              {translationDone ? <span className="d-pill">EN · فا</span> : null}
            </div>
          </section>

          <div className="d-page">
            <nav className="d-rail" aria-label={faMode ? "فهرست" : "Contents"}>
              <div className="d-ring" aria-hidden>
                <svg width="84" height="84" viewBox="0 0 84 84">
                  <circle cx="42" cy="42" r="36" fill="none" stroke="var(--line)" strokeWidth="5" />
                  <circle
                    cx="42"
                    cy="42"
                    r="36"
                    fill="none"
                    stroke="var(--c)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="226.2"
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <b>
                  {fmtN(pct, uiLang)}
                  {faMode ? "٪" : "%"}
                </b>
              </div>
              <div className="d-left">{L.dLeft(fmtN(leftMins, uiLang))}</div>
              <div className="d-toc">
                {tocIds.map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    data-id={id}
                    className={activeToc === id ? "on" : ""}
                    aria-current={activeToc === id ? "true" : undefined}
                  >
                    {tabLabel(id)}
                  </a>
                ))}
              </div>
            </nav>

            <article className="d-art">
              {brief.length ? (
                <section id="brief">
                  <h2>{L.dBrief}</h2>
                  <div className="d-brief">
                    <ul>
                      {brief.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}

              {data.key_points.length ? (
                <section id="points">
                  <h2>{L.dPts}</h2>
                  <div className="d-pts">
                    {data.key_points.map((pt, i) => {
                      const ptTitle = showFa ? pt.title_fa || pt.title : pt.title;
                      const ptText = showFa ? pt.text_fa || pt.text : pt.text;
                      return (
                        <div className="d-pt" key={`${ptTitle}-${i}`}>
                          <b>{fmtN(i + 1, uiLang)}</b>
                          <p>
                            <strong>{ptTitle}</strong>
                            <br />
                            {ptText}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {data.paragraphs.length ? (
                <section id="story">
                  <h2>{L.dStory}</h2>
                  <div className="d-body">
                    {data.paragraphs.map((p, i) => {
                      const en = p.en || "";
                      const fa = p.fa || "";
                      if (effectiveSplit) {
                        return (
                          <div
                            className="d-para d-pair"
                            data-p={i}
                            key={i}
                            onMouseEnter={(e) => {
                              document.querySelectorAll(".d-para.cur").forEach((n) => n.classList.remove("cur"));
                              (e.currentTarget as HTMLElement).classList.add("cur");
                            }}
                          >
                            <div dir="ltr" lang="en">
                              {en}
                            </div>
                            <div dir="rtl" lang="fa">
                              {fa || en}
                            </div>
                          </div>
                        );
                      }
                      const text = showFa ? fa || en : en;
                      return (
                        <div
                          className="d-para"
                          data-p={i}
                          key={i}
                          onMouseEnter={(e) => {
                            document.querySelectorAll(".d-para.cur").forEach((n) => n.classList.remove("cur"));
                            (e.currentTarget as HTMLElement).classList.add("cur");
                          }}
                        >
                          <p>{text}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {why ? (
                <section id="why">
                  <h2>{L.dWhy}</h2>
                  <p className="d-why">{why}</p>
                </section>
              ) : null}

              {data.entities.length ? (
                <section>
                  <h2>{L.dEnts}</h2>
                  <div className="d-ents">
                    {data.entities.map((ent) => (
                      <Link key={`${ent.type}-${ent.name}`} href={`/news?q=${encodeURIComponent(ent.name)}`}>
                        <em>{entityTypeLabel(ent.type, uiLang)}</em>
                        {ent.name}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {data.related.length ? (
                <section id="rel">
                  <h2>{L.dRel}</h2>
                  <div className="d-rel">
                    {data.related.map((row) => {
                      const c = sourceColor(row.source.slug, row.source.color);
                      const t = showFa ? row.title_fa || row.title : row.title;
                      return (
                        <Link
                          key={row.id}
                          href={`/news/${row.id}${feedIds.length ? `?ids=${feedIds.join(",")}` : ""}`}
                          className="d-rc"
                          style={{ ["--c" as string]: c }}
                        >
                          <small>{row.source.name}</small>
                          <span>{t}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </article>

            <aside className="d-side">
              <a className="d-btn" href={data.url} target="_blank" rel="noopener noreferrer">
                {L.dOrig}
              </a>
              <div className="d-box">
                <div className="d-row">
                  <button
                    type="button"
                    className="d-ib"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(window.location.href);
                      } catch {
                        /* ignore */
                      }
                      showToast(L.dCopied);
                    }}
                  >
                    {L.dCopy}
                  </button>
                </div>
              </div>
              <div className="d-box">
                <h3>{L.dFs}</h3>
                <div className="d-row">
                  <button
                    type="button"
                    className="d-ib"
                    onClick={() => setFs((v) => Math.max(15, v - 2))}
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    className="d-ib"
                    onClick={() => setFs((v) => Math.min(26, v + 2))}
                  >
                    A+
                  </button>
                </div>
                <h3 style={{ marginTop: 14 }}>{L.dFoc}</h3>
                <button
                  type="button"
                  className={`d-ib${focus ? " on" : ""}`}
                  style={{ width: "100%" }}
                  onClick={() => setFocus((v) => !v)}
                >
                  {focus ? "●" : "○"} F
                </button>
              </div>
              {showTrace && data.fetch_trace ? (
                <div className="d-box">
                  <h3>{L.dTr}</h3>
                  <dl>
                    <dt>{L.dSrc}</dt>
                    <dd>{data.fetch_trace.source_name}</dd>
                    <dt>{L.dMet}</dt>
                    <dd>{data.fetch_trace.method}</dd>
                    <dt>{L.dJob}</dt>
                    <dd>#{fmtN(data.fetch_trace.job_id ?? 0, uiLang)}</dd>
                    <dt>{L.dFet}</dt>
                    <dd>
                      {new Intl.DateTimeFormat(faMode ? "fa-IR" : "en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(data.fetch_trace.fetched_at))}
                    </dd>
                    <dt>{L.dTl}</dt>
                    <dd>{tlLabel(data.fetch_trace.translation_status, L)}</dd>
                    <dt>{L.dHash}</dt>
                    <dd>
                      <code>{(data.fetch_trace.content_hash || "").slice(0, 8)}</code>
                    </dd>
                    <dt>{L.dCanon}</dt>
                    <dd>
                      <code>{data.fetch_trace.canonical}</code>
                    </dd>
                  </dl>
                </div>
              ) : null}
            </aside>
          </div>

          <p className="d-hint" dangerouslySetInnerHTML={{ __html: L.dHint }} />
        </>
      ) : null}

      <div className={`d-toast${toast ? " on" : ""}`} role="status">
        {toast}
      </div>
    </div>
  );
}
