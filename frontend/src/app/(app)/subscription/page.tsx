"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ChannelIcon from "@/components/reminders/ChannelIcon";
import { Alert, Button, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ReminderChannel } from "@/lib/reminders";
import {
  formatToman,
  monthlyShare,
  type PlanOffer,
  type SubCycle,
  type SubscriptionMe,
  type SubscriptionOrder,
} from "@/lib/subscription";

const CHANNELS: ReminderChannel[] = ["sms", "telegram", "whatsapp", "email"];
const DISPLAY: SubCycle[] = ["monthly", "yearly", "quarterly"];
const FEATURES = ["pro.f1", "pro.f2", "pro.f3", "pro.f4"] as const;
const FAQS = [
  ["pro.faq1q", "pro.faq1a"],
  ["pro.faq2q", "pro.faq2a"],
  ["pro.faq3q", "pro.faq3a"],
] as const;

function formatDate(iso: string | null, locale: "fa" | "en"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-GB");
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-brand-500" fill="none" aria-hidden>
      <path d="M3.2 8.3 6.4 11.4 12.8 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SubscriptionPage() {
  const { t, locale, n } = useI18n();
  const [offers, setOffers] = useState<PlanOffer[]>([]);
  const [me, setMe] = useState<SubscriptionMe | null>(null);
  const [busy, setBusy] = useState<SubCycle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    const [plans, status] = await Promise.all([
      apiFetch<PlanOffer[]>("/subscription/plans/"),
      apiFetch<SubscriptionMe>("/subscription/me/"),
    ]);
    setOffers(plans);
    setMe(status);
  };

  useEffect(() => {
    load().catch(() => setError(t("day.error")));
  }, [t]);

  const checkout = async (cycle: SubCycle) => {
    setBusy(cycle);
    setError(null);
    try {
      await apiFetch<SubscriptionOrder>("/subscription/checkout/", { method: "POST", body: { cycle } });
      await load();
      document.getElementById("pro-order")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("day.error"));
    } finally {
      setBusy(null);
    }
  };

  const cancelPending = async () => {
    if (!me?.pending) return;
    await apiFetch(`/subscription/orders/${me.pending.id}/cancel/`, { method: "POST" });
    await load();
  };

  const copyRef = async () => {
    if (!me?.pending) return;
    await navigator.clipboard.writeText(me.pending.reference);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const byCycle = new Map(offers.map((row) => [row.cycle, row]));
  const chooseLabel = me?.is_pro ? t("pro.renew") : t("pro.choose");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-navy-900 text-white shadow-sm">
        <div className="pointer-events-none absolute -start-24 -top-28 size-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -end-16 bottom-0 size-64 rounded-full bg-white/5 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative grid gap-8 px-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-brand-400">
              {t("pro.kicker")}
            </p>
            <h1 className="mt-4 max-w-lg text-3xl font-bold leading-tight md:text-4xl">{t("pro.title")}</h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-gray-300">{t("pro.subtitle")}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {CHANNELS.map((channel) => (
                <li
                  key={channel}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-100"
                >
                  <ChannelIcon channel={channel} className="size-5" />
                  {t(`rem.ch.${channel}`)}
                </li>
              ))}
            </ul>
          </div>

          <aside className="self-center rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <p className="text-[11px] font-bold tracking-widest text-gray-400">{t("pro.status")}</p>
            {me?.is_pro ? (
              <>
                <p className="mt-2 text-lg font-bold text-white">{t("pro.activeUntil", { date: formatDate(me.pro_until, locale) })}</p>
                <p className="mt-1 text-xs leading-6 text-gray-300">
                  {me.current ? t(`pro.${me.current.cycle}`) : t("pro.currentPlan")}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-lg font-bold text-white">{t("pro.freeNow")}</p>
                <p className="mt-1 text-xs leading-6 text-gray-300">{t("pro.freeHint")}</p>
              </>
            )}
            <Link href="/daybook" className="mt-4 inline-flex text-xs font-medium text-brand-400 hover:text-brand-300">
              {t("nav.daybook")}
            </Link>
          </aside>
        </div>
      </section>

      {error ? <Alert>{error}</Alert> : null}

      {me?.pending ? (
        <section
          id="pro-order"
          className="overflow-hidden rounded-[1.5rem] border border-brand-400 bg-white shadow-sm"
        >
          <div className="flex flex-wrap items-stretch">
            <div className="min-w-[9rem] bg-navy-900 px-5 py-5 text-white">
              <p className="text-[11px] font-bold tracking-widest text-brand-400">{t("pro.refLabel")}</p>
              <p dir="ltr" className="mt-2 font-mono text-xl font-bold tracking-wide">
                {me.pending.reference}
              </p>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4 px-5 py-5">
              <div>
                <p className="text-sm font-bold text-navy-900">{t("pro.pendingTitle")}</p>
                <p className="mt-1 max-w-md text-sm leading-6 text-gray-600">{t("pro.pendingBody")}</p>
                <p className="mt-2 text-sm font-medium text-navy-800">
                  {t(`pro.${me.pending.cycle}`)} · {formatToman(me.pending.price_rial, locale)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={copyRef}>
                  {copied ? t("pro.copied") : t("pro.copy")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={cancelPending}>
                  {t("pro.cancelOrder")}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-navy-900">{t("pro.plansTitle")}</h2>
          <p className="mt-2 text-sm leading-7 text-gray-500">{t("pro.compareEqual")}</p>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-3 md:gap-5">
          {DISPLAY.map((cycle) => {
            const offer = byCycle.get(cycle);
            if (!offer) {
              return <div key={cycle} className="h-80 animate-pulse rounded-[1.5rem] bg-gray-100" />;
            }
            const featured = cycle === "yearly";
            const pendingHere = me?.pending?.cycle === cycle;
            const perMonth = formatToman(monthlyShare(offer.price_rial, offer.months), locale);
            return (
              <article
                key={cycle}
                className={cx(
                  "relative flex flex-col rounded-[1.5rem] border bg-white p-6",
                  featured
                    ? "border-brand-500 shadow-[0_18px_40px_-24px_rgba(19,26,34,0.55)] md:-translate-y-2"
                    : "border-gray-200",
                  pendingHere && "ring-2 ring-brand-400",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 start-6 rounded-full bg-brand-500 px-3 py-0.5 text-[11px] font-bold text-navy-900">
                    {t("pro.best")}
                  </span>
                ) : null}
                <p className="text-sm font-bold text-navy-900">{t(`pro.${cycle}`)}</p>
                <p className="mt-1 text-xs text-gray-500">{t(`pro.${cycle}Hint`)}</p>
                <p className="mt-5 text-3xl font-bold tabular-nums tracking-tight text-navy-900">
                  {formatToman(offer.price_rial, locale)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t("pro.perMonth", { price: perMonth })} · {t("pro.days", { n: n(offer.days) })}
                </p>
                <ul className="mt-5 space-y-2.5 text-sm text-navy-800">
                  {FEATURES.map((key) => (
                    <li key={key} className="flex gap-2 leading-6">
                      <Check />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  className="mt-6 w-full"
                  variant={featured ? "primary" : "secondary"}
                  loading={busy === cycle}
                  onClick={() => checkout(cycle)}
                >
                  {pendingHere ? t("pro.pendingThis") : chooseLabel}
                </Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["pro.trustTitle", "pro.trustBody"],
          ["pro.secureTitle", "pro.secureBody"],
          ["pro.howTitle", "pro.howBody"],
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white px-5 py-5">
            <p className="text-sm font-bold text-navy-900">{t(title)}</p>
            <p className="mt-2 text-sm leading-7 text-gray-600">{t(body)}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[1.5rem] border border-gray-200 bg-white px-5 py-2 md:px-7">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group border-b border-gray-100 py-4 last:border-0">
            <summary className="cursor-pointer list-none text-sm font-semibold text-navy-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-3">
                {t(q)}
                <span className="text-gray-400 group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t(a)}</p>
          </details>
        ))}
      </section>

      <p className="pb-4 text-center text-xs leading-6 text-gray-500">{t("pro.payLater")}</p>
    </div>
  );
}
