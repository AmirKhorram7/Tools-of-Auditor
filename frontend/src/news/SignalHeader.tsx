"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { copy } from "./copy";
import { useSignal } from "./SignalContext";

export default function SignalHeader() {
  const { lang, setLang, toggleTheme, access, adminOpen, setAdminOpen } = useSignal();
  const L = copy(lang);
  const pathname = usePathname();
  const onFeed = pathname === "/news" || pathname === "/news/";
  const onSettings = pathname.startsWith("/news/settings");
  const admin = Boolean(access?.is_fetch_admin);

  return (
    <header className="top">
      <Link href="/news" className="logo">
        <i />
        tauditor <small>{onSettings ? L.settingsSub : L.sub}</small>
      </Link>
      <div className="sp" />
      {admin && onFeed ? (
        <button type="button" className={adminOpen ? "ib on" : "ib"} onClick={() => setAdminOpen(!adminOpen)}>
          {L.adm}
        </button>
      ) : null}
      {/* Home: settings only — never on the /news feed */}
      {onSettings ? (
        <Link href="/dashboard" className="ib">
          {L.homeBtn}
        </Link>
      ) : null}
      {onSettings ? (
        <Link href="/news" className="ib">
          {L.feed}
        </Link>
      ) : null}
      {admin ? (
        <Link href="/news/settings" className={onSettings ? "ib on" : "ib"}>
          {L.set}
        </Link>
      ) : null}
      <button type="button" className="ib" onClick={toggleTheme} aria-label="theme">
        ◐
      </button>
      <div className="seg">
        <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
          EN
        </button>
        <button type="button" className={lang === "fa" ? "on" : ""} onClick={() => setLang("fa")}>
          فا
        </button>
      </div>
    </header>
  );
}
