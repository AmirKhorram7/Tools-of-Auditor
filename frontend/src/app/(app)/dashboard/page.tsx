"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import ProductDemos from "@/components/dashboard/ProductDemos";
import { Alert, Button, Modal } from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { displayName, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { MinutesInvitation } from "@/lib/minutes";
import type { WorkDashboard, WorkInvitation } from "@/lib/work";

type HomeInvite = {
  key: string;
  kind: "work" | "minutes";
  id: number;
  title: string;
  from: string;
};

type InviteTab = "all" | "work" | "minutes";

const TOOLS = [
  { href: "/work", titleKey: "dash.enterWork", blurbKey: "dash.workBlurb", icon: "work" },
  { href: "/minutes", titleKey: "dash.enterMinutes", blurbKey: "dash.minutesBlurb", icon: "minutes" },
  { href: "/daybook", titleKey: "dash.enterDaybook", blurbKey: "dash.daybookBlurb", icon: "daybook" },
  { href: "/explanation", titleKey: "dash.enterExplanation", blurbKey: "dash.explanationBlurb", icon: "docs" },
  { href: "/knowledge", titleKey: "dash.enterKnowledge", blurbKey: "dash.knowledgeBlurb", icon: "knowledge" },
  { href: "/education", titleKey: "dash.enterEducation", blurbKey: "dash.educationBlurb", icon: "learn" },
] as const;

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t, n, locale } = useI18n();
  const [workInvites, setWorkInvites] = useState<WorkInvitation[]>([]);
  const [minutesInvites, setMinutesInvites] = useState<MinutesInvitation[]>([]);
  const [board, setBoard] = useState<WorkDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tab, setTab] = useState<InviteTab>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workRows, minuteRows, home] = await Promise.all([
        apiList<WorkInvitation>("/work/invitations/").catch(() => [] as WorkInvitation[]),
        apiList<MinutesInvitation>("/minutes/invitations/?scope=inbox").catch(
          () => [] as MinutesInvitation[],
        ),
        apiFetch<WorkDashboard>("/work/dashboard/").catch(() => null),
      ]);
      setWorkInvites(workRows.filter((row) => row.status === "pending"));
      setMinutesInvites(minuteRows.filter((row) => row.status === "pending"));
      setBoard(home);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadInboxFail"));
      setWorkInvites([]);
      setMinutesInvites([]);
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const profileIncomplete =
    !profile?.first_name || !profile?.last_name || !profile?.company_name;

  useEffect(() => {
    if (!profile || !profileIncomplete) return;
    if (typeof window !== "undefined" && sessionStorage.getItem("ta_profile_nudge") === "1") {
      return;
    }
    setProfileOpen(true);
  }, [profile, profileIncomplete]);

  const invites = useMemo<HomeInvite[]>(() => {
    const work = workInvites.map((row) => ({
      key: `work-${row.id}`,
      kind: "work" as const,
      id: row.id,
      title: row.team_name,
      from: row.invited_by_name,
    }));
    const minutes = minutesInvites.map((row) => ({
      key: `minutes-${row.id}`,
      kind: "minutes" as const,
      id: row.id,
      title: row.group_name,
      from: row.invited_by_name,
    }));
    return [...work, ...minutes];
  }, [workInvites, minutesInvites]);

  const visibleInvites = tab === "all" ? invites : invites.filter((row) => row.kind === tab);

  const todayItems = useMemo(() => {
    if (!board) return [];
    const overdue = board.employee.overdue.map((row) => ({ ...row, late: true }));
    const due = board.employee.today.map((row) => ({ ...row, late: false }));
    const seen = new Set<number>();
    return [...overdue, ...due].filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).slice(0, 5);
  }, [board]);

  const recentItems = useMemo(
    () => (board?.timeline.activity ?? board?.timeline.items ?? []).slice(0, 5),
    [board],
  );

  const respond = async (invite: HomeInvite, accept: boolean) => {
    setBusyKey(invite.key);
    setError(null);
    try {
      const path =
        invite.kind === "work"
          ? `/work/invitations/${invite.id}/${accept ? "accept" : "reject"}/`
          : `/minutes/invitations/${invite.id}/${accept ? "accept" : "reject"}/`;
      await apiFetch(path, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("profile.inviteFail"));
    } finally {
      setBusyKey(null);
    }
  };

  const todayLabel = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Tehran",
  }).format(new Date());

  return (
    <div className="dash mx-auto max-w-[75rem] space-y-8 px-3 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs" style={{ color: "var(--d-muted)" }}>
            {todayLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[32px]">
            {t("dash.welcome", { name: displayName(profile) })}
          </h1>
          {profileIncomplete ? (
            <Link href="/profile" className="dash-link mt-2 inline-block">
              {t("dash.completeProfile")}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/work" className="dash-btn dash-btn-ghost">
            {t("work.newTask")}
          </Link>
          <Link href="/minutes" className="dash-btn dash-btn-primary">
            {t("minutes.newMeeting")}
          </Link>
        </div>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <aside className="dash-panel lg:col-span-4">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--d-border)" }}>
            <h2 className="text-sm font-semibold">{t("dash.invites")}</h2>
            {invites.length > 0 ? (
              <span className="text-xs font-semibold" style={{ color: "var(--d-muted)" }}>
                {n(invites.length)}
              </span>
            ) : null}
          </div>
          <div className="flex gap-1 px-3 pt-3">
            {(["all", "work", "minutes"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                className="dash-btn px-2.5 text-[11px]"
                style={{
                  background: tab === id ? "var(--d-raised)" : "transparent",
                  color: tab === id ? "var(--d-text)" : "var(--d-muted)",
                }}
                onClick={() => setTab(id)}
              >
                {id === "all" ? t("dash.inviteAll") : id === "work" ? t("dash.inviteWork") : t("dash.inviteMinutes")}
              </button>
            ))}
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto p-3">
            {loading ? (
              <div className="space-y-2 py-2">
                <div className="dash-bone w-2/3" />
                <div className="dash-bone w-full" />
                <div className="dash-bone w-1/2" />
              </div>
            ) : visibleInvites.length === 0 ? (
              <p className="px-1 py-8 text-center text-sm leading-6" style={{ color: "var(--d-muted)" }}>
                {t("dash.noInvites")}
              </p>
            ) : (
              visibleInvites.map((invite) => (
                <article key={invite.key} className="rounded-[8px] border p-3" style={{ borderColor: "var(--d-border)" }}>
                  <p className="text-[11px] font-semibold" style={{ color: "var(--d-muted)" }}>
                    {invite.kind === "work" ? t("dash.inviteWork") : t("dash.inviteMinutes")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{invite.title}</p>
                  <p className="text-xs" style={{ color: "var(--d-muted)" }}>
                    {t("minutes.fromBy", { name: invite.from })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="dash-btn dash-btn-solid min-h-11"
                      disabled={busyKey === invite.key}
                      onClick={() => respond(invite, true)}
                    >
                      {t("minutes.accept")}
                    </button>
                    <button
                      type="button"
                      className="dash-btn dash-btn-ghost min-h-11"
                      disabled={busyKey === invite.key}
                      onClick={() => respond(invite, false)}
                    >
                      {t("minutes.reject")}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3" style={{ borderColor: "var(--d-border)" }}>
            <Link href="/work/inbox" className="dash-link">
              {t("dash.seeWorkInbox")}
            </Link>
            <Link href="/minutes/inbox" className="dash-link">
              {t("dash.seeMinutesInbox")}
            </Link>
          </div>
        </aside>

        <div className="space-y-8 lg:col-span-8">
          <section>
            <h2 className="mb-3 text-xs font-semibold tracking-[0.14em]" style={{ color: "var(--d-faint)" }}>
              {t("dash.services")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOOLS.map((tool) => (
                <Link key={tool.href} href={tool.href} className="dash-card flex flex-col p-4">
                  <span className="dash-tile">
                    <ToolIcon name={tool.icon} />
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{t(tool.titleKey)}</h3>
                    <Chevron />
                  </span>
                  <p className="mt-1 text-xs leading-5" style={{ color: "var(--d-muted)" }}>
                    {t(tool.blurbKey)}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2">
            <WorkList
              title={t("dash.today")}
              empty={t("dash.noToday")}
              loading={loading}
              href="/work"
              more={t("dash.viewAll")}
              count={todayItems.length}
            >
              {todayItems.map((row) => (
                <WorkRow
                  key={row.id}
                  href={`/work/desks/${row.project_id}`}
                  title={row.title}
                  meta={row.project_name}
                  late={row.late}
                  lateLabel={t("dash.overdueTag")}
                />
              ))}
            </WorkList>
            <WorkList
              title={t("dash.recent")}
              empty={t("dash.noRecent")}
              loading={loading}
              href="/work"
              more={t("dash.viewAll")}
              count={recentItems.length}
            >
              {recentItems.map((row) => (
                <WorkRow
                  key={row.id}
                  href={row.project_id ? `/work/desks/${row.project_id}` : "/work"}
                  title={row.message || row.title}
                />
              ))}
            </WorkList>
          </section>
        </div>
      </div>

      <ProductDemos />

      <Modal
        open={profileOpen}
        title={t("dash.profileTitle")}
        onClose={() => {
          sessionStorage.setItem("ta_profile_nudge", "1");
          setProfileOpen(false);
        }}
      >
        <p className="text-sm text-gray-600">{t("dash.profileHint")}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              sessionStorage.setItem("ta_profile_nudge", "1");
              setProfileOpen(false);
            }}
          >
            {t("common.later")}
          </Button>
          <Link href="/profile" onClick={() => sessionStorage.setItem("ta_profile_nudge", "1")}>
            <Button>{t("dash.completeProfile")}</Button>
          </Link>
        </div>
      </Modal>
    </div>
  );
}

function WorkList({
  title,
  empty,
  loading,
  href,
  more,
  count,
  children,
}: {
  title: string;
  empty: string;
  loading: boolean;
  href: string;
  more: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="dash-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link href={href} className="dash-link">
          {more}
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="dash-bone w-5/6" />
          <div className="dash-bone w-3/5" />
          <div className="dash-bone w-4/5" />
        </div>
      ) : count === 0 ? (
        <p className="py-4 text-sm leading-6" style={{ color: "var(--d-muted)" }}>
          {empty}
        </p>
      ) : (
        <ul>{children}</ul>
      )}
    </section>
  );
}

function WorkRow({
  href,
  title,
  meta,
  late,
  lateLabel,
}: {
  href: string;
  title: string;
  meta?: string;
  late?: boolean;
  lateLabel?: string;
}) {
  return (
    <li className="border-t first:border-t-0" style={{ borderColor: "var(--d-border)" }}>
      <Link href={href} className="dash-row">
        <span className="min-w-0">
          <span className="block truncate text-sm">{title}</span>
          {meta ? (
            <span className="block truncate text-[11px]" style={{ color: "var(--d-muted)" }}>
              {meta}
            </span>
          ) : null}
        </span>
        {late ? (
          <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--d-danger)" }}>
            {lateLabel}
          </span>
        ) : (
          <Chevron />
        )}
      </Link>
    </li>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="dash-arrow size-4 shrink-0 rtl:-scale-x-100" fill="none" aria-hidden>
      <path d="M9 6.5 14.5 12 9 17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToolIcon({ name }: { name: (typeof TOOLS)[number]["icon"] }) {
  const paths: Record<(typeof TOOLS)[number]["icon"], string> = {
    work: "M8 8.5h8M7 8.5V7.2A1.7 1.7 0 0 1 8.7 5.5h6.6A1.7 1.7 0 0 1 17 7.2v1.3M5.5 8.5h13A1.5 1.5 0 0 1 20 10v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-8a1.5 1.5 0 0 1 1.5-1.5Z",
    minutes: "M8 4.5h8A2 2 0 0 1 18 6.5v13l-6-2.2-6 2.2v-13A2 2 0 0 1 8 4.5ZM9.5 9h5M9.5 12.5h5",
    daybook: "M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V6A1.5 1.5 0 0 1 7 4.5ZM8.5 9.5h7M8.5 13h5",
    docs: "M8 5.5h5.5L16.5 9v10A1.5 1.5 0 0 1 15 20.5H8A1.5 1.5 0 0 1 6.5 19V7A1.5 1.5 0 0 1 8 5.5ZM13.5 5.5V9h3.5M9 12.5h6M9 16h4",
    knowledge: "M6.5 6.5h5v12h-5A1.5 1.5 0 0 1 5 17V8a1.5 1.5 0 0 1 1.5-1.5ZM12.5 6.5h5A1.5 1.5 0 0 1 19 8v9a1.5 1.5 0 0 1-1.5 1.5h-5v-12Z",
    learn: "M4.5 9 12 5.5 19.5 9 12 12.5 4.5 9Zm0 0v6.5L12 19l7.5-3.5V9",
  };
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path d={paths[name]} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

