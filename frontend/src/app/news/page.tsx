"use client";

import { Suspense } from "react";

import SignalFeed from "@/news/SignalFeed";

export default function NewsPage() {
  return (
    <Suspense fallback={<div className="empty">…</div>}>
      <SignalFeed />
    </Suspense>
  );
}
