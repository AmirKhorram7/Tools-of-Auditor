"use client";

import { useParams } from "next/navigation";

import CompaniesSettings from "@/components/minutes/CompaniesSettings";

export default function MinutesCompanyPage() {
  const params = useParams<{ id: string }>();
  const focusId = Number(params.id);
  return <CompaniesSettings focusId={Number.isFinite(focusId) ? focusId : undefined} />;
}
