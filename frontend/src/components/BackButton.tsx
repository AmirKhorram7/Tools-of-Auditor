"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Props = {
  fallbackHref: string;
  label?: string;
};

export default function BackButton({ fallbackHref, label }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const text = label ?? t("common.back");

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      ← {text}
    </Button>
  );
}
