"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar, cx } from "@/components/ui";
import { displayName, useAuth } from "@/lib/auth";

/** Services shown in the top bar picker. Only the first one ships in the MVP. */
const SERVICES = [
  {
    key: "system-explanation",
    label: "تشریح سیستم",
    description: "مستندسازی فرایند، ریسک و کنترل",
    href: "/explanation",
    available: true,
  },
  {
    key: "audit-plan",
    label: "برنامه حسابرسی",
    description: "به‌زودی",
    href: "#",
    available: false,
  },
  {
    key: "working-papers",
    label: "کاربرگ‌ها",
    description: "به‌زودی",
    href: "#",
    available: false,
  },
];

export default function TopBar() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [servicesOpen, setServicesOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setServicesOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
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
        "rounded px-3 py-1.5 text-sm transition",
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
      <div className="bg-navy-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded px-1.5 py-1 transition hover:bg-navy-700"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-ink">
                ت
              </span>
              <span className="text-base font-bold text-white">تی‌ادیتور</span>
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setServicesOpen((open) => !open);
                  setUserOpen(false);
                }}
                className={cx(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition",
                  servicesOpen || pathname.startsWith("/explanation")
                    ? "bg-navy-700 font-medium text-white"
                    : "text-gray-200 hover:bg-navy-700 hover:text-white",
                )}
              >
                سرویس‌ها
                <span className="text-[10px] text-brand-400">▾</span>
              </button>

              {servicesOpen && (
                <div className="absolute start-0 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
                  {SERVICES.map((service) =>
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
          </div>

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
              <span className="hidden text-sm text-gray-100 sm:block">
                {displayName(profile)}
              </span>
              <span className="text-[10px] text-brand-400">▾</span>
            </button>

            {userOpen && (
              <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
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
                  پروفایل من
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="block w-full rounded-lg px-3 py-2 text-start text-sm text-red-600 transition hover:bg-red-50"
                >
                  خروج از حساب
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Secondary bar — Amazon nav navy */}
      <div className="bg-navy-800">
        <nav className="mx-auto flex h-10 max-w-6xl items-center gap-1 px-4">
          {navLink("/dashboard", "خانه", pathname === "/dashboard")}
          {navLink(
            "/explanation",
            "تشریح سیستم",
            pathname.startsWith("/explanation"),
          )}
          {navLink("/contact", "ارتباط با ما", pathname.startsWith("/contact"))}
          {navLink("/profile", "پروفایل", pathname === "/profile")}
        </nav>
      </div>
    </header>
  );
}
