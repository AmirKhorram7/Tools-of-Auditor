"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageLoader } from "@/components/ui";

export default function LegacyCompanyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/work");
  }, [router]);

  return <PageLoader />;
}
