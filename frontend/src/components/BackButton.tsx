"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

type Props = {
  /** Used when browser history is empty (e.g. opened in new tab). */
  fallbackHref: string;
  label?: string;
};

/** Simple back control — prefers history, otherwise goes to a safe parent page. */
export default function BackButton({
  fallbackHref,
  label = "بازگشت",
}: Props) {
  const router = useRouter();

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
      ← {label}
    </Button>
  );
}
