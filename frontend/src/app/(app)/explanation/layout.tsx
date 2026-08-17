"use client";

import ExplanationSidePanel from "@/components/ExplanationSidePanel";

/**
 * Keep main content RTL, but force the tools panel onto the physical right
 * (LTR row: content | panel) so it never flips to the left in Persian layout.
 */
export default function ExplanationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4" dir="ltr">
      <div className="min-w-0 flex-1" dir="rtl">
        {children}
      </div>
      <ExplanationSidePanel />
    </div>
  );
}
