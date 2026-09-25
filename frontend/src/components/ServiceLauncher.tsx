"use client";

import Link from "next/link";

import { LauncherMark, ServiceGlyph } from "@/components/ServiceIcons";
import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { APP_SERVICES } from "@/lib/services";

export default function ServiceLauncher({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("nav.services")}
        aria-expanded={open}
        onClick={onToggle}
        className={cx(
          "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition hover:opacity-90",
          open ? "ring-1 ring-brand-500" : "",
        )}
      >
        <LauncherMark className="size-9" />
      </button>
      {open ? (
        <div className="absolute end-0 top-full z-50 mt-2 w-[20.5rem] rounded-[1.75rem] border border-gray-200 bg-white px-3 pb-3 pt-3 shadow-[0_16px_40px_rgba(19,26,34,0.2)] max-md:fixed max-md:inset-x-2.5 max-md:top-[calc(3.6rem+env(safe-area-inset-top))] max-md:mt-0 max-md:w-auto">
          <p className="mb-3 px-1 text-sm font-medium text-gray-500">{t("nav.services")}</p>
          <div className="grid grid-cols-3 gap-x-1 gap-y-1">
            {APP_SERVICES.map((service) => {
              const inner = (
                <>
                  <ServiceGlyph service={service} />
                  <span className="mt-1.5 line-clamp-2 text-center text-[11px] font-medium leading-4 text-ink">
                    {t(service.labelKey)}
                  </span>
                </>
              );
              if (!service.available) {
                return (
                  <span
                    key={service.key}
                    className="flex cursor-not-allowed flex-col items-center rounded-2xl px-1 py-2.5 opacity-45"
                  >
                    {inner}
                  </span>
                );
              }
              return (
                <Link
                  key={service.key}
                  href={service.href}
                  className="flex flex-col items-center rounded-2xl px-1 py-2.5 transition hover:bg-gray-50"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
