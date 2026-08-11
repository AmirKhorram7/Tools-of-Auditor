const LINKEDIN_URL =
  "https://www.linkedin.com/in/amir-hossein-khorram-niaky-75b596264";
const TELEGRAM_URL = "https://t.me/amirkhorram7";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

type Props = {
  className?: string;
  /** Dark navy hero vs light page background */
  tone?: "light" | "dark";
};

/**
 * Compact professional contact footer with brand-colored social links.
 */
export default function SocialFooter({
  className = "",
  tone = "light",
}: Props) {
  const muted = tone === "dark" ? "text-gray-300" : "text-gray-500";
  const label = tone === "dark" ? "text-gray-200" : "text-gray-600";

  return (
    <footer
      className={`border-t ${
        tone === "dark" ? "border-white/10" : "border-gray-200"
      } pt-5 ${className}`}
    >
      <p className={`text-center text-xs ${muted}`}>
        ارتباط مستقیم با سازنده تی‌ادیتور
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#0A66C2]/25 bg-[#0A66C2]/10 px-3 py-2 text-sm font-medium text-[#0A66C2] transition hover:bg-[#0A66C2] hover:text-white"
        >
          <LinkedInIcon className="size-4 shrink-0" />
          <span>LinkedIn</span>
        </a>
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-[#26A5E4]/30 bg-[#26A5E4]/10 px-3 py-2 text-sm font-medium text-[#229ED9] transition hover:bg-[#229ED9] hover:text-white"
        >
          <TelegramIcon className="size-4 shrink-0" />
          <span>Telegram</span>
        </a>
      </div>
      <p className={`mt-3 text-center text-xs ${label}`}>
        Amir Hossein Khorram
      </p>
    </footer>
  );
}
