"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import PageView from "@/components/knowledge/PageView";
import ThemeSettings from "@/components/knowledge/ThemeSettings";
import TodayView from "@/components/knowledge/TodayView";
import TreePane from "@/components/knowledge/TreePane";
import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import {
  knowledgeApi,
  type KmBacklink,
  type KmNode,
  type KmPage,
  type KmTemplate,
  type PlanDay,
  type StudyPlan,
  type Today,
} from "@/lib/knowledge";
import { useEditorType } from "@/lib/knowledge-colors";
import { useKnowledgeTheme, type KnowledgeThemeId } from "@/lib/knowledge-theme";

type Mode = "today" | "page" | "folder" | "search" | "settings";

const SIDE_KEY = "ta_knowledge_sidebar";
const SIDE_MIN = 200;
const SIDE_MAX = 420;
const SIDE_DEFAULT = 256;

function readSidebar() {
  if (typeof window === "undefined") return { width: SIDE_DEFAULT, collapsed: false };
  try {
    const raw = window.localStorage.getItem(SIDE_KEY);
    if (!raw) return { width: SIDE_DEFAULT, collapsed: false };
    const parsed = JSON.parse(raw) as { width?: number; collapsed?: boolean };
    const width = typeof parsed.width === "number" ? Math.min(SIDE_MAX, Math.max(SIDE_MIN, parsed.width)) : SIDE_DEFAULT;
    return { width, collapsed: Boolean(parsed.collapsed) };
  } catch {
    return { width: SIDE_DEFAULT, collapsed: false };
  }
}

