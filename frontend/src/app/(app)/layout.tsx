"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import TopBar from "@/components/TopBar";
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
  const wide =
    pathname.startsWith("/explanation") || pathname.startsWith("/work");

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) return <PageLoader />;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main
        className={cx("mx-auto px-4 py-6", wide ? "max-w-7xl" : "max-w-6xl")}
      >
        {children}
      </main>
    </div>
  );
}
