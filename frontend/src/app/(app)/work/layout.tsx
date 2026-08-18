"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/components/ui";
import WorkSidePanel from "@/components/work/WorkSidePanel";

const MOBILE_TABS = [
  { href: "/work", label: "پیشخوان", exact: true },
  { href: "/work/inbox", label: "اعلان‌ها", exact: false },
];

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex items-start gap-4" dir="ltr">
      <div className="min-w-0 flex-1 pb-16 md:pb-0" dir="rtl">
        {children}
      </div>
      <WorkSidePanel />

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-200 bg-white md:hidden">
        {MOBILE_TABS.map((tab) => {
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
          تشریح سیستم
        </Link>
      </nav>
    </div>
  );
}
