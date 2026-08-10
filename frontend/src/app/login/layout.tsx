import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ورود حسابرسان",
  description:
    "ورود به تی‌ادیتور با شماره موبایل — پلتفرم حسابرسان داخلی و خارجی برای تشریح سیستم، ریسک و کنترل.",
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
