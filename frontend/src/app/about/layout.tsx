import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "درباره ما",
  description:
    "امیرحسین خرم‌نیاکی، سازنده تی آدیتر. برنامه‌ریزی، مستندسازی و تحلیل کار روزانه در یک جا.",
  robots: { index: true, follow: true },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
