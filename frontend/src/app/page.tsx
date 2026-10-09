"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import Landing from "@/components/landing/Landing";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && isAuthenticated) router.replace("/dashboard");
  }, [ready, isAuthenticated, router]);

  if (!ready || isAuthenticated) {
    return <div className="min-h-screen bg-[#07090c]" />;
  }

  return <Landing signedIn={false} />;
}
