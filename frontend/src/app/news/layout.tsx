import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";

import SignalGate from "@/news/SignalGate";

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-signal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Signal",
  robots: { index: false, follow: false },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={space.variable} style={{ minHeight: "100dvh" }}>
      <SignalGate>{children}</SignalGate>
    </div>
  );
}
