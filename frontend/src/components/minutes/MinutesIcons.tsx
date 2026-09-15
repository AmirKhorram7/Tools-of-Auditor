import type { ReactNode, SVGProps } from "react";

import { cx } from "@/components/ui";

function Svg({ className, children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx("size-5", className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function ClerkIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c.8-3.1 3.3-5 6.5-5s5.7 1.9 6.5 5" />
      <path d="M16.6 4.8 19 7.2l-2.4 2.4" />
    </Svg>
  );
}

export function GroupIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8.5" r="2.6" />
      <circle cx="16" cy="9.2" r="2.2" />
      <path d="M3.8 18.5c.7-2.8 2.9-4.4 5.4-4.4 2.2 0 4.1 1.2 5 3.2" />
      <path d="M13.2 14.6c1.1-.5 2.4-.7 3.7-.4 2 .4 3.5 1.8 4.1 3.8" />
    </Svg>
  );
}

export function CompanyIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4.5 20.5h15" />
      <path d="M6.5 20.5V6.8a1 1 0 0 1 1-1h5.2a1 1 0 0 1 1 1v13.7" />
      <path d="M13.7 20.5V10.2a1 1 0 0 1 1-1H17.5a1 1 0 0 1 1 1v10.3" />
      <path d="M9 9.2h1.2M9 12.2h1.2M9 15.2h1.2M16 13h1.2M16 16h1.2" />
    </Svg>
  );
}

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </Svg>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 3.6v2.1M12 18.3v2.1M4.9 6.8l1.5 1.5M17.6 15.7l1.5 1.5M3.6 12h2.1M18.3 12h2.1M4.9 17.2l1.5-1.5M17.6 8.3l1.5-1.5" />
    </Svg>
  );
}

export function MinutesDocIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M7 3.8h7.2L20 9.6V20.2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1Z" />
      <path d="M14.2 3.8v5.8H20M9 13.2h6M9 16.6h4.5" />
    </Svg>
  );
}

export function StatusIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.4l2.6 1.6" />
    </Svg>
  );
}

export function InboxIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 6.5h16v11H4z" />
      <path d="m4 7 8 6 8-6" />
    </Svg>
  );
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 7h14" />
      <path d="M10 7V5h4v2" />
      <path d="M7.5 7v11.5h9V7" />
      <path d="M10 10.5v5M14 10.5v5" />
    </Svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function PencilIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4.5 15.5 14 6l3.5 3.5-9.5 9.5H4.5v-3.5Z" />
      <path d="m12.8 7.2 3.5 3.5" />
    </Svg>
  );
}

export function UserPlusIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="8" r="3" />
      <path d="M4.5 19c.7-3 2.8-4.8 5.5-4.8 2.7 0 4.8 1.8 5.5 4.8" />
      <path d="M18 8v6M15 11h6" />
    </Svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Svg>
  );
}

export function CarryIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M5 12h12" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

const DUO_FILL = "#8ECDEB";
const DUO_STROKE = "#2F6A88";

function DuotoneSvg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={DUO_STROKE}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx("size-5 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

export function DuoEditIcon({ className }: { className?: string }) {
  return (
    <DuotoneSvg className={className}>
      <rect x="3.8" y="3.4" width="12.4" height="17.2" rx="2.2" fill={DUO_FILL} />
      <path d="M7 8.2h6.2M7 11.6h6.2M7 15h3.6" />
      <path d="M13.2 18.2 19.8 9.4l2.1 1.6-6.6 8.8H13.2v-1.6Z" fill={DUO_FILL} />
    </DuotoneSvg>
  );
}

export function DuoAcceptIcon({ className }: { className?: string }) {
  return (
    <DuotoneSvg className={className}>
      <circle cx="12" cy="12" r="8.4" fill={DUO_FILL} />
      <path d="M8 12.2 10.7 15l5.3-6.3" strokeWidth="2" />
    </DuotoneSvg>
  );
}

export function DuoRestoreIcon({ className }: { className?: string }) {
  return (
    <DuotoneSvg className={className}>
      <circle cx="12" cy="12" r="8.4" fill={DUO_FILL} />
      <path d="M8.2 9.2a4.4 4.4 0 0 1 7.2-.4" />
      <path d="M15.4 6.4v3.2h-3.2" />
      <path d="M15.8 14.8a4.4 4.4 0 0 1-7.2.4" />
      <path d="M8.6 17.6v-3.2h3.2" />
    </DuotoneSvg>
  );
}

export function MinutesIconTile({
  tone = "navy",
  size = "md",
  children,
}: {
  tone?: "navy" | "brand" | "soft" | "green" | "teal" | "blue";
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full leading-none shadow-[1px_2px_0_rgba(15,17,17,0.12)]",
        size === "sm" ? "size-8" : "size-10",
        tone === "navy" && "bg-navy-900 text-brand-500",
        tone === "brand" && "bg-brand-500 text-navy-900",
        tone === "soft" && "bg-brand-50 text-navy-800",
        tone === "green" && "bg-green-600 text-white",
        tone === "teal" && "bg-[#2A9D8F] text-white",
        tone === "blue" && "bg-[#3D7EA6] text-white",
      )}
    >
      {children}
    </span>
  );
}
