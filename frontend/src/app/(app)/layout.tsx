"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import TopBar from "@/components/TopBar";
import AppFooter from "@/components/AppFooter";
import { PageLoader, cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Home and contact only — service apps stay without the marketing footer.
  const showFooter = pathname === "/dashboard" || pathname === "/contact";
  const deskBoard = /^\/work\/desks\/[^/]+\/?$/.test(pathname);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      const next = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (!deskBoard) return;
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("overflow-hidden");
    body.classList.add("overflow-hidden");
    return () => {
      root.classList.remove("overflow-hidden");
      body.classList.remove("overflow-hidden");
    };
  }, [deskBoard]);

  if (!ready || !isAuthenticated) return <PageLoader />;

  return (
    <div className={cx("flex flex-col", deskBoard ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <TopBar />
      <main
        className={cx(
          "mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-2.5 max-md:overflow-x-clip max-md:px-3",
          deskBoard ? "h-0 min-h-0 overflow-hidden py-2.5 max-md:py-2" : "py-6 max-md:py-4",
        )}
      >
        {children}
      </main>
      {showFooter ? <AppFooter /> : null}
    </div>
  );
}
