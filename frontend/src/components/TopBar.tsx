"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar, cx } from "@/components/ui";
import { displayName, useAuth } from "@/lib/auth";
import { LanguageSwitch, useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/lib/theme";

export default function TopBar() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const [servicesOpen, setServicesOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const services = [
    {
      key: "work",
      label: t("nav.work"),
      description: t("nav.workDesc"),
      href: "/work",
      available: true,
    },
    {
      key: "system-explanation",
      label: t("nav.explanation"),
      description: t("nav.explanationDesc"),
      href: "/explanation",
      available: true,
    },
    {
      key: "audit-plan",
      label: t("nav.auditPlan"),
      description: t("nav.soon"),
      href: "#",
      available: false,
    },
    {
      key: "working-papers",
      label: t("nav.workingPapers"),
      description: t("nav.soon"),
      href: "#",
      available: false,
    },
  ];

  useEffect(() => {
    const onClickOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setServicesOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, []);

  useEffect(() => {
    setServicesOpen(false);
    setUserOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={cx(
        "rounded px-3 py-1.5 text-sm whitespace-nowrap transition max-md:px-2.5 max-md:py-2",
        active
          ? "bg-navy-700 font-medium text-white"
          : "text-gray-200 hover:bg-navy-700 hover:text-white",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header ref={containerRef} className="sticky top-0 z-40">
      {/* Primary bar — Amazon dark navy */}
      <div className="bg-navy-900 text-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between gap-2 px-2.5 md:gap-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 transition hover:bg-navy-700"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-ink">
                T
              </span>
              <span className="truncate text-base font-bold text-white max-[360px]:hidden">{t("brand.name")}</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <ThemeToggle />
            <LanguageSwitch />
            <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserOpen((open) => !open);
                setServicesOpen(false);
              }}
              className={cx(
                "flex items-center gap-2 rounded px-2 py-1.5 transition",
                userOpen ? "bg-navy-700" : "hover:bg-navy-700",
              )}
            >
              <Avatar
                src={profile?.profile_image}
                name={displayName(profile)}
                size={30}
              />
              <span className="hidden text-sm text-gray-100 md:block">
                {displayName(profile)}
              </span>
              <span className="text-[10px] text-brand-400">▾</span>
            </button>

            {userOpen && (
              <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg max-md:end-0">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <Avatar
                    src={profile?.profile_image}
                    name={displayName(profile)}
                    size={36}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {displayName(profile)}
                    </p>
                    <p dir="ltr" className="text-xs text-gray-500">
                      {profile?.phone_number ?? ""}
                    </p>
                  </div>
                </div>
                <div className="my-1 h-px bg-surface" />
                <Link
                  href="/profile"
                  className="block rounded-lg px-3 py-2 text-sm text-ink transition hover:bg-surface"
                >
                  {t("nav.myProfile")}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full rounded-lg px-3 py-2 text-start text-sm text-red-600 transition hover:bg-red-50"
                >
                  {t("nav.signOut")}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary bar — Amazon nav navy */}
      <div className="bg-navy-800">
        <nav className="mx-auto flex h-11 max-w-screen-2xl items-center gap-1 overflow-x-auto px-2.5 md:h-10 md:overflow-visible">
          {navLink("/dashboard", t("nav.home"), pathname === "/dashboard")}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setServicesOpen((open) => !open);
                setUserOpen(false);
              }}
              className={cx(
                "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm whitespace-nowrap transition max-md:px-2.5 max-md:py-2",
                servicesOpen
                  ? "bg-navy-700 font-medium text-white"
                  : "text-gray-200 hover:bg-navy-700 hover:text-white",
              )}
            >
              {t("nav.services")}
              <span className="text-[10px] text-brand-400">▾</span>
            </button>
            {servicesOpen && (
              <div className="absolute start-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg max-md:fixed max-md:inset-x-2.5 max-md:top-[calc(5.75rem+env(safe-area-inset-top))] max-md:mt-0 max-md:w-auto">
                {services.map((service) =>
                  service.available ? (
                    <Link
                      key={service.key}
                      href={service.href}
                      className="block rounded-lg px-3 py-2.5 transition hover:bg-surface"
                    >
                      <span className="block text-sm font-medium text-ink">
                        {service.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {service.description}
                      </span>
                    </Link>
                  ) : (
                    <span
                      key={service.key}
                      className="block cursor-not-allowed rounded-lg px-3 py-2.5 opacity-55"
                    >
                      <span className="block text-sm font-medium text-ink">
                        {service.label}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {service.description}
                      </span>
                    </span>
                  ),
                )}
              </div>
            )}
          </div>
          {navLink("/work", t("nav.work"), pathname.startsWith("/work"))}
          {navLink(
            "/explanation",
            t("nav.explanation"),
            pathname.startsWith("/explanation"),
          )}
          {navLink("/contact", t("nav.contact"), pathname.startsWith("/contact"))}
          {navLink("/profile", t("nav.profile"), pathname === "/profile")}
        </nav>
      </div>
    </header>
  );
}
