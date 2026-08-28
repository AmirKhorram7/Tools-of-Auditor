"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import TopBar from "@/components/TopBar";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !isAuthenticated) router.replace("/login");
  }, [ready, isAuthenticated, router]);

  if (!ready || !isAuthenticated) return <PageLoader />;

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto w-full max-w-screen-2xl px-2.5 py-6 max-md:overflow-x-clip max-md:px-3 max-md:py-4">
        {children}
      </main>
    </div>
  );
}
