"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import TopBar from "@/components/TopBar";
import AppFooter from "@/components/AppFooter";
import { PageLoader } from "@/components/ui";
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

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) return <PageLoader />;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-2.5 py-6 max-md:overflow-x-clip max-md:px-3 max-md:py-4">
        {children}
      </main>
      {showFooter ? <AppFooter /> : null}
    </div>
  );
}
