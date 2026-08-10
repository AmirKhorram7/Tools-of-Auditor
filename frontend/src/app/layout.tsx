import type { Metadata } from "next";

import { AuthProvider } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "تی‌ادیتور | پلتفرم حسابرسی داخلی",
  description: "ابزار مستندسازی فرایندها، ریسک‌ها و کنترل‌ها برای حسابرسان داخلی",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
