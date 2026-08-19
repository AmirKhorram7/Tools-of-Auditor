"use client";

import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import TreeView from "@/components/explanation/TreeView";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiList } from "@/lib/api";
import type { TreeFolder } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";

export default function ExplanationTreePage() {
  const { t } = useI18n();
  const [folders, setFolders] = useState<TreeFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const root = new URLSearchParams(window.location.search).get("root");
    try {
      setFolders(
        await apiList<TreeFolder>(
          root ? `/projects/tree/?root=${encodeURIComponent(root)}` : "/projects/tree/",
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "دریافت ساختار ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton fallbackHref="/explanation" />
        <nav className="text-xs text-gray-500">
          {t("exp.title")} / {t("exp.treeTitle")}
        </nav>
      </div>

      <div>
        <h1 className="text-lg font-bold text-ink">{t("exp.treeTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("exp.treeSubtitle")}</p>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? <PageLoader /> : <TreeView folders={folders} rootLabel={t("exp.title")} />}
    </div>
  );
}
