import { apiFetch } from "@/lib/api";

import type {
  ArticleDetail,
  FetchJob,
  FreshnessSnapshot,
  NewsAccess,
  NewsArticle,
  NewsLang,
  NewsSource,
  Paginated,
  PanelSettings,
  WarehouseSettings,
  WarehouseSyncResult,
} from "./types";

export function newsAccess() {
  return apiFetch<NewsAccess>("/news/access/");
}

export function patchNewsLanguage(language: NewsLang) {
  return apiFetch<{ language: NewsLang }>("/news/settings/", {
    method: "PATCH",
    body: { language },
  });
}

export function getPanel() {
  return apiFetch<PanelSettings>("/news/panel/");
}

export function patchPanel(body: { fetch_mode?: "manual" | "scheduled"; interval_hours?: number }) {
  return apiFetch<PanelSettings>("/news/panel/", { method: "PATCH", body });
}

export function getWarehouse() {
  return apiFetch<WarehouseSettings>("/news/warehouse/");
}

export function patchWarehouse(body: {
  enabled?: boolean;
  interval_hours?: number;
  run_hour?: number;
  run_minute?: number;
}) {
  return apiFetch<WarehouseSettings>("/news/warehouse/", { method: "PATCH", body });
}

export function syncWarehouse() {
  return apiFetch<WarehouseSyncResult>("/news/warehouse/sync/", { method: "POST", body: {} });
}

async function collectPages<T>(path: string, extra: Record<string, string> = {}) {
  const search = new URLSearchParams({ page_size: "50", ...extra });
  const first = await apiFetch<Paginated<T> | T[]>(`${path}?${search.toString()}`);
  if (Array.isArray(first)) return first;
  const rows = [...(first.results ?? [])];
  const pages = Math.ceil((first.count || 0) / 50);
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => {
        const next = new URLSearchParams(search);
        next.set("page", String(i + 2));
        return apiFetch<Paginated<T>>(`${path}?${next.toString()}`);
      }),
    );
    rest.forEach((page) => rows.push(...(page.results ?? [])));
  }
  return rows;
}

export function listSources(all = false) {
  return collectPages<NewsSource>("/news/sources/", all ? { all: "1" } : {});
}

export async function listArticles(opts: {
  q?: string;
  slugs?: string[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}) {
  const search = new URLSearchParams();
  search.set("page_size", "50");
  search.set("page", String(opts.page ?? 1));
  if (opts.q) search.set("q", opts.q);
  if (opts.dateFrom) search.set("date_from", opts.dateFrom);
  if (opts.dateTo) search.set("date_to", opts.dateTo);
  for (const slug of opts.slugs ?? []) search.append("source", slug);
  return apiFetch<Paginated<NewsArticle>>(`/news/articles/?${search.toString()}`);
}

export function getArticle(id: number) {
  return apiFetch<NewsArticle>(`/news/articles/${id}/`);
}

export function getArticleDetail(id: number, ids?: number[]) {
  const search = new URLSearchParams();
  if (ids?.length) search.set("ids", ids.join(","));
  const q = search.toString();
  return apiFetch<ArticleDetail>(`/news/articles/${id}/${q ? `?${q}` : ""}`);
}

export async function listAllArticles(opts: {
  q?: string;
  slugs?: string[];
  dateFrom?: string;
  dateTo?: string;
}) {
  const first = await listArticles({ ...opts, page: 1 });
  const rows = [...(first.results ?? [])];
  const pages = Math.min(4, Math.ceil((first.count || 0) / 50));
  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) => listArticles({ ...opts, page: i + 2 })),
    );
    rest.forEach((page) => rows.push(...(page.results ?? [])));
  }
  return { count: first.count, results: rows };
}

export function getFreshness(opts?: { sourceId?: number | null; all?: boolean }) {
  const search = new URLSearchParams();
  if (opts?.sourceId) search.set("source_id", String(opts.sourceId));
  if (opts?.all) search.set("all", "1");
  const q = search.toString();
  return apiFetch<FreshnessSnapshot>(`/news/freshness/${q ? `?${q}` : ""}`);
}

export function startFetch(body: {
  source_id?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  force?: boolean;
}) {
  return apiFetch<FetchJob>("/news/jobs/", { method: "POST", body });
}

export function getJob(id: number) {
  return apiFetch<FetchJob>(`/news/jobs/${id}/`);
}

export async function listJobs() {
  const data = await apiFetch<Paginated<FetchJob> | FetchJob[]>("/news/jobs/?page_size=8");
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}
