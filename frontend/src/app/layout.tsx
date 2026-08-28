import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Vazirmatn } from "next/font/google";

import { AuthProvider } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n";
import { ThemeProvider, type Theme } from "@/lib/theme";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("ta_locale")?.value;
  const initialLocale = raw === "en" ? "en" : "fa";
  const rawTheme = cookieStore.get("ta_theme")?.value;
  const initialTheme: Theme = rawTheme === "dark" ? "dark" : "light";

  return (
    <html
      lang={initialLocale}
      dir={initialLocale === "fa" ? "rtl" : "ltr"}
      className={`${vazirmatn.variable} ${inter.variable}${initialTheme === "dark" ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement;var l=localStorage.getItem("ta_locale");if(l==="en"||l==="fa"){d.lang=l==="en"?"en":"fa";d.dir=l==="en"?"ltr":"rtl";document.cookie="ta_locale="+l+";path=/;max-age=31536000;SameSite=Lax";}var th=localStorage.getItem("ta_theme");if(th!=="light"&&th!=="dark"){th=(document.cookie.match(/(?:^|; )ta_theme=([^;]*)/)||[])[1];}if(th==="dark"||th==="light"){document.cookie="ta_theme="+th+";path=/;max-age=31536000;SameSite=Lax";d.style.colorScheme=th;if(th==="dark")d.classList.add("dark");else d.classList.remove("dark");}}catch(e){}`,
          }}
        />
        <LocaleProvider initialLocale={initialLocale}>
          <ThemeProvider initialTheme={initialTheme}>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
