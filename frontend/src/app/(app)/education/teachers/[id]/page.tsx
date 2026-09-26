"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import TeacherProfile from "@/components/education/TeacherProfile";
import { Alert, PageLoader } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { EduTeacher } from "@/lib/education";
import { useI18n } from "@/lib/i18n";

export default function TeacherPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [page, setPage] = useState<EduTeacher | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<EduTeacher>(`/education/teachers/${id}/`)
      .then(setPage)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("edu.loadFail")));
  }, [id, t]);

  if (!page && !error) return <PageLoader />;
  if (!page) return <Alert>{error}</Alert>;

  return (
    <div className="space-y-6">
      <TeacherProfile teacher={page} />
      <Link href="/education" className="inline-block text-[13px] font-medium text-navy-800 hover:text-link">
        {t("edu.backCatalog")}
      </Link>
    </div>
  );
}
