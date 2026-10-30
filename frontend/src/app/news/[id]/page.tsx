"use client";

import { Suspense, use } from "react";

import SignalDetail from "@/news/SignalDetail";

function DetailInner({ id }: { id: string }) {
  const articleId = Number(id);
  if (!Number.isFinite(articleId) || articleId <= 0) {
    return <div className="empty">…</div>;
  }
  return <SignalDetail articleId={articleId} />;
}

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="empty">…</div>}>
      <DetailInner id={id} />
    </Suspense>
  );
}
