import type { Paginated } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

/** Origin of the Django server, used to resolve /media/... paths. */
export const API_ORIGIN = API_BASE.replace(/\/api\/v\d+\/?$/, "");

/**
 * DRF returns absolute URLs for uploaded files when the request is in the
 * serializer context, but falls back to a relative `/media/...` path otherwise.
 * Resolve both shapes to something an <img> tag can actually load.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

const ACCESS_KEY = "ta_access";
const REFRESH_KEY = "ta_refresh";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const tokens = {
  get access() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  save(access: string, refresh: string) {
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  saveAccess(access: string) {
    window.localStorage.setItem(ACCESS_KEY, access);
  },
  clear() {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/** Turns DRF error payloads into a single readable Farsi-friendly message. */
function extractMessage(status: number, data: unknown): string {
  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["message", "detail", "error"]) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    const firstKey = Object.keys(obj)[0];
    if (firstKey) {
      const value = obj[firstKey];
      if (Array.isArray(value) && value.length) return String(value[0]);
      if (typeof value === "string") return value;
    }
  }

  if (status === 401) return "نشست شما منقضی شده است. دوباره وارد شوید.";
  if (status === 429) return "تعداد درخواست‌ها زیاد است. کمی صبر کنید.";
  return "خطایی رخ داد. دوباره تلاش کنید.";
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;

  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) return false;

  const data = (await parseBody(response)) as {
    access?: string;
    refresh?: string;
  } | null;

  if (!data?.access) return false;
  if (data.refresh) {
    tokens.save(data.access, data.refresh);
  } else {
    tokens.saveAccess(data.access);
  }
  return true;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /** Pass a FormData body for file uploads. */
  formData?: FormData;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = true, formData } = options;

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!formData && body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (auth) {
      const access = tokens.access;
      if (access) headers.Authorization = `Bearer ${access}`;
    }

    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  };

  let response = await send();

  if (response.status === 401 && auth && tokens.refresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else {
      tokens.clear();
    }
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(response.status, data), data);
  }

  return data as T;
}

/** DRF pagination is enabled globally, so list endpoints return `results`. */
export function listResults<T>(data: Paginated<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

export async function apiList<T>(path: string): Promise<T[]> {
  const data = await apiFetch<Paginated<T> | T[]>(path);
  return listResults(data);
}
