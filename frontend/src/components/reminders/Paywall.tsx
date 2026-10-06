"use client";

import Link from "next/link";

import { Button, Modal } from "@/components/ui";
import { formatToman } from "@/lib/subscription";
import { useI18n } from "@/lib/i18n";

const SAMPLE = [
  { cycle: "monthly", price: 2_000_000 },
  { cycle: "quarterly", price: 6_000_000 },
  { cycle: "yearly", price: 24_000_000 },
] as const;

export default function Paywall({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  return (
    <Modal open={open} title={t("pro.needTitle")} onClose={onClose} className="max-w-md">
      <p className="text-sm leading-7 text-gray-600">{t("pro.needBody")}</p>
      <ul className="mt-4 space-y-2">
        {SAMPLE.map((row) => (
          <li key={row.cycle} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm">
            <span className="font-medium text-navy-900">{t(`pro.${row.cycle}`)}</span>
            <span className="tabular-nums text-navy-800">{formatToman(row.price, locale)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Link href="/subscription" onClick={onClose}>
          <Button type="button">{t("pro.goPlans")}</Button>
        </Link>
      </div>
    </Modal>
  );
}
