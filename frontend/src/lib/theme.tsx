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

import { useI18n } from "@/lib/i18n";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ta_theme";
const COOKIE_KEY = "ta_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
    document.cookie = `${COOKIE_KEY}=${theme};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
        return;
      }
    } catch {
      /* ignore */
    }
    applyTheme(theme);
    // Sync from storage once on mount; theme changes apply below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}

/** Moon / sun control beside EN–FA. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? t("theme.toLight") : t("theme.toDark")}
      aria-label={dark ? t("theme.toLight") : t("theme.toDark")}
      className={`flex size-9 items-center justify-center rounded-lg bg-navy-800 text-brand-400 transition hover:bg-navy-700 hover:text-brand-300 ${
        dark ? "ring-1 ring-brand-500/80" : ""
      }`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <path
        d="M20.2 14.6A8.2 8.2 0 0 1 9.4 3.8 8.4 8.4 0 1 0 20.2 14.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.2v1.8M12 19v1.8M4.7 4.7l1.3 1.3M18 18l1.3 1.3M3.2 12h1.8M19 12h1.8M4.7 19.3 6 18M18 6l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
