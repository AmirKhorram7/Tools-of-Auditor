"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { cx } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import type { Process, ProcessStepDetail, Project } from "@/lib/types";

const STORAGE_KEY = "ta_explanation_panel_open";

type TreeNode = {
  project: Project;
  processes: Process[];
  children: TreeNode[];
};

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
  const routeId = params.id ? Number(params.id) : NaN;

  const [open, setOpen] = useState(true);
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<number | null>(null);
  const [activeStepId, setActiveStepId] = useState<number | null>(null);
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
      setActiveProcessId(step.process);
      const process = await apiFetch<Process>(`/processes/${step.process}/`);
      setActiveProjectId(process.project);
    }
  }, [pathname, routeId]);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      await resolveContext();
      const rootProjects = await apiList<Project>("/projects/?roots_only=true");
      const nodes = await Promise.all(
        rootProjects.map(async (project) => {
          const [children, processes] = await Promise.all([
            apiList<Project>(`/projects/?parent=${project.id}`),
            apiList<Process>(`/processes/?project=${project.id}`),
          ]);
          const childNodes = await Promise.all(
            children.map(async (child) => {
              const childProcesses = await apiList<Process>(
                `/processes/?project=${child.id}`,
              );
              return {
                project: child,
                processes: childProcesses,
                children: [] as TreeNode[],
              };
            }),
          );
          return {
            project,
            processes,
            children: childNodes,
          };
        }),
      );
      setRoots(nodes);
    } catch {
      setRoots([]);
    } finally {
      setLoading(false);
    }
  }, [resolveContext]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // Auto-expand the branch that contains the current page.
  useEffect(() => {
    if (!activeProjectId && !activeProcessId) return;
    setExpanded((current) => {
      const next = { ...current };
      for (const node of roots) {
        const hitRoot =
          node.project.id === activeProjectId ||
          node.processes.some((p) => p.id === activeProcessId) ||
          node.children.some(
            (child) =>
              child.project.id === activeProjectId ||
              child.processes.some((p) => p.id === activeProcessId),
          );
        if (hitRoot) next[node.project.id] = true;
        for (const child of node.children) {
          if (
            child.project.id === activeProjectId ||
            child.processes.some((p) => p.id === activeProcessId)
          ) {
            next[child.project.id] = true;
            next[node.project.id] = true;
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

  const renderProcesses = (processes: Process[]) => (
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
        className="sticky top-28 z-30 flex h-[calc(100vh-8rem)] w-10 shrink-0 flex-col items-center gap-3 rounded-xl bg-navy-900 py-4 text-white shadow-md transition hover:bg-navy-800"
        title="نمایش پنل ابزارها"
        dir="rtl"
      >
        <span className="text-sm leading-none">‹</span>
        <span
          className="text-[11px] font-medium tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          ابزارها
        </span>
      </button>
    );
  }

  return (
    <aside
      className="sticky top-28 z-30 flex h-[calc(100vh-8rem)] w-56 shrink-0 flex-col overflow-hidden rounded-xl bg-navy-900 text-white shadow-md"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-navy-700 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-white">ابزارها</p>
          <p className="text-[11px] text-gray-400">تی‌ادیتور</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md px-2 py-1 text-xs text-gray-300 transition hover:bg-navy-700 hover:text-white"
          title="پنهان کردن پنل"
        >
          پنهان ›
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        {/* Tools list (Stripe-style primary nav) */}
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            سرویس‌ها
          </p>
          <Link
            href="/explanation"
            className={cx(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              pathname.startsWith("/explanation")
                ? "bg-navy-700 font-medium text-white"
                : "text-gray-200 hover:bg-navy-800",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-500 text-[11px] font-bold text-ink">
              ت
            </span>
            <span className="min-w-0 flex-1">تشریح سیستم</span>
          </Link>
          <span className="mt-1 flex cursor-not-allowed items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-500 opacity-70">
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px]">
              ب
            </span>
            برنامه حسابرسی
            <span className="ms-auto text-[10px]">به‌زودی</span>
          </span>
        </section>

        {/* Tree under the active tool */}
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            درخت پروژه
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
            همه پروژه‌ها
          </Link>

          {loading ? (
            <p className="px-2 py-3 text-xs text-gray-500">در حال بارگذاری...</p>
          ) : roots.length === 0 ? (
            <p className="px-2 py-3 text-xs text-gray-500">پروژه‌ای نیست.</p>
          ) : (
            <div className="space-y-1">
              {roots.map((node) => {
                const isOpen = Boolean(expanded[node.project.id]);
                const hasKids =
                  node.processes.length > 0 || node.children.length > 0;

                return (
                  <div key={node.project.id} className="space-y-0.5">
                    <div className="flex items-center gap-0.5">
                      {hasKids ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(node.project.id)}
                          className="flex size-6 shrink-0 items-center justify-center rounded text-xs text-gray-400 hover:bg-navy-700 hover:text-white"
                          aria-label={isOpen ? "بستن" : "باز کردن"}
                        >
                          {isOpen ? "▾" : "◂"}
                        </button>
                      ) : (
                        <span className="size-6 shrink-0" />
                      )}
                      <Link
                        href={`/explanation/projects/${node.project.id}`}
                        className={cx(
                          "min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm transition",
                          isProjectActive(node.project.id)
                            ? "bg-brand-500 font-semibold text-ink"
                            : "text-gray-100 hover:bg-navy-700",
                        )}
                      >
                        {node.project.name}
                      </Link>
                    </div>

                    {isOpen && (
                      <div className="ms-3 space-y-1 pb-1">
                        {node.processes.length > 0 &&
                          renderProcesses(node.processes)}
                        {node.children.map((child) => {
                          const childOpen = Boolean(expanded[child.project.id]);
                          const childHas =
                            child.processes.length > 0 ||
                            child.children.length > 0;
                          return (
                            <div key={child.project.id} className="space-y-0.5">
                              <div className="flex items-center gap-0.5">
                                {childHas ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleExpand(child.project.id)
                                    }
                                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] text-gray-400 hover:bg-navy-700"
                                  >
                                    {childOpen ? "▾" : "◂"}
                                  </button>
                                ) : (
                                  <span className="size-5 shrink-0" />
                                )}
                                <Link
                                  href={`/explanation/projects/${child.project.id}`}
                                  className={cx(
                                    "min-w-0 flex-1 truncate rounded-md px-2 py-1 text-xs transition",
                                    isProjectActive(child.project.id)
                                      ? "bg-brand-500 font-medium text-ink"
                                      : "text-gray-300 hover:bg-navy-700 hover:text-white",
                                  )}
                                >
                                  {child.project.name}
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

          {activeStepId && (
            <p className="px-2.5 pt-2 text-[11px] text-gray-500">
              گام فعلی #{activeStepId}
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
