"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { newsAccess, patchNewsLanguage } from "./api";
import type { NewsAccess, NewsLang } from "./types";

type Theme = "dark" | "light";

type SignalState = {
  ready: boolean;
  access: NewsAccess | null;
  lang: NewsLang;
  theme: Theme;
  adminOpen: boolean;
  setLang: (lang: NewsLang) => void;
  toggleTheme: () => void;
  setAdminOpen: (open: boolean) => void;
};

const Ctx = createContext<SignalState | null>(null);
const THEME_KEY = "ta_signal_theme";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {
    /* ignore */
  }
  return "dark";
}

export function SignalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [access, setAccess] = useState<NewsAccess | null>(null);
  const [lang, setLangState] = useState<NewsLang>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    let cancelled = false;
    newsAccess()
      .then((row) => {
        if (cancelled) return;
        setAccess(row);
        setLangState(row.language === "fa" ? "fa" : "en");
      })
      .catch(() => {
        if (!cancelled) setAccess({ allowed: false, is_fetch_admin: false, language: "en", group: "" });
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const prevLang = root.lang;
    const prevDir = root.getAttribute("dir") || "";
    root.classList.add("signal-active");
    return () => {
      root.classList.remove("signal-active");
      root.removeAttribute("data-signal-theme");
      root.lang = prevLang;
      if (prevDir) root.setAttribute("dir", prevDir);
      else root.removeAttribute("dir");
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-signal-theme", theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.setAttribute("dir", lang === "fa" ? "rtl" : "ltr");
  }, [lang]);

  const setLang = useCallback((next: NewsLang) => {
    setLangState(next);
    patchNewsLanguage(next).catch(() => undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo<SignalState>(
    () => ({
      ready,
      access,
      lang,
      theme,
      adminOpen,
      setLang,
      toggleTheme,
      setAdminOpen,
    }),
    [ready, access, lang, theme, adminOpen, setLang, toggleTheme],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSignal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSignal must be inside SignalProvider");
  return ctx;
}
