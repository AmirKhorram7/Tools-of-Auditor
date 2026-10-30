"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import SignalHeader from "./SignalHeader";
import { copy } from "./copy";
import { useSignal } from "./SignalContext";

function isDetailPath(pathname: string) {
  return /^\/news\/\d+\/?$/.test(pathname);
}

export default function SignalShell({ children }: { children: ReactNode }) {
  const { lang, theme, ready, access } = useSignal();
  const L = copy(lang);
  const pathname = usePathname();
  const detail = isDetailPath(pathname);

  if (!ready) {
    return (
      <div className="signal-root" data-theme={theme} suppressHydrationWarning>
        <div className="empty">…</div>
      </div>
    );
  }

  if (!access?.allowed) {
    return (
      <div
        className="signal-root"
        data-theme={theme}
        dir={lang === "fa" ? "rtl" : "ltr"}
        lang={lang}
        suppressHydrationWarning
      >
        <main className="signal-main">
          <div className="empty">
            <p>{L.denied}</p>
            <p>
              <Link href="/dashboard" className="ib" style={{ marginTop: 16 }}>
                {L.home}
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={detail ? "signal-root detail" : "signal-root"}
      data-theme={theme}
      dir={lang === "fa" ? "rtl" : "ltr"}
      lang={lang}
      suppressHydrationWarning
    >
      {detail ? null : <SignalHeader />}
      {detail ? children : <main className="signal-main">{children}</main>}
    </div>
  );
}
