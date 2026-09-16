import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ورود به تی آدیتر",
  description:
    "ورود به تی آدیتر (Tauditor) با شماره موبایل. مدیریت کار و وظیفه، صورت جلسه و صورت‌جلسه، تشریح سیستم و مستندسازی فرایند برای حسابرسان داخلی و خارجی.",
  keywords: [
    "ورود تی آدیتر",
    "تی آدیتر",
    "تی‌آدیتر",
    "Tauditor login",
    "صورت جلسه آنلاین",
    "نرم افزار مدیریت کار",
    "تشریح سیستم",
  ],
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
