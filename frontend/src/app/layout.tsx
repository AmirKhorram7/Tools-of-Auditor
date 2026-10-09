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
  "تی آدیتر | کار را سر وقت نگه دارید — برای هر فرد، تیم و شرکت";

const description =
  "تی آدیتر (Tauditor) به هر فرد، تیم کوچک و شرکت کمک می‌کند کار را سر وقت نگه دارد، جریان کار را اداره کند، قدم‌ها را بنویسد، و برای هر مسیر ریسک و کنترل بهتری بگذارد. دفتر روزانه، مدیریت کار، صورت‌جلسه، شرح مسیر و یادآوری.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "تی آدیتر",
      alternateName: [
        "تی‌آدیتر",
        "تیادیتر",
        "تی آدیتر",
        "تی‌ادیتور",
        "تی ادیتور",
        "Tauditor",
        "tauditor",
      ],
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "fa-IR",
      description,
      featureList: [
        "مدیریت کار",
        "مدیریت وظیفه",
        "صورت جلسه",
        "صورت‌جلسه",
        "تشریح سیستم",
        "مستندسازی فرایند",
        "ریسک و کنترل",
        "دعوت با شماره موبایل",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "IRR",
      },
    },
    {
      "@type": "WebSite",
      name: "تی آدیتر",
      alternateName: "Tauditor",
      url: siteUrl,
      inLanguage: "fa-IR",
      description,
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: titleDefault,
    template: "%s | تی آدیتر",
  },
  description,
  applicationName: "تی آدیتر",
  keywords: [
    "تی آدیتر",
    "تی‌آدیتر",
    "تیادیتر",
    "تی آدیتر Tauditor",
    "تی‌ادیتور",
    "تی ادیتور",
    "Tauditor",
    "tauditor",
    "مدیریت کار",
    "مدیریت وظیفه",
    "ارجاع کار",
    "پیگیری کار",
    "کار تیمی",
    "نرم افزار مدیریت کار",
    "نرم افزار تسک",
    "موعد کار",
    "کار باز",
    "کار عقب افتاده",
    "صورت جلسه",
    "صورتجلسه",
    "صورت‌جلسه",
    "نرم افزار صورت جلسه",
    "دستور جلسه",
    "مصوبات جلسه",
    "بند جلسه",
    "پیگیری مصوبات",
    "جلسه سازمانی",
    "تشریح سیستم",
    "مستندسازی فرایند",
    "مستندسازی فرآیند",
    "شرح فرآیند",
    "دانش سازمانی",
    "ریسک و کنترل",
    "کنترل داخلی",
    "حسابرس داخلی",
    "حسابرس خارجی",
    "حسابرسی داخلی",
    "حسابرسی خارجی",
    "ابزار حسابرسی",
    "نرم افزار حسابرسی",
    "ممیزی ISO",
    "ممیزی ایزو",
    "تضمین کیفیت",
    "کنترل کیفیت",
    "QA",
    "QC",
    "دعوت با شماره",
    "نرم افزار فارسی حسابرسی",
    "پلتفرم کار تیمی فارسی",
  ],
  authors: [{ name: "تی آدیتر" }],
  creator: "تی آدیتر",
  publisher: "تی آدیتر",
  category: "business software",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: siteUrl,
    siteName: "تی آدیتر",
    title: "تی آدیتر | کار را سر وقت نگه دارید",
    description:
      "برای هر فرد، تیم و شرکت: برنامهٔ روز، کار تیمی، صورت‌جلسه، شرح مسیر و یادآوری. کار سر وقت می‌ماند و قدم‌ها نوشته می‌شوند.",
  },
  twitter: {
    card: "summary",
    title: "تی آدیتر | کار را سر وقت نگه دارید",
    description:
      "برای هر فرد و تیم: کار سر وقت، جریان کار، صورت‌جلسه، و مسیر با ریسک و کنترل.",
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
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
