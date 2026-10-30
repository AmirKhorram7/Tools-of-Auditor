export type NewsLang = "en" | "fa";
export type FetchMode = "manual" | "scheduled";
export type JobStatus = "pending" | "running" | "done" | "failed";
export type RangeKey = 0 | 1 | 2 | 3;
export type DrawerMode = "cur" | 0 | 1 | "both";

export type NewsAccess = {
  allowed: boolean;
  is_fetch_admin: boolean;
  language: NewsLang;
  group: string;
};

export type NewsSource = {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  feed_url: string;
  source_type: string;
  region: string;
  category: string;
  color?: string;
  is_active: boolean;
  fetch_interval_minutes: number;
  last_fetched_at: string | null;
  last_status: string;
};

export type NewsArticle = {
  id: number;
  source: number;
  source_name: string;
  source_slug: string;
  url: string;
  original_url: string;
  canonical_url: string;
  title: string;
  summary: string;
  title_fa: string;
  summary_fa: string;
  display_title: string;
  display_summary: string;
  display_language: NewsLang;
  image_url: string;
  author: string;
  published_at: string | null;
  fetched_at: string;
  language: string;
  translation_status: string;
  tags: string[];
};

export type DetailSource = {
  id?: number;
  slug: string;
  name: string;
  color: string;
  source_type?: string;
  category?: string;
};

export type ArticleKeyPoint = {
  title: string;
  text: string;
  title_fa?: string;
  text_fa?: string;
};

export type ArticleParagraph = {
  en: string;
  fa: string;
};

export type ArticleEntity = {
  type: string;
  name: string;
};

export type RelatedArticle = {
  id: number;
  source: DetailSource;
  title: string;
  title_fa: string;
};

export type FetchTrace = {
  method: string;
  job_id: number | null;
  content_hash: string;
  fetched_at: string;
  translation_status: string;
  canonical: string;
  source_name: string;
  source_type: string;
};

export type ArticleDetail = {
  id: number;
  source: DetailSource;
  category: string;
  url: string;
  canonical_url: string;
  title: string;
  title_fa: string;
  summary: string;
  summary_fa: string;
  brief: string[];
  brief_fa: string[];
  key_points: ArticleKeyPoint[];
  paragraphs: ArticleParagraph[];
  why_it_matters: string;
  why_it_matters_fa: string;
  entities: ArticleEntity[];
  reading_minutes: number;
  published_at: string | null;
  fetched_at: string;
  translation_status: string;
  fetch_trace?: FetchTrace;
  related: RelatedArticle[];
  prev_id: number | null;
  next_id: number | null;
};

export type DetailLangMode = NewsLang | "split";

export type FetchJob = {
  id: number;
  source: number | null;
  source_name: string | null;
  requested_by_id: number | null;
  date_from: string | null;
  date_to: string | null;
  trigger: "manual" | "scheduled";
  status: JobStatus;
  found_count: number;
  new_count: number;
  skipped_count: number;
  failed_count: number;
  error_log: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type FreshnessSource = {
  id: number;
  slug: string;
  name: string;
  color: string;
  is_active: boolean;
  last_fetched_at: string | null;
  last_status: string;
  fetch_interval_minutes: number;
  fresh_within_minutes: number;
  age_minutes: number | null;
  up_to_date: boolean;
  fetch_running: boolean;
};

export type FreshnessSnapshot = {
  up_to_date: boolean;
  fetch_running: boolean;
  last_fetched_at: string | null;
  checked_at: string;
  message_key: "up_to_date" | "stale" | "running" | string;
  sources: FreshnessSource[];
};

export type PanelSettings = {
  fetch_mode: FetchMode;
  interval_hours: number;
  interval_presets: number[];
  last_scheduled_at: string | null;
  next_run_at: string | null;
  can_edit: boolean;
  updated_at: string;
  updated_by_id: number | null;
};

export type WarehouseSettings = {
  enabled: boolean;
  interval_hours: number;
  run_hour: number;
  run_minute: number;
  interval_presets: number[];
  minute_presets: number[];
  timezone: string;
  configured: boolean;
  last_synced_at: string | null;
  last_synced_id: number;
  last_sync_count: number;
  last_error: string;
  next_run_at: string | null;
};

export type WarehouseSyncResult = {
  ok: boolean;
  skipped: boolean;
  copied: number;
  reason?: string;
  last_id?: number;
  watermark?: number;
  error?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
