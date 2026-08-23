"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  notificationHref,
  workInviteStatusLabel,
  type WorkInvitation,
  type WorkNotification,
  type WorkTimeline,
  type WorkTimelineItem,
} from "@/lib/work";

type Tab = "notes" | "invites" | "activity";

export default function WorkInboxPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("notes");
  const [invites, setInvites] = useState<WorkInvitation[]>([]);
  const [notes, setNotes] = useState<WorkNotification[]>([]);
  const [activity, setActivity] = useState<WorkTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inbox, notifications, timeline] = await Promise.all([
        apiList<WorkInvitation>("/work/invitations/"),
        apiList<WorkNotification>("/work/notifications/"),
        apiFetch<WorkTimeline>("/work/dashboard/timeline/"),
      ]);
      setInvites(inbox);
      setNotes(notifications);
      setActivity(timeline.activity || timeline.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadInboxFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: number, accept: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/work/invitations/${id}/${accept ? "accept" : "reject"}/`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.inviteFail"));
    } finally {
      setBusyId(null);
    }
  };

  const markRead = async (note: WorkNotification) => {
    if (note.is_read) return;
    try {
      await apiFetch(`/work/notifications/${note.id}/read/`, { method: "POST" });
      setNotes((rows) =>
        rows.map((row) => (row.id === note.id ? { ...row, is_read: true } : row)),
      );
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await apiFetch("/work/notifications/read-all/", { method: "POST" });
      setNotes((rows) => rows.map((row) => ({ ...row, is_read: true })));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.markFail"));
    } finally {
      setMarking(false);
    }
  };

  if (loading) return <PageLoader />;

  const pending = invites.filter((row) => row.status === "pending");
  const unread = notes.filter((row) => !row.is_read).length;

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref="/work"
        items={[{ href: "/work", label: t("work.crumb") }, { label: t("work.inbox") }]}
      />
      <div>
        <h1 className="text-lg font-bold text-ink">{t("work.inboxAndActivity")}</h1>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-2 overflow-x-auto">
        <TabBtn
          active={tab === "notes"}
          onClick={() => setTab("notes")}
          label={unread > 0 ? `${t("work.tab.notes")} (${unread})` : t("work.tab.notes")}
        />
        <TabBtn
          active={tab === "invites"}
          onClick={() => setTab("invites")}
          label={
            pending.length > 0
              ? `${t("work.tab.invites")} (${pending.length})`
              : t("work.tab.invites")
          }
        />
        <TabBtn
          active={tab === "activity"}
          onClick={() => setTab("activity")}
          label={t("work.tab.activity")}
        />
      </div>

      {tab === "invites" && (
        <section className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState
              title={t("work.noOpenInvite")}
              description={t("work.noOpenInviteDesc")}
            />
          ) : (
            pending.map((invite) => (
              <Card key={invite.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{invite.team_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t("work.fromParty", { name: invite.invited_by_name })}
                      {invite.position_title ? ` · ${invite.position_title}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, false)}
                    >
                      {t("work.reject")}
                    </Button>
                    <Button
                      size="sm"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      {t("work.accept")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
          {invites.some((row) => row.status !== "pending") && (
            <p className="text-xs text-gray-400">
              {t("work.previous")}:{" "}
              {invites
                .filter((row) => row.status !== "pending")
                .slice(0, 4)
                .map(
                  (row) =>
                    `${row.team_name} (${workInviteStatusLabel(t, row.status) || row.status})`,
                )
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      {tab === "notes" && (
        <section className="space-y-3">
          {unread > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" loading={marking} onClick={markAll}>
                {t("work.markAllReadAlt")}
              </Button>
            </div>
          )}
          {notes.length === 0 ? (
            <EmptyState title={t("work.noNotes")} description={t("work.noNotesDesc")} />
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={notificationHref(note)}
                    onClick={() => markRead(note)}
                    className={`block rounded-xl border p-3 shadow-sm transition hover:border-brand-500 ${
                      note.is_read
                        ? "border-gray-200 bg-white"
                        : "border-brand-200 bg-brand-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{note.title}</p>
                      {!note.is_read && <Badge tone="amber">{t("work.newBadge")}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{note.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "activity" && (
        <section>
          {activity.length === 0 ? (
            <EmptyState title={t("work.noActivityYet")} description={t("work.noActivityDesc")} />
          ) : (
            <ul className="space-y-2">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link
                    href={notificationHref(item)}
                    className="block rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-brand-500"
                  >
                    <p className="text-sm font-semibold text-ink">{item.title}</p>
                    <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function TabBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${
        active
          ? "border-brand-500 bg-brand-500 font-semibold text-ink"
          : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
