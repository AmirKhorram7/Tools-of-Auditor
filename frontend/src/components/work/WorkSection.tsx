"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";

const KEY = "ta-work-fold-";

export default function WorkSection({
  id,
  title,
  hint,
  count,
  icon,
  actions,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  count?: number;
  icon?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = window.localStorage.getItem(`${KEY}${id}`);
    if (stored === "0") setOpen(false);
    if (stored === "1") setOpen(true);
  }, [id]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem(`${KEY}${id}`, next ? "1" : "0");
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-navy-900/10 bg-white">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-navy-900/[0.03]"
          aria-expanded={open}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              {icon}
              <span className="text-sm font-bold text-ink">{title}</span>
              {typeof count === "number" && (
                <span className="rounded-full bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </span>
            {hint && !open ? (
              <span className="mt-0.5 block truncate text-[11px] text-gray-400">{hint}</span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500">
            {open ? t("work.hide") : t("work.show")}
            <svg
              viewBox="0 0 20 20"
              className={`size-4 transition ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path
                d="M5 8l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
        {actions ? <div className="flex items-center pe-3">{actions}</div> : null}
      </div>
      {open ? (
        <div className="border-t border-navy-900/[0.06] px-4 py-3">{children}</div>
      ) : null}
    </section>
  );
}
