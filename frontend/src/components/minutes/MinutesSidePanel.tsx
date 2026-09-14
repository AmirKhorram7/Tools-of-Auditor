"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button, cx } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MinutesCompany, MinutesGroup, MinutesInvitation, MinutesMeeting } from "@/lib/minutes";

const STORAGE_KEY = "ta_minutes_panel_open";

function readOpenState(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export default function MinutesSidePanel() {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const [open, setOpen] = useState(true);
  const [companies, setCompanies] = useState<MinutesCompany[]>([]);
  const [groups, setGroups] = useState<MinutesGroup[]>([]);
  const [meetings, setMeetings] = useState<MinutesMeeting[]>([]);
  const [invites, setInvites] = useState<MinutesInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    setOpen(readOpenState());
  }, []);

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRows, groupRows, meetingRows, inviteRows] = await Promise.all([
        apiList<MinutesCompany>("/minutes/companies/"),
        apiList<MinutesGroup>("/minutes/groups/"),
        apiList<MinutesMeeting>("/minutes/meetings/"),
        apiList<MinutesInvitation>("/minutes/invitations/"),
      ]);
      setCompanies(companyRows);
      setGroups(groupRows);
      setMeetings(meetingRows.slice(0, 8));
      setInvites(inviteRows.filter((row) => row.status === "pending"));
    } catch {
      setCompanies([]);
      setGroups([]);
      setMeetings([]);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (id: number, accept: boolean) => {
    setBusyId(id);
    try {
      await apiFetch(`/minutes/invitations/${id}/${accept ? "accept" : "reject"}/`, {
        method: "POST",
      });
      await load();
    } catch {
      /* keep list */
    } finally {
      setBusyId(null);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="sticky top-28 z-30 hidden h-[calc(100vh-8rem)] w-10 shrink-0 flex-col items-center gap-3 rounded-xl bg-navy-900 py-4 text-white shadow-md transition hover:bg-navy-800 md:flex"
        title={t("nav.showTools")}
        dir={dir}
      >
        <span className="text-sm leading-none">‹</span>
        {invites.length > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-ink">
            {invites.length > 9 ? "9+" : invites.length}
          </span>
        )}
        <span
          className="text-[11px] font-medium tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {t("nav.tools")}
        </span>
      </button>
    );
  }

  return (
    <aside
      className="sticky top-28 z-30 hidden h-[calc(100vh-8rem)] w-56 shrink-0 flex-col overflow-hidden rounded-xl bg-navy-900 text-white shadow-md md:flex"
      dir={dir}
    >
      <div className="flex items-center justify-between border-b border-navy-700 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{t("nav.tools")}</p>
          <p className="text-[11px] text-gray-400">{t("minutes.title")}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md px-2 py-1 text-xs text-gray-300 transition hover:bg-navy-700 hover:text-white"
        >
          {t("nav.hideTools")} ›
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("nav.services")}
          </p>
          <Link
            href="/work"
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-200 transition hover:bg-navy-800"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px] font-bold">
              {t("work.workLetter")}
            </span>
            <span className="min-w-0 flex-1">{t("nav.work")}</span>
          </Link>
          <Link
            href="/explanation"
            className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-200 transition hover:bg-navy-800"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px] font-bold">
              {t("work.expLetter")}
            </span>
            <span className="min-w-0 flex-1">{t("nav.explanation")}</span>
          </Link>
          <Link
            href="/minutes"
            className={cx(
              "mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              pathname.startsWith("/minutes")
                ? "bg-navy-700 font-medium text-white"
                : "text-gray-200 hover:bg-navy-800",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-500 text-[11px] font-bold text-ink">
              {t("minutes.letter")}
            </span>
            <span className="min-w-0 flex-1">{t("nav.minutes")}</span>
          </Link>
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {t("minutes.inbox")}
            </p>
            {invites.length > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink">
                {invites.length}
              </span>
            )}
          </div>
          {loading ? (
            <p className="px-2 py-2 text-xs text-gray-500">{t("common.loading")}</p>
          ) : invites.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500">{t("minutes.noInvites")}</p>
          ) : (
            <ul className="space-y-2">
              {invites.slice(0, 4).map((invite) => (
                <li key={invite.id} className="rounded-lg bg-navy-800 px-2.5 py-2">
                  <p className="text-xs font-semibold text-white">{invite.group_name}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    {t("minutes.fromBy", { name: invite.invited_by_name })}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      className="!px-2 !py-1 text-[11px]"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      {t("minutes.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!px-2 !py-1 text-[11px]"
                      onClick={() => respond(invite.id, false)}
                    >
                      {t("minutes.reject")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("minutes.companies")}
          </p>
          {companies.slice(0, 6).map((company) => (
            <Link
              key={company.id}
              href={`/minutes/companies/${company.id}`}
              className={cx(
                "block truncate rounded-lg px-2.5 py-1.5 text-xs transition",
                pathname === `/minutes/companies/${company.id}`
                  ? "bg-brand-500 font-medium text-ink"
                  : "text-gray-200 hover:bg-navy-800",
              )}
            >
              {company.name}
            </Link>
          ))}
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("minutes.groups")}
          </p>
          {groups.slice(0, 8).map((group) => (
            <Link
              key={group.id}
              href={`/minutes/groups/${group.id}`}
              className={cx(
                "flex items-center justify-between gap-1 rounded-lg px-2.5 py-1.5 text-xs transition",
                pathname === `/minutes/groups/${group.id}`
                  ? "bg-brand-500 font-medium text-ink"
                  : "text-gray-200 hover:bg-navy-800",
              )}
            >
              <span className="min-w-0 truncate">{group.name}</span>
              {group.is_default ? <span>⭐</span> : null}
            </Link>
          ))}
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {t("minutes.meetings")}
          </p>
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/minutes/meetings/${meeting.id}`}
              className={cx(
                "block truncate rounded-lg px-2.5 py-1.5 text-xs transition",
                pathname === `/minutes/meetings/${meeting.id}`
                  ? "bg-brand-500 font-medium text-ink"
                  : "text-gray-200 hover:bg-navy-800",
              )}
            >
              {meeting.name} #{meeting.meeting_number}
            </Link>
          ))}
        </section>
      </div>
    </aside>
  );
}
