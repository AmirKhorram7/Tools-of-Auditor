"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import SocialFooter from "@/components/SocialFooter";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
  cx,
} from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  TICKET_STATUS_LABELS,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/types";

type Topic = {
  key: "suggestion" | "idea" | "problem" | "other";
  label: string;
  hint: string;
  priority: TicketPriority;
  prefix: string;
};

const TOPICS: Topic[] = [
  {
    key: "suggestion",
    label: "پیشنهاد",
    hint: "ایده بهبود محصول",
    priority: "MEDIUM",
    prefix: "پیشنهاد",
  },
  {
    key: "idea",
    label: "ایده جدید",
    hint: "قابلیتی که دوست دارید",
    priority: "LOW",
    prefix: "ایده",
  },
  {
    key: "problem",
    label: "مشکل",
    hint: "خطا یا مانع در کار",
    priority: "HIGH",
    prefix: "مشکل",
  },
  {
    key: "other",
    label: "سایر",
    hint: "سوال یا پیام عمومی",
    priority: "MEDIUM",
    prefix: "پیام",
  },
];

function statusTone(status: TicketStatus): "blue" | "green" | "amber" | "gray" {
  if (status === "WAITING_FOR_USER") return "amber";
  if (status === "CLOSED") return "gray";
  if (status === "IN_PROGRESS") return "blue";
  return "green";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ContactPage() {
  const { profile, refreshProfile } = useAuth();

  const needsName = useMemo(() => {
    const first = (profile?.first_name ?? "").trim();
    const last = (profile?.last_name ?? "").trim();
    return !first || !last;
  }, [profile]);

  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
  }, [profile]);

  const loadTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const data = await apiList<Ticket>("/tickets/");
      setTickets(data);
      setActiveId((current) => current ?? data[0]?.id ?? null);
    } catch {
      // Keep the form usable even if history fails.
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const activeTicket = tickets.find((item) => item.id === activeId) ?? null;

  const submit = async () => {
    setError(null);
    setSuccess(null);

    if (needsName && (!firstName.trim() || !lastName.trim())) {
      setError("لطفاً نام و نام خانوادگی خود را وارد کنید.");
      return;
    }
    if (!subject.trim()) {
      setError("موضوع پیام الزامی است.");
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError("متن پیام را کامل‌تر بنویسید (حداقل ۱۰ کاراکتر).");
      return;
    }

    setSaving(true);
    try {
      const created = await apiFetch<Ticket>("/tickets/", {
        method: "POST",
        body: {
          subject: `${topic.prefix}: ${subject.trim()}`,
          priority: topic.priority,
          message: message.trim(),
          ...(needsName
            ? {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
              }
            : {}),
        },
      });
      setSubject("");
      setMessage("");
      setSuccess("پیام شما ثبت شد. به‌زودی پاسخ می‌دهیم.");
      setTickets((current) => [created, ...current.filter((t) => t.id !== created.id)]);
      setActiveId(created.id);
      if (needsName) {
        await refreshProfile().catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ارسال پیام ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    setReplying(true);
    setError(null);
    try {
      const updated = await apiFetch<Ticket>(
        `/tickets/${activeTicket.id}/send_message/`,
        { method: "POST", body: { message: reply.trim() } },
      );
      setTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setReply("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ارسال پاسخ ناموفق بود.");
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-navy-800/10 bg-navy-900 px-6 py-10 text-white shadow-sm sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(255,153,0,0.35), transparent 40%), radial-gradient(circle at 85% 10%, rgba(255,255,255,0.12), transparent 35%), linear-gradient(135deg, rgba(35,47,62,0.2), transparent)",
          }}
        />
        <div className="relative max-w-2xl">
          <p className="text-sm font-medium text-brand-400">ارتباط با ما</p>
          <h1 className="mt-2 text-2xl font-bold leading-relaxed sm:text-3xl">
            نظر، ایده یا مشکلتان را با ما در میان بگذارید
          </h1>
          <p className="mt-3 text-sm leading-7 text-gray-200">
            پیشنهاد شما مسیر تی‌ادیتور را می‌سازد. پیشنهادهای بهبود، ایده‌های تازه و
            گزارش مشکلات را می‌خوانیم و به شما پاسخ می‌دهیم.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Form */}
        <Card className="space-y-5 border-gray-200/80 bg-white/90 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-ink">ارسال پیام جدید</h2>
            <p className="mt-1 text-sm text-gray-500">
              نوع پیام را انتخاب کنید و جزئیات را بنویسید.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {TOPICS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTopic(item)}
                className={cx(
                  "rounded-xl border px-3 py-3 text-start transition",
                  topic.key === item.key
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-navy-300 hover:bg-surface",
                )}
              >
                <span className="block text-sm font-medium text-ink">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>

          {needsName && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="نام" hint="برای پاسخ شخصی‌تر از شما">
                <Input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="مثلاً سارا"
                  autoFocus
                />
              </Field>
              <Field label="نام خانوادگی">
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="مثلاً محمدی"
                />
              </Field>
            </div>
          )}

          <Field label="موضوع">
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={
                topic.key === "problem"
                  ? "مثال: خطا هنگام ذخیره ریسک"
                  : "موضوع پیام را کوتاه بنویسید"
              }
            />
          </Field>

          <Field
            label="متن پیام"
            hint="هرچه شفاف‌تر بنویسید، سریع‌تر می‌توانیم کمک کنیم."
          >
            <Textarea
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="جزئیات پیشنهاد، ایده یا مشکل را اینجا بنویسید..."
            />
          </Field>

          {error && <Alert>{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          <div className="flex justify-end">
            <Button loading={saving} onClick={submit}>
              ارسال پیام
            </Button>
          </div>
        </Card>

        {/* History */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">پیام‌های قبلی</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadTickets}
              disabled={loadingTickets}
            >
              بروزرسانی
            </Button>
          </div>

          {loadingTickets ? (
            <Card className="text-sm text-gray-500">در حال بارگذاری...</Card>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="هنوز پیامی ندارید"
              description="اولین پیشنهاد یا گزارش مشکل را از فرم کنار ارسال کنید."
            />
          ) : (
            <>
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setActiveId(ticket.id)}
                    className={cx(
                      "w-full rounded-xl border px-3 py-3 text-start transition",
                      activeId === ticket.id
                        ? "border-navy-800 bg-white shadow-sm"
                        : "border-gray-200 bg-white/70 hover:border-navy-300",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">
                        {ticket.subject}
                      </p>
                      <Badge tone={statusTone(ticket.status)}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(ticket.updated_at || ticket.created_at)}
                    </p>
                  </button>
                ))}
              </div>

              {activeTicket && (
                <Card className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">
                      گفتگو #{activeTicket.id}
                    </h3>
                    <Badge tone={statusTone(activeTicket.status)}>
                      {TICKET_STATUS_LABELS[activeTicket.status]}
                    </Badge>
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-surface/80 p-2">
                    {activeTicket.messages.map((item) => (
                      <div
                        key={item.id}
                        className={cx(
                          "rounded-lg px-3 py-2 text-sm",
                          item.is_admin_message
                            ? "border border-brand-200 bg-brand-50 text-ink"
                            : "border border-gray-200 bg-white text-gray-800",
                        )}
                      >
                        <p className="mb-1 text-[11px] text-gray-500">
                          {item.is_admin_message
                            ? "پشتیبانی تی‌ادیتور"
                            : "شما"}{" "}
                          · {formatDate(item.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap leading-7">
                          {item.message}
                        </p>
                      </div>
                    ))}
                  </div>

                  {activeTicket.status !== "CLOSED" ? (
                    <div className="space-y-2">
                      <Textarea
                        rows={3}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="پاسخ خود را بنویسید..."
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          loading={replying}
                          disabled={!reply.trim()}
                          onClick={sendReply}
                        >
                          ارسال پاسخ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      این گفتگو بسته شده است. برای موضوع جدید، پیام تازه بفرستید.
                    </p>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <SocialFooter className="mt-4" />
    </div>
  );
}
