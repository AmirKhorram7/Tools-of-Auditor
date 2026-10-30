"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

import { SignalProvider } from "./SignalContext";
import SignalShell from "./SignalShell";
import "./signal.css";

export default function SignalGate({ children }: { children: React.ReactNode }) {
  const { ready, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !isAuthenticated) {
      const next = `${pathname}${typeof window !== "undefined" ? window.location.search : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, isAuthenticated, router, pathname]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="signal-root" data-theme="dark">
        <div className="empty">…</div>
      </div>
    );
  }

  return (
    <SignalProvider>
      <SignalShell>{children}</SignalShell>
    </SignalProvider>
  );
}
