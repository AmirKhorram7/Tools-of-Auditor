"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";
import WorkSidePanel from "@/components/work/WorkSidePanel";
import { useI18n } from "@/lib/i18n";

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const mobileTabs = [
    { href: "/work", label: t("nav.workHomeShort"), exact: true },
    { href: "/work/inbox", label: t("nav.inbox"), exact: false },
  ];

  return (
    <div className="flex items-start gap-2.5 max-md:gap-0" dir="ltr">
      <div className="min-w-0 flex-1 pb-16 max-md:pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0" dir={dir}>
        {children}
      </div>
      <WorkSidePanel />

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {mobileTabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "flex-1 py-3 text-center text-sm",
                active ? "font-semibold text-navy-900" : "text-gray-500",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
        <Link
          href="/explanation"
          className="flex-1 py-3 text-center text-sm text-gray-500"
        >
          {t("nav.explanation")}
        </Link>
      </nav>
    </div>
  );
}
