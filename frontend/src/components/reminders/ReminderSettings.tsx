"use client";

import { useEffect, useState, type ReactNode } from "react";

import ChannelIcon from "@/components/reminders/ChannelIcon";
import Paywall from "@/components/reminders/Paywall";
import SpecFields from "@/components/reminders/SpecFields";
import { Alert, Button, Input, Modal, cx } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import type { CalendarSystem } from "@/lib/daybook";
import {
  emptyDraft,
  timeHm,
  type ReminderContact,
  type ReminderDraft,
  type ReminderGroup,
} from "@/lib/reminders";
import { useI18n } from "@/lib/i18n";

export default function ReminderSettings({
  open,
  onClose,
  system,
}: {
  open: boolean;
  onClose: () => void;
  system: CalendarSystem;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"where" | "groups">("where");
  const [contact, setContact] = useState<ReminderContact | null>(null);
  const [groups, setGroups] = useState<ReminderGroup[]>([]);
  const [name, setName] = useState("");
  const [spec, setSpec] = useState<ReminderDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactOk, setContactOk] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("where");
    setError(null);
    setContactOk(false);
    apiFetch<ReminderContact>("/reminders/contact/").then(setContact).catch(() => undefined);
    apiList<ReminderGroup>("/reminders/groups/").then(setGroups).catch(() => undefined);
  }, [open]);

  const saveContact = async () => {
    if (!contact || savingContact) return;
    setSavingContact(true);
    setContactOk(false);
    try {
      setContact(
        await apiFetch<ReminderContact>("/reminders/contact/", {
          method: "PATCH",
          body: {
            email: contact.email,
            telegram_chat_id: contact.telegram_chat_id,
            whatsapp_number: contact.whatsapp_number,
          },
        }),
      );
      setContactOk(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("day.error"));
    } finally {
      setSavingContact(false);
    }
  };

  const addGroup = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const row = await apiFetch<ReminderGroup>("/reminders/groups/", {
        method: "POST",
        body: {
          name,
          channels: spec.channels,
          mode: spec.mode,
          offset_days: spec.offset_days,
          at_time: spec.at_time,
          fixed_at: spec.mode === "at" ? spec.fixed_at : null,
        },
      });
      setGroups((current) => [...current, row]);
      setName("");
      setSpec(emptyDraft());
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) setPaywall(true);
      else setError(err instanceof ApiError ? err.message : t("day.error"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    await apiFetch(`/reminders/groups/${id}/`, { method: "DELETE" });
    setGroups((current) => current.filter((row) => row.id !== id));
  };

  return (
    <>
      <Modal open={open} title={t("rem.settings")} onClose={onClose} className="max-w-2xl">
        <p className="-mt-1 mb-4 text-sm leading-6 text-gray-500">{t("rem.settingsHint")}</p>

        <div className="mb-5 inline-flex w-full rounded-xl bg-navy-800/10 p-1">
          {(
            [
              ["where", t("rem.tabWhere")],
              ["groups", t("rem.tabGroups")],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setError(null);
              }}
              className={cx(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                tab === key ? "bg-white text-navy-900 shadow-sm" : "text-navy-700 hover:text-navy-900",
              )}
            >
              {label}
              {key === "groups" && groups.length ? (
                <span className="ms-1.5 tabular-nums text-gray-400">({groups.length})</span>
              ) : null}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        {tab === "where" ? (
          <div className="space-y-3">
            {contact ? (
              <>
                <ChannelRow icon="email" label={t("rem.ch.email")}>
                  <Input
                    type="email"
                    dir="ltr"
                    value={contact.email}
                    placeholder="name@example.com"
                    onChange={(event) => setContact({ ...contact, email: event.target.value })}
                  />
                </ChannelRow>
                <ChannelRow icon="telegram" label={t("rem.ch.telegram")} hint={t("rem.telegramHint")}>
                  <Input
                    dir="ltr"
                    value={contact.telegram_chat_id}
                    placeholder="123456789"
                    onChange={(event) => setContact({ ...contact, telegram_chat_id: event.target.value })}
                  />
                </ChannelRow>
                <ChannelRow icon="whatsapp" label={t("rem.ch.whatsapp")}>
                  <Input
                    dir="ltr"
                    value={contact.whatsapp_number}
                    placeholder="+98912…"
                    onChange={(event) => setContact({ ...contact, whatsapp_number: event.target.value })}
                  />
                </ChannelRow>
                <ChannelRow icon="sms" label={t("rem.ch.sms")} hint={t("rem.smsLocked")}>
                  <div
                    dir="ltr"
                    className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm font-medium text-navy-800"
                  >
                    {contact.sms_number || "—"}
                  </div>
                </ChannelRow>
                <div className="flex items-center justify-end gap-3 pt-2">
                  {contactOk ? <span className="text-xs font-medium text-green-700">{t("rem.saved")}</span> : null}
                  <Button type="button" size="sm" loading={savingContact} onClick={saveContact}>
                    {t("rem.saveWhere")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-40 animate-pulse rounded-2xl bg-surface" />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.length ? (
              <ul className="space-y-2">
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <span className="flex shrink-0 gap-0.5">
                      {group.channels.map((channel) => (
                        <ChannelIcon key={channel} channel={channel} className="size-5" />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-navy-900">{group.name}</span>
                      <span className="block text-[11px] text-gray-500">
                        {group.mode === "before"
                          ? t("rem.beforeSummary", { days: group.offset_days, time: timeHm(group.at_time) })
                          : t("rem.atSummary")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(group.id)}
                      className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-surface hover:text-red-600"
                    >
                      {t("common.delete")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-gray-300 bg-surface px-4 py-3 text-sm leading-6 text-gray-500">
                {t("rem.noGroups")}
              </p>
            )}

            <div className="rounded-2xl border border-gray-200 bg-surface/80 p-4">
              <p className="mb-3 text-sm font-bold text-navy-900">{t("rem.newGroup")}</p>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("rem.groupName")}
                className="mb-3"
              />
              <SpecFields draft={spec} onChange={setSpec} system={system} />
              <div className="mt-4 flex justify-end">
                <Button type="button" size="sm" loading={saving} disabled={!name.trim()} onClick={addGroup}>
                  {t("rem.createGroup")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <Paywall open={paywall} onClose={() => setPaywall(false)} />
    </>
  );
}

function ChannelRow({
  icon,
  label,
  hint,
  children,
}: {
  icon: "email" | "telegram" | "whatsapp" | "sms";
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          <ChannelIcon channel={icon} className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm font-semibold text-navy-900">{label}</p>
          {children}
          {hint ? <p className="mt-1.5 text-[11px] leading-5 text-gray-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
