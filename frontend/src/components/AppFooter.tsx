"use client";

import Link from "next/link";

import SocialFooter from "@/components/SocialFooter";
import { useI18n } from "@/lib/i18n";

const SERVICES = [
  { href: "/work", labelKey: "nav.work" as const },
  { href: "/minutes", labelKey: "nav.minutes" as const },
  { href: "/explanation", labelKey: "nav.explanation" as const },
  { href: "/contact", labelKey: "nav.contact" as const },
];

export default function AppFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 bg-navy-900 text-white">
      <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-ink">
              T
            </span>
            <span className="text-base font-bold">{t("brand.name")}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-6 text-gray-300">{t("footer.blurb")}</p>
        </div>

        <div>
          <h2 className="text-sm font-bold text-brand-400">{t("footer.services")}</h2>
          <ul className="mt-3 space-y-2">
            {SERVICES.map((service) => (
              <li key={service.href}>
                <Link
                  href={service.href}
                  className="text-sm text-gray-200 transition hover:text-brand-400"
                >
                  {t(service.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-brand-400">{t("footer.contact")}</h2>
          <SocialFooter tone="dark" className="border-0 pt-3" />
        </div>
      </div>
      <div className="border-t border-white/10 py-3 text-center text-xs text-gray-400">
        {t("footer.copy", { year: String(year) })}
      </div>
    </footer>
  );
}
