import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ورود به تی آدیتر",
  description:
    "ورود به تی آدیتر با شماره موبایل. کار را سر وقت نگه دارید: برنامهٔ روز، کار تیمی، صورت‌جلسه و شرح مسیر.",
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
