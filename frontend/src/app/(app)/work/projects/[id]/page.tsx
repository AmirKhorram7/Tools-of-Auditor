"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageLoader } from "@/components/ui";
import { deskHref } from "@/lib/work";

export default function LegacyProjectRedirect() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.id) router.replace(deskHref(params.id));
  }, [params.id, router]);

  return <PageLoader />;
}
