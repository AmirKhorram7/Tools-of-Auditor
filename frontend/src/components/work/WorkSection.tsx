"use client";

import { useEffect, useState, type ReactNode } from "react";

const KEY = "ta-work-fold-";

export default function WorkSection({
  id,
  title,
  hint,
  count,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
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
    <section className="rounded-xl border border-black/[0.06] bg-white">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">{title}</span>
            {typeof count === "number" && (
              <span className="rounded-full bg-navy-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </span>
          {hint && !open ? (
            <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-gray-500">
          {open ? "پنهان" : "نمایش"}
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
      {open && <div className="border-t border-black/[0.05] px-3 py-3">{children}</div>}
    </section>
  );
}
