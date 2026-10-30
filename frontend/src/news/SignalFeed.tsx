"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import SignalAdmin from "./SignalAdmin";
import { listAllArticles, listSources } from "./api";
import { sourceColor } from "./colors";
import { catLabel, copy, fmtN } from "./copy";
import { dateFromRange, dayKey, dayLabel, hoursAgo } from "./dates";
import { useSignal } from "./SignalContext";
import type { NewsArticle, NewsSource, RangeKey } from "./types";

export default function SignalFeed() {
  const { lang, setLang, adminOpen, access } = useSignal();
  const L = copy(lang);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const qParam = params.get("q") ?? "";
  const range = (Number(params.get("range") ?? "2") || 0) as RangeKey;
  const srcKey = params.getAll("source").join("|");
  const srcParam = useMemo(() => (srcKey ? srcKey.split("|") : []), [srcKey]);
  const selected = useMemo(() => new Set(srcParam), [srcParam]);
  const dayFilter = params.get("day");
  const openId = params.get("open");

  const [draft, setDraft] = useState(qParam);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(openId ? Number(openId) : null);

  useEffect(() => {
    setDraft(qParam);
  }, [qParam]);

  const write = useCallback(
    (next: { q?: string; range?: RangeKey; source?: string[]; day?: string | null; open?: string | null }) => {
      const search = new URLSearchParams();
      const query = next.q ?? qParam;
      const rng = next.range ?? range;
      const slugs = next.source ?? srcParam;
      const day = next.day === undefined ? dayFilter : next.day;
      const open = next.open === undefined ? openId : next.open;
      if (query) search.set("q", query);
      if (rng !== 2) search.set("range", String(rng));
      slugs.forEach((slug) => search.append("source", slug));
      if (day) search.set("day", day);
      if (open) search.set("open", open);
      const raw = search.toString();
      router.replace(raw ? `${pathname}?${raw}` : pathname, { scroll: false });
    },
    [qParam, range, srcParam, dayFilter, openId, pathname, router],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== qParam) write({ q: draft });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [draft, qParam, write]);

  useEffect(() => {
    listSources()
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAllArticles({ dateFrom: dateFromRange(range) })
      .then((data) => {
        if (!cancelled) setArticles(data.results);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const sourceById = useMemo(() => new Map(sources.map((row) => [row.id, row])), [sources]);

  const visible = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    const day = dayFilter === null || dayFilter === "" ? null : Number(dayFilter);
    return articles.filter((row) => {
      if (selected.size && !selected.has(row.source_slug)) return false;
      if (day !== null && !Number.isNaN(day) && dayKey(row.published_at) !== day) return false;
      if (!needle) return true;
      const blob = `${row.title} ${row.title_fa} ${row.summary} ${row.summary_fa} ${row.source_name}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [articles, selected, dayFilter, draft]);

  const top = visible[0] ?? null;
  const li = lang === "fa" ? 1 : 0;
  const titleOf = (row: NewsArticle) => (li ? row.title_fa || row.title : row.title);
  const summaryOf = (row: NewsArticle) => (li ? row.summary_fa || row.summary : row.summary);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    articles.forEach((row) => {
      map[row.source_slug] = (map[row.source_slug] || 0) + 1;
    });
    return map;
  }, [articles]);

  const bars = useMemo(() => {
    const keys = [...new Set(articles.map((row) => dayKey(row.published_at)))].sort((a, b) => b - a).slice(-10);
    const max = Math.max(1, ...keys.map((key) => articles.filter((row) => dayKey(row.published_at) === key).length));
    return keys.map((key) => ({
      key,
      n: articles.filter((row) => dayKey(row.published_at) === key).length,
      max,
    }));
  }, [articles]);

  const openStory = useCallback(
    (id: number) => {
      try {
        sessionStorage.setItem(
          "ta_signal_feed_ids",
          JSON.stringify(visible.map((row) => row.id)),
        );
      } catch {
        /* ignore */
      }
      const search = new URLSearchParams();
      if (qParam) search.set("q", qParam);
      if (range !== 2) search.set("range", String(range));
      srcParam.forEach((slug) => search.append("source", slug));
      if (dayFilter) search.set("day", dayFilter);
      const ids = visible.map((row) => row.id);
      if (ids.length) search.set("ids", ids.join(","));
      const raw = search.toString();
      router.push(raw ? `/news/${id}?${raw}` : `/news/${id}`);
    },
    [visible, qParam, range, srcParam, dayFilter, router],
  );

  useEffect(() => {
    if (!openId) return;
    const id = Number(openId);
    if (Number.isFinite(id) && id > 0) openStory(id);
  }, [openId, openStory]);

  const step = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const ids = visible.map((row) => row.id);
      let i = sel == null ? -1 : ids.indexOf(sel);
      i = Math.max(0, Math.min(ids.length - 1, i + delta));
      const next = ids[i];
      setSel(next);
      requestAnimationFrame(() => {
        document.querySelector(".signal-root .card.sel")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [visible, sel],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, select, textarea")) {
        if (event.key === "Escape") target.blur();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "j") step(1);
      else if (event.key === "k") step(-1);
      else if (event.key === "Enter" && sel != null) openStory(sel);
      else if (event.key === "l" || event.key === "L") setLang(lang === "en" ? "fa" : "en");
      else if (event.key === "Escape") write({ open: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sel, lang, setLang, write, step, openStory]);

  const toggleSource = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    write({ source: [...next] });
  };

  return (
    <>
      {access?.is_fetch_admin ? <SignalAdmin open={adminOpen} sources={sources} /> : null}

      {top ? (
        <section className="hero">
          <div
            className="lead"
            style={{ ["--c" as string]: sourceColor(top.source_slug, sourceById.get(top.source)?.color) }}
            onClick={() => {
              setSel(top.id);
              openStory(top.id);
            }}
          >
            <div className="kick">
              {L.top} · {top.source_name}
            </div>
            <h1>{titleOf(top)}</h1>
            <p>{summaryOf(top)}</p>
          </div>
          <div className="pulse">
            <h3>{L.pulse}</h3>
            <div className="big">{fmtN(visible.length, lang)}</div>
            <div className="bars">
              {bars.map((bar) => (
                <b
                  key={bar.key}
                  className={dayFilter === String(bar.key) ? "on" : ""}
                  title={`${dayLabel(bar.key, lang)} · ${bar.n}`}
                  style={{ height: `${12 + (bar.n / bar.max) * 78}px` }}
                  onClick={() => write({ day: dayFilter === String(bar.key) ? null : String(bar.key) })}
                />
              ))}
            </div>
            <div className="bars-l">
              <span>{L.older}</span>
              <span>{L.today}</span>
            </div>
          </div>
        </section>
      ) : null}

      <div className="tools">
        <div className="search">
          <span>⌕</span>
          <input
            ref={searchRef}
            value={draft}
            placeholder={L.ph}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
          <kbd>/</kbd>
        </div>
        <div className="seg">
          {L.rng.map((label, i) => (
            <button
              key={label}
              type="button"
              className={range === i ? "on" : ""}
              onClick={() => write({ range: i as RangeKey, day: null })}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ib"
          onClick={() => {
            setDraft("");
            write({ q: "", range: 2, source: [], day: null, open: null });
          }}
        >
          {L.clr}
        </button>
      </div>

      <div className="chips">
        {sources
          .filter((source) => counts[source.slug])
          .map((source) => (
            <button
              key={source.slug}
              type="button"
              className={selected.has(source.slug) ? "chip on" : "chip"}
              style={{ ["--c" as string]: sourceColor(source.slug, source.color) }}
              onClick={() => toggleSource(source.slug)}
            >
              <i />
              {source.name} <em>{fmtN(counts[source.slug], lang)}</em>
            </button>
          ))}
      </div>

      <div className="feed">
        {loading ? <div className="empty">…</div> : null}
        {!loading && !visible.length ? <div className="empty">{L.none}</div> : null}
        {visible.map((row, i) => {
          const key = dayKey(row.published_at);
          const showDay = i === 0 || dayKey(visible[i - 1].published_at) !== key;
          return (
            <Fragment key={row.id}>
              {showDay ? <div className="day">{dayLabel(key, lang)}</div> : null}
              <article
                className={sel === row.id ? "card sel" : "card"}
                style={{
                  ["--c" as string]: sourceColor(row.source_slug, sourceById.get(row.source)?.color),
                  animationDelay: `${Math.min(i, 10) * 40}ms`,
                }}
                onClick={() => {
                  setSel(row.id);
                  openStory(row.id);
                }}
              >
                <div>
                  <div className="meta">
                    <b>{row.source_name}</b>
                    <span>{L.ago(Math.round(hoursAgo(row.published_at)))}</span>
                    <span className="tag">{catLabel(sourceById.get(row.source)?.category ?? "", lang)}</span>
                  </div>
                  <h2>{titleOf(row)}</h2>
                  <p>{summaryOf(row)}</p>
                </div>
                <div className="go">→</div>
              </article>
            </Fragment>
          );
        })}
      </div>

      <p className="hint" dangerouslySetInnerHTML={{ __html: L.hint }} />
    </>
  );
}
