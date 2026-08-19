"use client";

import ExplanationSidePanel from "@/components/ExplanationSidePanel";
import { useI18n } from "@/lib/i18n";

/**
 * Pin the tools panel to the physical right. Page content follows the
 * active language direction.
 */
export default function ExplanationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dir } = useI18n();
  return (
    <div className="flex items-start gap-2" dir="ltr">
      <div className="min-w-0 flex-1" dir={dir}>
        {children}
      </div>
      <ExplanationSidePanel />
    </div>
  );
}
