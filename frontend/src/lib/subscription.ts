export type SubCycle = "monthly" | "quarterly" | "yearly";
export type SubStatus = "pending" | "active" | "cancelled";

export type PlanOffer = {
  cycle: SubCycle;
  price_rial: number;
  days: number;
  months: number;
};

export type SubscriptionOrder = {
  id: number;
  reference: string;
  cycle: SubCycle;
  status: SubStatus;
  price_rial: number;
  days: number;
  starts_at: string | null;
  ends_at: string | null;
  activated_at: string | null;
  created_at: string;
};

export type SubscriptionMe = {
  is_pro: boolean;
  pro_until: string | null;
  current: SubscriptionOrder | null;
  pending: SubscriptionOrder | null;
  history: SubscriptionOrder[];
};

export function toman(rial: number): number {
  return Math.round(rial / 10);
}

export function formatToman(rial: number, locale: "fa" | "en"): string {
  const value = toman(rial).toLocaleString(locale === "fa" ? "fa-IR" : "en-US");
  return locale === "fa" ? `${value} تومان` : `${value} Toman`;
}

export function monthlyShare(priceRial: number, months: number): number {
  return Math.round(priceRial / Math.max(1, months));
}
