import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";

import { AuthProvider } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n";

import "./globals.css";

/** Farsi UI font. */
const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

/** English UI font. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://localhost";

const titleDefault =
  "تی‌ادیتور | ابزار حسابرسان داخلی و خارجی — تشریح سیستم، ریسک و کنترل";

const description =
  "تی‌ادیتور (Tauditor) پلتفرم تخصصی حسابرسان داخلی و خارجی برای تشریح سیستم، مستندسازی فرایندها، ریسک‌ها و کنترل‌ها. مناسب ممیزی ISO و تیم‌های تضمین کیفیت (QA) و کنترل کیفیت (QC).";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: titleDefault,
    template: "%s | تی‌ادیتور",
  },
  description,
  applicationName: "تی‌ادیتور",
  keywords: [
    "تی‌ادیتور",
    "تی ادیتور",
    "Tauditor",
    "حسابرس داخلی",
    "حسابرس خارجی",
    "حسابرسی داخلی",
    "حسابرسی خارجی",
    "ابزار حسابرسی",
    "تشریح سیستم",
    "ریسک و کنترل",
    "مستندسازی فرایند",
    "ممیزی ISO",
    "تضمین کیفیت",
    "کنترل کیفیت",
    "QA",
    "QC",
  ],
  authors: [{ name: "تی‌ادیتور" }],
  creator: "تی‌ادیتور",
  publisher: "تی‌ادیتور",
  category: "business software",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: siteUrl,
    siteName: "تی‌ادیتور",
    title: "تی‌ادیتور | ابزار حسابرسان داخلی و خارجی",
    description:
      "تشریح سیستم و مستندسازی فرایند، ریسک و کنترل — برای حسابرسان داخلی و خارجی؛ قابل استفاده در ممیزی ISO و تیم‌های QA/QC.",
  },
  twitter: {
    card: "summary",
    title: "تی‌ادیتور | ابزار حسابرسان داخلی و خارجی",
    description:
      "پلتفرم Tauditor برای تشریح سیستم، ریسک و کنترل — حسابرسی داخلی و خارجی.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${inter.variable}`}
    >
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var l=localStorage.getItem("ta_locale");if(l==="en"){document.documentElement.lang="en";document.documentElement.dir="ltr";}}catch(e){}`,
          }}
        />
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