export default function KnowledgeApp() {
  const { t } = useI18n();
  const { theme, setTheme } = useKnowledgeTheme();
  const { value: typing, update: setTyping } = useEditorType();
  const [nodes, setNodes] = useState<KmNode[]>([]);
  const [mode, setMode] = useState<Mode>("today");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [page, setPage] = useState<KmPage | null>(null);
  const [backlinks, setBacklinks] = useState<KmBacklink[]>([]);
  const [today, setToday] = useState<Today | null>(null);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [templates, setTemplates] = useState<KmTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<KmNode & { snippet: string }>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoId, setUndoId] = useState<number | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDE_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [renameRequestId, setRenameRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshTree = useCallback(async () => {
    setNodes(await knowledgeApi.tree());
  }, []);

  const loadToday = useCallback(async () => {
    const [board, list] = await Promise.all([knowledgeApi.today(), knowledgeApi.plans()]);
    setToday(board);
    setPlans(list);
  }, []);

  useEffect(() => {
    void Promise.all([refreshTree(), loadToday(), knowledgeApi.templates().then(setTemplates)])
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("km.saveFailed")))
      .finally(() => setLoading(false));
  }, [loadToday, refreshTree, t]);

  useEffect(() => {
    const saved = readSidebar();
    setSidebarWidth(saved.width);
    setSidebarCollapsed(saved.collapsed);
  }, []);

  function rememberSidebar(width: number, collapsed: boolean) {
    window.localStorage.setItem(SIDE_KEY, JSON.stringify({ width, collapsed }));
  }

  function setSidebar(width: number, collapsed: boolean) {
    setSidebarWidth(width);
    setSidebarCollapsed(collapsed);
    rememberSidebar(width, collapsed);
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startW = sidebarWidth;
    const rtl = document.documentElement.dir === "rtl";
    const move = (pointer: PointerEvent) => {
      const next = Math.min(SIDE_MAX, Math.max(SIDE_MIN, startW + (rtl ? startX - pointer.clientX : pointer.clientX - startX)));
      setSidebarWidth(next);
    };
    const stop = (pointer: PointerEvent) => {
      const next = Math.min(SIDE_MAX, Math.max(SIDE_MIN, startW + (rtl ? startX - pointer.clientX : pointer.clientX - startX)));
      setSidebar(next, false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMode("search");
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openNode(node: KmNode, keepTree = false) {
    setActiveId(node.id);
    if (!keepTree) setTreeOpen(false);
    setNotice(null);
    if (node.type === "folder") {
      setMode("folder");
      setPage(null);
      return;
    }
    const loaded = await knowledgeApi.page(node.id);
    const incoming = await knowledgeApi.backlinks(node.id);
    setPage(loaded);
    setBacklinks(incoming);
    setMode("page");
  }

  async function openId(id: number) {
    const node = nodes.find((item) => item.id === id);
    if (node) {
      await openNode(node);
      return;
    }
    const loaded = await knowledgeApi.page(id);
    setPage(loaded);
    setBacklinks(await knowledgeApi.backlinks(id));
    setActiveId(id);
    setMode("page");
  }

  async function create(type: "folder" | "page", parentId: number | null, templateId?: number) {
    const title = type === "folder" ? t("km.untitledFolder") : t("km.untitledPage");
    const created = await knowledgeApi.create({
      type,
      title,
      parent_id: parentId,
      ...(templateId ? { template_id: templateId } : {}),
    });
    setRenameRequestId(created.id);
    setTreeOpen(true);
    setSidebar(sidebarWidth, false);
    await refreshTree();
    await openNode(created, true);
  }

  async function rename(node: KmNode, title: string) {
    if (node.type === "page") {
      const current = page?.id === node.id ? page : await knowledgeApi.page(node.id);
      const saved = await knowledgeApi.save(node.id, current.version, { title });
      if (page?.id === node.id) setPage(saved);
    } else {
      await knowledgeApi.renameFolder(node.id, title);
    }
    await refreshTree();
  }

  async function remove(node: KmNode) {
    await knowledgeApi.remove(node.id);
    setUndoId(node.id);
    setNotice(t("km.deleted"));
    if (activeId === node.id || page?.id === node.id) {
      setPage(null);
      setActiveId(null);
      setMode("today");
    }
    await refreshTree();
  }

  async function restore() {
    if (!undoId) return;
    const restored = await knowledgeApi.restore(undoId);
    setUndoId(null);
    setNotice(t("km.restored"));
    await refreshTree();
    await openNode(restored);
  }

  async function move(nodeId: number, parentId: number | null, position: number) {
    await knowledgeApi.move(nodeId, parentId, position);
    await refreshTree();
  }

  const folder = nodes.find((node) => node.id === activeId && node.type === "folder") ?? null;
  const folders = nodes.filter((node) => node.type === "folder");

  return (
    <div
      className="km-app relative -mx-2.5 -my-6 flex h-[calc(100dvh-6.25rem)] overflow-hidden max-md:-mx-3 max-md:-my-4 max-md:h-[calc(100dvh-7.1rem)]"
      style={theme.vars as CSSProperties}
    >
      <aside
        className={cx(
          "km-sidebar relative z-30 flex shrink-0 border-e max-md:absolute max-md:inset-y-0",
          treeOpen ? "max-md:flex" : "max-md:hidden",
        )}
        style={{ borderColor: "var(--km-border)", ["--km-side" as string]: sidebarCollapsed ? "44px" : `${sidebarWidth}px` }}
      >
        {sidebarCollapsed ? (
          <div className="hidden h-full w-11 flex-col items-center py-2 md:flex" style={{ background: "var(--km-sidebar)" }}>
            <button
              type="button"
              onClick={() => setSidebar(sidebarWidth, false)}
              title={t("km.expandTree")}
              aria-label={t("km.expandTree")}
              className="km-tool flex size-9 items-center justify-center rounded-lg"
            >
              <PanelIcon open />
            </button>
          </div>
        ) : null}
        <div className={cx("min-h-0 min-w-0 flex-1", sidebarCollapsed && "md:hidden")}>
          <TreePane
            nodes={nodes}
            activeId={activeId}
            renameRequestId={renameRequestId}
            onRenameDone={() => setRenameRequestId(null)}
            onCollapse={() => setSidebar(sidebarWidth, true)}
            onOpen={(node) => void openNode(node)}
            onCreate={(type, parentId) => void create(type, parentId)}
            onRename={(node, title) => void rename(node, title)}
            onDelete={(node) => void remove(node)}
            onDuplicate={(node) =>
              void knowledgeApi.duplicate(node.id).then(async (copy) => {
                await refreshTree();
                await openNode(copy);
              })
            }
            onExport={(node) => void knowledgeApi.export(node)}
            onMove={(nodeId, parentId, position) => void move(nodeId, parentId, position)}
          />
        </div>
        {sidebarCollapsed ? null : (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("km.resizeTree")}
            title={t("km.resizeTree")}
            onPointerDown={startResize}
            onDoubleClick={() => setSidebar(SIDE_DEFAULT, false)}
            className="km-resize absolute inset-y-0 end-0 z-20 hidden w-2 cursor-col-resize touch-none md:block"
          />
        )}
      </aside>
      {treeOpen ? (
        <button type="button" className="absolute inset-0 z-10 bg-black/40 md:hidden" aria-label={t("common.close")} onClick={() => setTreeOpen(false)} />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col" style={{ background: "var(--km-panel)" }}>
        <header className="relative flex h-12 items-center gap-1.5 border-b px-2" style={{ borderColor: "var(--km-border)" }}>
          <button type="button" className="flex size-9 items-center justify-center rounded-lg md:hidden" onClick={() => setTreeOpen(true)} aria-label={t("km.tree")}>
            ☰
          </button>
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setMode("search");
              if (value.trim().length < 2) {
                setHits([]);
                return;
              }
              void knowledgeApi.search(value.trim(), folder?.id).then(setHits).catch(() => setHits([]));
            }}
            onFocus={() => setMode("search")}
            placeholder={t("km.searchHint")}
            aria-label={t("km.search")}
            className="km-field h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setMode("today")}
            className="h-9 shrink-0 rounded-lg px-3 text-sm font-bold"
            style={{
              background: mode === "today" ? "var(--km-accent)" : "var(--km-selection)",
              color: mode === "today" ? "var(--km-accent-ink)" : "var(--km-text)",
            }}
          >
            {t("km.today")}
          </button>
          <button
            type="button"
            aria-label={t("km.more")}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ background: moreOpen ? "var(--km-selection)" : "transparent" }}
          >
            ···
          </button>
          {moreOpen ? (
            <div
              className="absolute end-2 top-12 z-30 w-56 overflow-hidden rounded-xl border p-1 shadow-lg"
              style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}
            >
              <MenuRow
                label={t("km.daily")}
                onClick={() => {
                  setMoreOpen(false);
                  void knowledgeApi.daily().then((note) => openNode(note)).then(refreshTree);
                }}
              />
              <MenuRow label={t("km.settings")} onClick={() => { setMoreOpen(false); setMode("settings"); }} />
              {templates.map((item) => (
                <MenuRow
                  key={item.id}
                  label={`${t("km.useTemplate")}: ${item.title}`}
                  onClick={() => {
                    setMoreOpen(false);
                    void create("page", folder?.id ?? page?.parent_id ?? null, item.id);
                  }}
                />
              ))}
            </div>
          ) : null}
        </header>

        {error ? (
          <p className="px-4 py-2 text-sm" style={{ color: "var(--km-danger)" }}>{error}</p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-sm" style={{ color: "var(--km-muted)" }}>{t("common.loading")}</p>
          ) : mode === "settings" ? (
            <ThemeSettings active={theme.id} typing={typing} onType={setTyping} onPick={(id: KnowledgeThemeId) => setTheme(id)} />
          ) : mode === "search" ? (
            <SearchPane hits={hits} onOpen={(id) => void openId(id)} />
          ) : mode === "page" && page ? (
            <PageView
              page={page}
              nodes={nodes}
              plans={plans}
              reviews={today?.reviews ?? []}
              backlinks={backlinks}
              notice={notice}
              typing={typing}
              onSaved={(saved) => {
                setPage(saved);
                setNodes((current) => current.map((node) => (node.id === saved.id ? { ...node, title: saved.title } : node)));
              }}
              onOpen={(id) => void openId(id)}
              onShowToday={() => setMode("today")}
            />
          ) : mode === "folder" && folder ? (
            <FolderHome
              folder={folder}
              count={nodes.filter((node) => node.parent_id === folder.id).length}
              onExport={() => void knowledgeApi.export(folder)}
              onCreate={(type) => void create(type, folder.id)}
            />
          ) : (
            <TodayView
              today={today}
              plans={plans}
              folders={folders}
              onOpen={(id) => void openId(id)}
              onCreatePlan={async (title, start, days) => {
                await knowledgeApi.createPlan(title, start, days);
                await loadToday();
              }}
              onDay={async (id, body) => {
                await knowledgeApi.updateDay(id, body);
                await loadToday();
              }}
              onShift={async (id, days) => {
                await knowledgeApi.shift(id, days);
                await loadToday();
              }}
              onReview={async (id) => {
                await knowledgeApi.finishReview(id);
                await loadToday();
              }}
            />
          )}
        </div>
      </div>
      {undoId ? (
        <div
          className="absolute bottom-5 left-1/2 z-40 flex w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm shadow-xl"
          style={{ background: "var(--km-elevated)", borderColor: "var(--km-border)" }}
        >
          <span className="min-w-0 flex-1 leading-5">{t("km.deleted")}</span>
          <button type="button" className="shrink-0 font-bold" style={{ color: "var(--km-accent)" }} onClick={() => void restore()}>
            {t("km.restore")}
          </button>
          <button
            type="button"
            aria-label={t("km.dismiss")}
            title={t("km.dismiss")}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-base leading-none"
            style={{ color: "var(--km-muted)" }}
            onClick={() => setUndoId(null)}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PanelIcon({ open }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] rtl:-scale-x-100" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 5v14" stroke="currentColor" strokeWidth="1.7" />
      <path
        d={open ? "m13 10 2 2-2 2" : "m14.5 10-2 2 2 2"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full truncate rounded-lg px-3 py-2 text-start text-sm">
      {label}
    </button>
  );
}

function FolderHome({
  folder,
  count,
  onExport,
  onCreate,
}: {
  folder: KmNode;
  count: number;
  onExport: () => void;
  onCreate: (type: "folder" | "page") => void;
}) {
  const { t } = useI18n();
  return (
    <div className="max-w-xl px-3 py-8">
      <p className="text-xs font-semibold" style={{ color: "var(--km-faint)" }}>{t("km.folder")}</p>
      <h1 className="mt-1 text-3xl font-bold">{folder.title}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--km-muted)" }}>{t("km.childCount", { count })}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg px-3 py-2 text-sm font-bold" style={{ background: "var(--km-accent)", color: "var(--km-accent-ink)" }} onClick={() => onCreate("page")}>
          {t("km.newPage")}
        </button>
        <button type="button" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--km-border)" }} onClick={() => onCreate("folder")}>
          {t("km.newFolder")}
        </button>
        <button type="button" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--km-border)" }} onClick={onExport}>
          {t("km.export")}
        </button>
      </div>
    </div>
  );
}

function SearchPane({
  hits,
  onOpen,
}: {
  hits: Array<KmNode & { snippet: string }>;
  onOpen: (id: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="max-w-2xl px-3 py-6">
      <p className="text-xs" style={{ color: "var(--km-muted)" }}>{t("km.searchMin")}</p>
      <ul className="mt-4 space-y-2">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => onOpen(hit.id)}
              className="w-full rounded-xl border px-4 py-3 text-start"
              style={{ borderColor: "var(--km-border)", background: "var(--km-elevated)" }}
            >
              <span className="block text-sm font-semibold">{hit.title}</span>
              <span className="mt-1 block text-xs leading-5" style={{ color: "var(--km-muted)" }}>{hit.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
