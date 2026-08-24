"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function WorkPhotoCard({
  href,
  imageSrc,
  badge,
  className,
  children,
}: {
  href: string;
  imageSrc: string;
  badge?: string;
  className?: string;
  children: ReactNode;
}) {
  const { dir } = useI18n();

  return (
    <Link
      href={href}
      dir="ltr"
      className={cx(
        "group flex h-[6.75rem] overflow-hidden rounded-xl border border-black/[0.05] bg-white shadow-[0_1px_3px_rgba(20,35,58,0.06)] transition hover:border-navy-400",
        className,
      )}
    >
      <div className="relative w-[8.5rem] shrink-0 bg-[#1A2B49] sm:w-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-[#14233A]/35" />
        {badge ? (
          <span className="absolute start-1.5 top-1.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-navy-800">
            {badge}
          </span>
        ) : null}
      </div>
      <div dir={dir} className="flex min-w-0 flex-1 flex-col justify-center p-2.5">
        {children}
      </div>
    </Link>
  );
}
