"use client";

import Link from "next/link";

import BackButton from "@/components/BackButton";

export default function WorkBreadcrumb({
  items,
  fallbackHref,
}: {
  items: Array<{ href?: string; label: string }>;
  fallbackHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <BackButton fallbackHref={fallbackHref} />
      <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-navy-900 px-3 py-2 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <span className="text-white/35">/</span>}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="truncate font-semibold text-white/80 hover:text-brand-400"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-bold text-brand-400">{item.label}</span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
