"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import ContentPalette from "@/components/knowledge/ContentPalette";
import KnowledgeEditor, { type KnowledgeEditorHandle } from "@/components/knowledge/KnowledgeEditor";
import { mediaUrl } from "@/lib/api";
import type { EditorType } from "@/lib/knowledge-colors";
import { editorTypeStyle } from "@/lib/knowledge-colors";
import { useI18n } from "@/lib/i18n";
import {
  displayTitle,
  docToText,
  knowledgeApi,
  linkQuery,
  pageStudy,
  slashQuery,
  textToDoc,
  type KmBacklink,
  type KmDrawing,
  type KmFile,
  type KmLink,
  type KmNode,
  type KmPage,
  type Review,
  type StudyPlan,
} from "@/lib/knowledge";

const CANVAS_W = 800;
const CANVAS_H = 320;

const SLASH = [
  { id: "h", token: "h", insert: "# ", labelKey: "km.block.heading" },
  { id: "list", token: "list", insert: "- ", labelKey: "km.block.list" },
  { id: "ol", token: "1", insert: "1. ", labelKey: "km.block.numbered" },
  { id: "quote", token: "quote", insert: "> ", labelKey: "km.block.quote" },
  { id: "code", token: "code", insert: "```\n\n```", labelKey: "km.block.code" },
  { id: "link", token: "link", insert: "[[", labelKey: "km.block.link" },
  { id: "def", token: "def", insert: "", callout: "blue", labelKey: "km.callout.blue" },
  { id: "example", token: "example", insert: "", callout: "purple", labelKey: "km.callout.purple" },
  { id: "warn", token: "warn", insert: "", callout: "orange", labelKey: "km.callout.orange" },
  { id: "fact", token: "fact", insert: "", callout: "gold", labelKey: "km.callout.gold" },
] as const;

