import type { ReactNode } from "react";

import { cx } from "@/components/ui";
import type { AppService } from "@/lib/services";

type Mark = AppService["icon"];

const TILE: Record<
  Mark,
  { from: string; to: string }
> = {
  home: { from: "#ffb433", to: "#ff9900" },
  work: { from: "#4a5d73", to: "#232f3e" },
  minutes: { from: "#1a9aaa", to: "#007185" },
  docs: { from: "#37475a", to: "#131a22" },
  learn: { from: "#ff9900", to: "#c7511f" },
  contact: { from: "#2a8f9c", to: "#0f5f6c" },
  profile: { from: "#4a5d73", to: "#232f3e" },
  plan: { from: "#6b7c8f", to: "#37475a" },
  papers: { from: "#6b7c8f", to: "#37475a" },
};

function Tile({
  name,
  className,
  children,
}: {
  name: Mark;
  className?: string;
  children: ReactNode;
}) {
  const { from, to } = TILE[name];
  const gid = `ta-svc-${name}`;
  return (
    <svg viewBox="0 0 48 48" className={cx("shrink-0", className)} fill="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="8" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill={`url(#${gid})`} />
      {children}
    </svg>
  );
}

function Glyph({ name, className }: { name: Mark; className?: string }) {
  if (name === "home") {
    return (
      <Tile name={name} className={className}>
        <path
          fill="#fff"
          d="M24 12.2 11.2 22.4c-.4.3-.6.8-.6 1.2V36c0 1.1.9 2 2 2h7.4v-7.4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2V38h7.4c1.1 0 2-.9 2-2V23.6c0-.4-.2-.9-.6-1.2L24 12.2Z"
        />
        <rect x="21.6" y="28.6" width="4.8" height="7.4" rx="1.2" fill="#ff9900" />
      </Tile>
    );
  }
  if (name === "work") {
    return (
      <Tile name={name} className={className}>
        <path fill="#fff" d="M18.2 13.4h11.6c.8 0 1.4.6 1.4 1.4v2.4H16.8V14.8c0-.8.6-1.4 1.4-1.4Z" />
        <path
          fill="#fff"
          d="M11 18.6h26c1.2 0 2.2 1 2.2 2.2v13.4c0 1.2-1 2.2-2.2 2.2H11c-1.2 0-2.2-1-2.2-2.2V20.8c0-1.2 1-2.2 2.2-2.2Z"
        />
        <rect x="20.4" y="24.2" width="7.2" height="5.4" rx="1.6" fill="#ff9900" />
      </Tile>
    );
  }
  if (name === "minutes") {
    return (
      <Tile name={name} className={className}>
        <rect x="13.5" y="10" width="21" height="28" rx="3.5" fill="#fff" />
        <path fill="#ff9900" d="M13.5 10h21v8.2c0-1.6-1.3-2.8-2.8-2.8H16.3c-1.5 0-2.8 1.2-2.8 2.8V10Z" />
        <rect x="13.5" y="14.4" width="21" height="4.4" fill="#ff9900" />
        <rect x="17.4" y="22.2" width="13.2" height="2" rx="1" fill="#232f3e" />
        <rect x="17.4" y="26.6" width="10" height="2" rx="1" fill="#232f3e" />
        <rect x="17.4" y="31" width="7.2" height="2" rx="1" fill="#c5cbd3" />
      </Tile>
    );
  }
  if (name === "docs") {
    return (
      <Tile name={name} className={className}>
        <rect x="10.5" y="12" width="11.5" height="9.5" rx="2.4" fill="#fff" />
        <rect x="26" y="26.5" width="11.5" height="9.5" rx="2.4" fill="#fff" />
        <path
          d="M16.2 21.6v5.2c0 1.2 1 2.2 2.2 2.2H26"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="32.2" cy="16.6" r="4.3" fill="#ff9900" />
      </Tile>
    );
  }
  if (name === "learn") {
    return (
      <Tile name={name} className={className}>
        <path fill="#fff" d="M24 11.4 9.2 18.2c-.5.2-.5.9 0 1.2L24 26.2l14.8-6.8c.5-.3.5-1 0-1.2L24 11.4Z" />
        <path
          fill="#fff"
          fillOpacity=".92"
          d="M11.6 22.2v7.6c0 .6.3 1.1.8 1.4 3.4 2 7.2 3 11.6 3s8.2-1 11.6-3c.5-.3.8-.8.8-1.4v-7.6L24 28.2 11.6 22.2Z"
        />
        <path d="M36.6 20.4v8.8" stroke="#fff8ec" strokeWidth="2" strokeLinecap="round" />
      </Tile>
    );
  }
  if (name === "contact") {
    return (
      <Tile name={name} className={className}>
        <path
          fill="#fff"
          d="M12.4 15.2c0-2.1 1.7-3.8 3.8-3.8h15.6c2.1 0 3.8 1.7 3.8 3.8v10.4c0 2.1-1.7 3.8-3.8 3.8H22.2L13.6 36.2c-.6.4-1.2 0-1.2-.7v-20.3Z"
        />
        <rect x="17.6" y="18.2" width="12.8" height="2.1" rx="1.05" fill="#007185" />
        <rect x="17.6" y="22.6" width="8.6" height="2.1" rx="1.05" fill="#007185" />
      </Tile>
    );
  }
  if (name === "profile") {
    return (
      <Tile name={name} className={className}>
        <circle cx="24" cy="18.6" r="6.6" fill="#fff" />
        <path fill="#fff" d="M12.2 36.4c1.5-6.4 6-9.4 11.8-9.4s10.3 3 11.8 9.4H12.2Z" />
        <circle cx="24" cy="18.6" r="2.2" fill="#ff9900" />
      </Tile>
    );
  }
  if (name === "plan") {
    return (
      <Tile name={name} className={className}>
        <rect x="11" y="13.2" width="26" height="23.6" rx="4" fill="#fff" />
        <path fill="#232f3e" d="M11 17.2h26v6.2c0-2.2-1.8-4-4-4H15c-2.2 0-4 1.8-4 4V17.2Z" />
        <rect x="11" y="13.2" width="26" height="8.2" rx="4" fill="#232f3e" />
        <rect x="11" y="18.4" width="26" height="3" fill="#232f3e" />
        <rect x="16.4" y="10.4" width="2.6" height="6.4" rx="1.3" fill="#fff" />
        <rect x="29" y="10.4" width="2.6" height="6.4" rx="1.3" fill="#fff" />
        <rect x="16.2" y="25.4" width="4.2" height="4.2" rx="1.1" fill="#ff9900" />
        <rect x="21.9" y="25.4" width="4.2" height="4.2" rx="1.1" fill="#d5d9d9" />
        <rect x="27.6" y="25.4" width="4.2" height="4.2" rx="1.1" fill="#d5d9d9" />
        <rect x="16.2" y="30.8" width="4.2" height="3.4" rx="1.1" fill="#d5d9d9" />
        <rect x="21.9" y="30.8" width="4.2" height="3.4" rx="1.1" fill="#d5d9d9" />
      </Tile>
    );
  }
  return (
    <Tile name={name} className={className}>
      <rect x="16.4" y="10.8" width="17.2" height="21.6" rx="3" fill="#fff" fillOpacity=".55" />
      <rect x="12.4" y="15.2" width="17.2" height="21.6" rx="3" fill="#fff" />
      <rect x="15.6" y="21.4" width="10.6" height="2" rx="1" fill="#232f3e" />
      <rect x="15.6" y="26" width="8" height="2" rx="1" fill="#c5cbd3" />
    </Tile>
  );
}

export function ServiceGlyph({
  service,
  size = "md",
}: {
  service: AppService;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center justify-center overflow-hidden rounded-[13px] shadow-[0_2px_6px_rgba(19,26,34,0.16)]",
        size === "sm" ? "size-10" : "size-12",
      )}
    >
      <Glyph name={service.icon} className={size === "sm" ? "size-10" : "size-12"} />
    </span>
  );
}

export function LauncherMark({ className }: { className?: string }) {
  const green = new Set(["0-0", "1-0", "2-0", "1-1", "1-2"]);
  return (
    <svg viewBox="0 0 48 48" className={cx("size-9", className)} aria-hidden>
      <rect width="48" height="48" rx="11" fill="#0b0b0b" />
      {[0, 1, 2].flatMap((x) =>
        [0, 1, 2].map((y) => (
          <circle
            key={`${x}-${y}`}
            cx={14 + x * 10}
            cy={14 + y * 10}
            r="3.15"
            fill={green.has(`${x}-${y}`) ? "#22c55e" : "#ffffff"}
          />
        )),
      )}
    </svg>
  );
}
