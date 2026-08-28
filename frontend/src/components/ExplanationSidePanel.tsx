"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cx } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import { cardPalette, type TreeFolder } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";
import type { Process, ProcessStepDetail } from "@/lib/types";

const STORAGE_KEY = "ta_explanation_panel_open";

type PanelProcess = { id: number; name: string };
type TreeNode = {
  id: number;
  name: string;
  color?: string;
  processes: PanelProcess[];
  children: TreeNode[];
};

function toNode(folder: TreeFolder): TreeNode {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    processes: folder.processes.map((item) => ({
      id: item.id,
      name: item.name,
    })),
    children: folder.children.map(toNode),
  };
}

function readOpenState(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "1";
}

/**
 * Stripe-style tools panel, pinned to the physical right.
 * Top: platform tools (تشریح سیستم). Below: project/process tree.
 */
export default function ExplanationSidePanel() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const { t, dir } = useI18n();
  const routeId = params.id ? Number(params.id) : NaN;

  const [open, setOpen] = useState(true);
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<number | null>(null);
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
  const [activeStepTitle, setActiveStepTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setOpen(readOpenState());
  }, []);

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const resolveContext = useCallback(async () => {
    setActiveProjectId(null);
    setActiveProcessId(null);
    setActiveStepId(null);
    setActiveStepTitle(null);

    if (!Number.isFinite(routeId)) return;

    if (pathname.includes("/projects/")) {
      setActiveProjectId(routeId);
      return;
    }

    if (pathname.includes("/processes/")) {
      const process = await apiFetch<Process>(`/processes/${routeId}/`);
      setActiveProcessId(process.id);
      setActiveProjectId(process.project);
      return;
    }

    if (pathname.includes("/steps/")) {
      const step = await apiFetch<ProcessStepDetail>(`/steps/${routeId}/`);
      setActiveStepId(step.id);
      setActiveStepTitle(step.title);
      setActiveProcessId(step.process);
      setActiveProjectId(
        step.project ?? (await apiFetch<Process>(`/processes/${step.process}/`)).project,
      );
    }
  }, [pathname, routeId]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const folders = await apiList<TreeFolder>("/projects/tree/");
      setRoots(folders.map(toNode));
    } catch {
      setRoots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    resolveContext().catch(() => undefined);
  }, [resolveContext]);

  // Auto-expand the branch that contains the current page.
  useEffect(() => {
    if (!activeProjectId && !activeProcessId) return;
    setExpanded((current) => {
      const next = { ...current };
      for (const node of roots) {
        const hitRoot =
          node.id === activeProjectId ||
          node.processes.some((p) => p.id === activeProcessId) ||
          node.children.some(
            (child) =>
              child.id === activeProjectId ||
              child.processes.some((p) => p.id === activeProcessId),
          );
        if (hitRoot) next[node.id] = true;
        for (const child of node.children) {
          if (
            child.id === activeProjectId ||
            child.processes.some((p) => p.id === activeProcessId)
          ) {
            next[child.id] = true;
            next[node.id] = true;
          }
        }
      }
      return next;
    });
  }, [roots, activeProjectId, activeProcessId]);

  const isProjectActive = (id: number) => activeProjectId === id;
  const isProcessActive = (id: number) => activeProcessId === id;

  const toggleExpand = (id: number) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  };

  const renderProcesses = (processes: PanelProcess[]) => (
    <ul className="ms-2 space-y-0.5 border-s border-navy-700/60 ps-2">
      {processes.map((process) => (
        <li key={process.id}>
          <Link
            href={`/explanation/processes/${process.id}`}
            className={cx(
              "block rounded-md px-2 py-1.5 text-xs transition",
              isProcessActive(process.id)
                ? "bg-brand-500 font-medium text-ink"
                : "text-gray-300 hover:bg-navy-700 hover:text-white",
            )}
          >
            {process.name}
          </Link>
        </li>
      ))}
    </ul>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="sticky top-28 z-30 hidden h-[calc(100vh-8rem)] w-10 shrink-0 flex-col items-center gap-3 rounded-xl bg-navy-900 py-4 text-white shadow-md transition hover:bg-navy-800 md:flex"
        title={t("nav.showTools")}
        dir={dir}
      >
        <span className="text-sm leading-none">‹</span>
        <span
          className="text-[11px] font-medium tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {t("nav.tools")}
        </span>
      </button>
    );
  }

  return (
    <aside
      className="sticky top-28 z-30 hidden h-[calc(100vh-8rem)] w-56 shrink-0 flex-col overflow-hidden rounded-xl bg-navy-900 text-white shadow-md md:flex"
      dir={dir}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-navy-700 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{t("nav.tools")}</p>
          <p className="text-[11px] text-gray-400">{t("brand.name")}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md px-2 py-1 text-xs text-gray-300 transition hover:bg-navy-700 hover:text-white"
          title={t("nav.hideTools")}
        >
          {t("nav.hideTools")}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {/* Tools list (Stripe-style primary nav) */}
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("nav.services")}
          </p>
          <Link
            href="/work"
            className={cx(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              pathname.startsWith("/work")
                ? "bg-navy-700 font-medium text-white"
                : "text-gray-200 hover:bg-navy-800",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px] font-bold">
              ک
            </span>
            <span className="min-w-0 flex-1">{t("nav.work")}</span>
          </Link>
          <Link
            href="/explanation"
            className={cx(
              "mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              pathname.startsWith("/explanation")
                ? "bg-navy-700 font-medium text-white"
                : "text-gray-200 hover:bg-navy-800",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-500 text-[11px] font-bold text-ink">
              ت
            </span>
            <span className="min-w-0 flex-1">{t("nav.explanation")}</span>
          </Link>
          <span className="mt-1 flex cursor-not-allowed items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-500 opacity-70">
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px]">
              ب
            </span>
            {t("nav.auditPlan")}
            <span className="ms-auto text-[10px]">{t("nav.soon")}</span>
          </span>
        </section>

        {/* Folder tree under the active tool */}
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("exp.folders")}
          </p>

          <Link
            href="/explanation"
            className={cx(
              "mb-1 block rounded-lg px-2.5 py-2 text-xs transition",
              pathname === "/explanation"
                ? "bg-brand-500 font-medium text-ink"
                : "text-gray-300 hover:bg-navy-700 hover:text-white",
            )}
          >
            {t("exp.allFolders")}
          </Link>

          <Link
            href="/explanation/tree"
            className={cx(
              "mb-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition",
              pathname === "/explanation/tree"
                ? "bg-brand-500 font-medium text-ink"
                : "text-gray-300 hover:bg-navy-700 hover:text-white",
            )}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                d="M12 4v4m0 0v4m0 0H6v4m6-4h6v4M4 18h4M16 18h4M10 4h4"
              />
            </svg>
            {t("exp.treeView")}
          </Link>

          {loading ? (
            <p className="px-2 py-3 text-xs text-gray-500">{t("common.loading")}</p>
          ) : roots.length === 0 ? (
            <p className="px-2 py-3 text-xs text-gray-500">{t("exp.noFolders")}</p>
          ) : (
            <div className="space-y-1">
              {roots.map((node) => {
                const isOpen = Boolean(expanded[node.id]);
                const hasKids =
                  node.processes.length > 0 || node.children.length > 0;

                return (
                  <div key={node.id} className="space-y-0.5">
                    <div className="flex items-center gap-0.5">
                      {hasKids ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(node.id)}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-xs text-gray-400 hover:bg-navy-700 hover:text-white"
                          aria-label={isOpen ? "بستن" : "باز کردن"}
                        >
                          {isOpen ? "▾" : "◂"}
                        </button>
                      ) : (
                        <span className="size-6 shrink-0" />
                      )}
                      <Link
                        href={`/explanation/projects/${node.id}`}
                        className={cx(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                          isProjectActive(node.id)
                            ? "bg-brand-500 font-semibold text-ink"
                            : "text-gray-100 hover:bg-navy-700",
                        )}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: cardPalette(node.color).accent,
                          }}
                        />
                        <span className="truncate">{node.name}</span>
                      </Link>
                    </div>

                    {isOpen && (
                      <div className="ms-3 space-y-1 pb-1">
                        {node.processes.length > 0 &&
                          renderProcesses(node.processes)}
                        {node.children.map((child) => {
                          const childOpen = Boolean(expanded[child.id]);
                          const childHas =
                            child.processes.length > 0 ||
                            child.children.length > 0;
                          return (
                            <div key={child.id} className="space-y-0.5">
                              <div className="flex items-center gap-0.5">
                                {childHas ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExpand(child.id)
                                    }
                                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] text-gray-400 hover:bg-navy-700"
                                  >
                                    {childOpen ? "▾" : "◂"}
                                  </button>
                                ) : (
                                  <span className="size-5 shrink-0" />
                                )}
                                <Link
                                  href={`/explanation/projects/${child.id}`}
                                  className={cx(
                                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition",
                                    isProjectActive(child.id)
                                      ? "bg-brand-500 font-medium text-ink"
                                      : "text-gray-300 hover:bg-navy-700 hover:text-white",
                                  )}
                                >
                                  <span
                                    className="size-1.5 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: cardPalette(
                                        child.color,
                                      ).accent,
                                    }}
                                  />
                                  <span className="truncate">
                                    {child.name}
                                  </span>
                                </Link>
                              </div>
                              {childOpen &&
                                child.processes.length > 0 &&
                                renderProcesses(child.processes)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeStepId && activeStepTitle && (
            <div className="mt-2 rounded-lg border border-navy-700 bg-navy-800 px-2.5 py-2">
              <p className="text-[10px] font-semibold text-gray-400">{t("exp.currentStep")}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-white">
                {activeStepTitle}
              </p>
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