export default function PageView({
  page,
  nodes,
  plans,
  reviews,
  backlinks,
  onSaved,
  onOpen,
  onShowToday,
  notice,
  typing,
}: {
  page: KmPage;
  nodes: KmNode[];
  plans: StudyPlan[];
  reviews: Review[];
  backlinks: KmBacklink[];
  onSaved: (page: KmPage) => void;
  onOpen: (id: number) => void;
  onShowToday: () => void;
  notice: string | null;
  typing: EditorType;
}) {
  const { t, locale } = useI18n();
  const [title, setTitle] = useState(page.title);
  const [text, setText] = useState(docToText(page.content));
  const [revision, setRevision] = useState(0);
  const [pageKey, setPageKey] = useState(page.id);
  const [links, setLinks] = useState<KmLink[]>(page.links);
  const [files, setFiles] = useState<KmFile[]>(page.files);
  const [drawing, setDrawing] = useState<KmDrawing | null>(page.drawings[0] ?? null);
  const [drawingOn, setDrawingOn] = useState(false);
  const [guide, setGuide] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [slash, setSlash] = useState<string | null>(null);
  const [hits, setHits] = useState<KmNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const version = useRef(page.version);
  const editorRef = useRef<KnowledgeEditorHandle>(null);
  const quiet = useRef(true);
  const study = pageStudy(page, nodes, plans, reviews);
  const commands = SLASH.filter((item) => !slash || item.token.startsWith(slash.toLowerCase()) || t(item.labelKey).includes(slash));

  useEffect(() => {
    quiet.current = true;
    setPageKey(page.id);
    setTitle(page.title);
    setText(docToText(page.content));
    setLinks(page.links);
    setFiles(page.files);
    setDrawing(page.drawings[0] ?? null);
    version.current = page.version;
    setQuery(null);
    setSlash(null);
    setSaveState("idle");
    setLinksOpen(false);
    // Reset the draft only when another page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id]);

  useEffect(() => {
    if (quiet.current) {
      quiet.current = false;
      return;
    }
    setSaveState("saving");
    const handle = window.setTimeout(() => {
      void persist(title);
    }, 700);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, revision, pageKey]);

  useEffect(() => {
    if (query === null || query.length < 1) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      knowledgeApi.titles(query).then(setHits).catch(() => setHits([]));
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function persist(nextTitle: string) {
    const clean = nextTitle.trim();
    if (!clean) return;
    try {
      const saved = await knowledgeApi.save(page.id, version.current, {
        title: clean,
        content: editorRef.current?.getDoc() ?? textToDoc(text),
      });
      version.current = saved.version;
      setLinks(saved.links);
      onSaved(saved);
      setError(null);
      setSaveState("saved");
    } catch (err) {
      setSaveState("idle");
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 409) {
        const fresh = await knowledgeApi.page(page.id);
        quiet.current = true;
        setTitle(fresh.title);
        setText(docToText(fresh.content));
        editorRef.current?.load(fresh.content);
        setLinks(fresh.links);
        version.current = fresh.version;
        onSaved(fresh);
        setError(t("km.conflict"));
        return;
      }
      setError(err instanceof Error ? err.message : t("km.saveFailed"));
    }
  }

  function readCursor(value: string, cursor: number) {
    setQuery(linkQuery(value, cursor));
    setSlash(slashQuery(value, cursor));
  }

  function prefixLine(prefix: string) {
    editorRef.current?.prefixLine(prefix);
    setSlash(null);
  }

  function insertSlash(item: (typeof SLASH)[number]) {
    if ("callout" in item && item.callout) editorRef.current?.insertCallout(item.callout, t(item.labelKey));
    else editorRef.current?.replaceSlash(item.insert);
    setSlash(null);
  }

  function wrap(mark: string) {
    editorRef.current?.wrap(mark, t("km.sample"));
  }

  function insertLink(name: string) {
    editorRef.current?.insertLink(name);
    setQuery(null);
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      const saved = await knowledgeApi.upload(page.id, file);
      setFiles((current) => [saved, ...current]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("km.saveFailed"));
    }
  }

  const edited = page.updated_at
    ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en", {
        timeZone: "Asia/Tehran",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(page.updated_at))
    : "";

  return (
    <div className="relative flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="w-full max-w-[45rem] px-3 py-4 md:py-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--km-muted)" }}>
            {study.crumbs.map((crumb) => (
              <button key={crumb.id} type="button" className="truncate" onClick={() => onOpen(crumb.id)}>
                {displayTitle(crumb.title, t("km.dailyFolder"))}
                <span className="px-1" style={{ color: "var(--km-faint)" }}>/</span>
              </button>
            ))}
            <span className="ms-auto">
              {saveState === "saving" ? t("km.saving") : saveState === "saved" ? t("km.saved") : edited ? t("km.edited", { time: edited }) : ""}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {study.course ? <Chip>{displayTitle(study.course, t("km.dailyFolder"))}</Chip> : null}
            {study.dayDate ? <Chip>{study.dayDate}</Chip> : null}
            {study.status ? <Chip>{t(`km.status.${study.status}`)}</Chip> : null}
            {study.nextReview ? <Chip>{t("km.nextReview", { date: study.nextReview })}</Chip> : null}
            {!study.course ? (
              <button type="button" className="text-xs font-semibold" style={{ color: "var(--km-link)" }} onClick={onShowToday}>
                {t("km.addToPlan")}
              </button>
            ) : null}
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("km.titlePlaceholder")}
            aria-label={t("km.titlePlaceholder")}
            className="mt-2 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-[var(--km-muted)] focus:rounded-lg focus:ring-2 focus:ring-[var(--km-accent)] max-md:text-xl"
          />

          <div className="mt-3 flex flex-wrap gap-1 pb-1">
            <ToolButton label={t("km.block.heading")} onClick={() => prefixLine("# ")}><HashIcon /></ToolButton>
            <ToolButton label={t("km.block.list")} onClick={() => prefixLine("- ")}><ListIcon /></ToolButton>
            <ToolButton label={t("km.block.quote")} onClick={() => prefixLine("> ")}><QuoteIcon /></ToolButton>
            <ToolButton label={t("km.block.code")} onClick={() => prefixLine("```\n")}><CodeIcon /></ToolButton>
            <ToolButton label={t("km.bold")} onClick={() => wrap("**")}><BoldIcon /></ToolButton>
            <ContentPalette
              onText={(token) => editorRef.current?.applyMark("color", token)}
              onHighlight={(token) => editorRef.current?.applyMark("highlight", token)}
              onClear={() => editorRef.current?.clearFormatting()}
            />
            <span className="mx-1 w-px shrink-0 self-stretch" style={{ background: "var(--km-border)" }} />
            <ToolButton label={t("km.draw")} pressed={drawingOn} onClick={() => setDrawingOn((value) => !value)}>
              <PenIcon />
            </ToolButton>
            <label
              title={t("km.attach")}
              aria-label={t("km.attach")}
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg"
              style={{ background: "var(--km-selection)", color: "var(--km-text)" }}
            >
              <ClipIcon />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(event) => {
                  void onUpload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <ToolButton label={t("km.backlinks")} pressed={linksOpen} onClick={() => setLinksOpen((value) => !value)}>
              <LinkIcon />
            </ToolButton>
            <ToolButton label={t("km.guide")} pressed={guide} onClick={() => setGuide(true)}>
              <HelpIcon />
            </ToolButton>
          </div>

          {notice || error ? (
            <p className="mt-3 text-sm" style={{ color: error ? "var(--km-danger)" : "var(--km-muted)" }}>
              {error || notice}
            </p>
          ) : null}

          <div className="relative">
            <div style={editorTypeStyle(typing) as CSSProperties}>
            <KnowledgeEditor
              ref={editorRef}
              pageId={page.id}
              content={page.content}
              labels={{
                red: t("km.token.red"),
                orange: t("km.callout.orange"),
                gold: t("km.callout.gold"),
                green: t("km.token.green"),
                blue: t("km.callout.blue"),
                purple: t("km.callout.purple"),
                gray: t("km.token.gray"),
              }}
              placeholder={t("km.writeHint")}
              onEdit={(plain, cursor, dirty) => {
                setText(plain);
                readCursor(plain, cursor);
                if (dirty) setRevision((value) => value + 1);
              }}
            />
            </div>
            {slash !== null && commands.length > 0 ? (
              <Menu title={t("km.slash")}>
                {commands.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full px-3 py-2 text-start text-sm"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertSlash(item);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </Menu>
            ) : null}
            {query !== null && hits.length > 0 ? (
              <Menu title={t("km.block.link")}>
                {hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="block w-full truncate px-3 py-2 text-start text-sm"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertLink(hit.title);
                    }}
                  >
                    {displayTitle(hit.title, t("km.dailyFolder"))}
                  </button>
                ))}
              </Menu>
            ) : null}
          </div>

          {drawingOn ? (
            <InkPad
              drawing={drawing}
              onChange={async (strokes) => {
                const saved = await knowledgeApi.saveInk(
                  { node_id: page.id, strokes, width: CANVAS_W, height: CANVAS_H },
                  drawing?.id,
                );
                setDrawing(saved);
              }}
            />
          ) : null}

          {files.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {files.map((file) => (
                <li key={file.id}>
                  {file.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(file.url) ?? file.url} alt={file.name} className="max-h-64 w-full rounded-xl object-contain" />
                  ) : (
                    <a href={mediaUrl(file.url) ?? file.url} className="text-sm underline" style={{ color: "var(--km-link)" }}>
                      {file.name}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {links.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {links.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  disabled={link.broken}
                  onClick={() => onOpen(link.id)}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    background: "var(--km-selection)",
                    color: link.broken ? "var(--km-danger)" : "var(--km-link)",
                  }}
                >
                  {link.broken ? `${link.title} · ${t("km.broken")}` : link.title}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {linksOpen ? (
        <aside
          className="absolute inset-y-0 end-0 z-20 flex w-[min(100%,16rem)] flex-col border-s p-4 shadow-lg md:static md:w-56 md:shadow-none"
          style={{ borderColor: "var(--km-border)", background: "var(--km-sidebar)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "var(--km-muted)" }}>{t("km.backlinks")}</p>
            <button type="button" className="text-xs md:hidden" onClick={() => setLinksOpen(false)} aria-label={t("common.close")}>✕</button>
          </div>
          <p className="mt-2 text-xs leading-5" style={{ color: "var(--km-muted)" }}>{t("km.backlinksHint")}</p>
          {backlinks.length === 0 ? (
            <p className="mt-3 text-xs leading-5" style={{ color: "var(--km-muted)" }}>{t("km.noBacklinks")}</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {backlinks.map((link) => (
                <li key={link.id}>
                  <button type="button" className="w-full truncate text-start text-sm" style={{ color: "var(--km-link)" }} onClick={() => onOpen(link.id)}>
                    {link.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      ) : null}

      {guide ? (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setGuide(false)}>
          <div
            className="max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl"
            style={{ background: "var(--km-elevated)", color: "var(--km-text)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("km.guide")}</h2>
              <button type="button" onClick={() => setGuide(false)} aria-label={t("common.close")}>✕</button>
            </div>
            <ol className="mt-4 space-y-3 text-sm leading-7" style={{ color: "var(--km-muted)" }}>
              <li>{t("km.guide.1")}</li>
              <li>{t("km.guide.2")}</li>
              <li>{t("km.guide.3")}</li>
              <li>{t("km.guide.4")}</li>
              <li>{t("km.guide.5")}</li>
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs" style={{ background: "var(--km-selection)", color: "var(--km-text)" }}>
      {children}
    </span>
  );
}

function Menu({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      className="absolute start-0 top-2 z-10 w-56 overflow-hidden rounded-xl border shadow-lg"
      style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}
    >
      <p className="px-3 pt-2 text-[11px] font-semibold" style={{ color: "var(--km-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function ToolButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: pressed ? "var(--km-accent)" : "var(--km-selection)",
        color: pressed ? "var(--km-accent-ink)" : "var(--km-text)",
      }}
    >
      {children}
    </button>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

function HashIcon() {
  return (
    <Icon>
      <path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}
function ListIcon() {
  return (
    <Icon>
      <path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="5" cy="7" r="1" fill="currentColor" />
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="5" cy="17" r="1" fill="currentColor" />
    </Icon>
  );
}
function QuoteIcon() {
  return (
    <Icon>
      <path d="M8 16c0-3.5 1.4-6 4-7.5M16 16c0-3.5 1.4-6 4-7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 16h4.5M13 16h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}
function CodeIcon() {
  return (
    <Icon>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}
function BoldIcon() {
  return (
    <Icon>
      <path d="M7 5h6.2a3.4 3.4 0 0 1 0 6.8H7V5Zm0 6.8h7.1A3.6 3.6 0 0 1 14 19H7v-7.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  );
}
function PenIcon() {
  return (
    <Icon>
      <path d="M14.5 5.5 18.5 9.5 9 19H5v-4L14.5 5.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Icon>
  );
}
function ClipIcon() {
  return (
    <Icon>
      <path d="M8 12.5 14.2 6.3a3 3 0 0 1 4.2 4.2l-7.6 7.6a4.2 4.2 0 0 1-6-6L12 4.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}
function LinkIcon() {
  return (
    <Icon>
      <path d="M10 13a4 4 0 0 0 5.7.4l2-2A4 4 0 0 0 12 5.7l-1.1 1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 11a4 4 0 0 0-5.7-.4l-2 2A4 4 0 0 0 12 18.3l1.1-1.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  );
}
function HelpIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r=".9" fill="currentColor" />
    </Icon>
  );
}

function InkPad({
  drawing,
  onChange,
}: {
  drawing: KmDrawing | null;
  onChange: (strokes: KmDrawing["strokes"]) => Promise<void>;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<KmDrawing["strokes"]>(drawing?.strokes ?? []);
  const current = useRef<number[][] | null>(null);

  useEffect(() => {
    strokes.current = drawing?.strokes ?? [];
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  function paint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = getComputedStyle(canvas).color || "#e7a04a";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of [...strokes.current, ...(current.current ? [{ points: current.current }] : [])]) {
      const points = stroke.points;
      if (points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
      ctx.stroke();
    }
  }

  function point(event: PointerEvent<HTMLCanvasElement>): number[] {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    ];
  }

  return (
    <div className="mt-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full touch-none rounded-xl border"
        style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)", color: "var(--km-accent)", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          current.current = [point(event)];
        }}
        onPointerMove={(event) => {
          if (!current.current) return;
          current.current.push(point(event));
          paint();
        }}
        onPointerUp={() => {
          if (current.current && current.current.length > 1) {
            strokes.current = [...strokes.current, { points: current.current }];
            void onChange(strokes.current);
          }
          current.current = null;
          paint();
        }}
      />
      <button
        type="button"
        className="mt-2 text-xs"
        style={{ color: "var(--km-danger)" }}
        onClick={() => {
          strokes.current = [];
          paint();
          void onChange([]);
        }}
      >
        {t("km.clearDrawing")}
      </button>
    </div>
  );
}
