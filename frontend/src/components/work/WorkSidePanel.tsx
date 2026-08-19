"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button, cx } from "@/components/ui";
import { apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { WorkCompany, WorkInvitation, WorkProject, WorkTeam } from "@/lib/work";

const STORAGE_KEY = "ta_work_panel_open";

function readOpenState(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "1";
}

export default function WorkSidePanel() {
  const pathname = usePathname();
  const { dir } = useI18n();
  const [open, setOpen] = useState(true);
  const [companies, setCompanies] = useState<WorkCompany[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [invites, setInvites] = useState<WorkInvitation[]>([]);
  const [unread, setUnread] = useState(0);
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
      const [companyRows, projectRows, teamRows, inviteRows, count] = await Promise.all([
        apiList<WorkCompany>("/work/companies/"),
        apiList<WorkProject>("/work/projects/"),
        apiList<WorkTeam>("/work/teams/"),
        apiList<WorkInvitation>("/work/invitations/"),
        apiFetch<{ unread: number }>("/work/notifications/unread_count/"),
      ]);
      setCompanies(companyRows);
      setProjects(projectRows);
      setTeams(teamRows);
      setInvites(inviteRows.filter((row) => row.status === "pending"));
      setUnread(count.unread || 0);
    } catch {
      setCompanies([]);
      setProjects([]);
      setTeams([]);
      setInvites([]);
      setUnread(0);
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
      await apiFetch(`/work/invitations/${id}/${accept ? "accept" : "reject"}/`, {
        method: "POST",
      });
      await load();
    } catch {
      /* keep list */
    } finally {
      setBusyId(null);
    }
  };

  const badgeCount = invites.length + unread;

  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="sticky top-28 z-30 hidden h-[calc(100vh-8rem)] w-10 shrink-0 flex-col items-center gap-3 rounded-xl bg-navy-900 py-4 text-white shadow-md transition hover:bg-navy-800 md:flex"
        title="نمایش پنل ابزارها"
        dir={dir}
      >
        <span className="text-sm leading-none">‹</span>
        {badgeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-ink">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
        <span
          className="text-[11px] font-medium tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          ابزارها
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
          <p className="text-sm font-semibold text-white">ابزارها</p>
          <p className="text-[11px] text-gray-400">تی‌ادیتور</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-md px-2 py-1 text-xs text-gray-300 transition hover:bg-navy-700 hover:text-white"
        >
          پنهان ›
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            سرویس‌ها
          </p>
          <Link
            href="/work"
            className={cx(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
              pathname.startsWith("/work")
                ? "bg-navy-700 font-medium text-white"
                : "text-gray-200 hover:bg-navy-800",
            )}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-500 text-[11px] font-bold text-ink">
              ک
            </span>
            <span className="min-w-0 flex-1">مدیریت کار</span>
          </Link>
          <Link
            href="/explanation"
            className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-200 transition hover:bg-navy-800"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-navy-700 text-[11px] font-bold">
              ت
            </span>
            <span className="min-w-0 flex-1">تشریح سیستم</span>
          </Link>
        </section>

        <section>
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              دعوت‌ها
            </p>
            {invites.length > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink">
                {invites.length}
              </span>
            )}
          </div>
          {loading ? (
            <p className="px-2 py-2 text-xs text-gray-500">در حال بارگذاری...</p>
          ) : invites.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500">دعوت تازه‌ای نیست.</p>
          ) : (
            <ul className="space-y-2">
              {invites.slice(0, 4).map((invite) => (
                <li
                  key={invite.id}
                  className="rounded-lg bg-navy-800 px-2.5 py-2"
                >
                  <p className="text-xs font-semibold text-white">{invite.team_name}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">
                    از {invite.invited_by_name}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      size="sm"
                      className="!px-2 !py-1 text-[11px]"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, true)}
                    >
                      پذیرش
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="!px-2 !py-1 text-[11px]"
                      loading={busyId === invite.id}
                      onClick={() => respond(invite.id, false)}
                    >
                      رد
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/work/inbox"
            className={cx(
              "mt-2 flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition",
              pathname === "/work/inbox"
                ? "bg-brand-500 font-medium text-ink"
                : "text-gray-300 hover:bg-navy-700 hover:text-white",
            )}
          >
            <span>همه اعلان‌ها</span>
            {unread > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-ink">
                {unread}
              </span>
            )}
          </Link>
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            شرکت‌ها
          </p>
          {companies.length === 0 && !loading ? (
            <p className="px-2 py-2 text-xs text-gray-500">شرکتی نیست.</p>
          ) : (
            <ul className="space-y-1">
              {companies.map((company) => (
                <li key={company.id}>
                  <Link
                    href={`/work/companies/${company.id}`}
                    className={cx(
                      "block rounded-lg px-2.5 py-2 text-sm font-bold transition",
                      pathname === `/work/companies/${company.id}`
                        ? "bg-brand-500 text-ink"
                        : "bg-navy-800 text-white hover:bg-navy-700",
                    )}
                  >
                    {company.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            تیم‌ها
          </p>
          {teams.length === 0 && !loading ? (
            <p className="px-2 py-2 text-xs text-gray-500">تیمی نیست.</p>
          ) : (
            <ul className="space-y-0.5">
              {teams.slice(0, 10).map((team) => (
                <li key={team.id}>
                  <Link
                    href={`/work/teams/${team.id}`}
                    className={cx(
                      "block truncate rounded-md px-2 py-1.5 text-xs font-medium transition",
                      pathname === `/work/teams/${team.id}`
                        ? "bg-brand-500 font-bold text-ink"
                        : "text-gray-200 hover:bg-navy-700 hover:text-white",
                    )}
                  >
                    {team.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            پروژه‌ها
          </p>
          <Link
            href="/work"
            className={cx(
              "mb-1 block rounded-lg px-2.5 py-2 text-xs transition",
              pathname === "/work"
                ? "bg-brand-500 font-medium text-ink"
                : "text-gray-300 hover:bg-navy-700 hover:text-white",
            )}
          >
            پیشخوان
          </Link>
          {projects.length === 0 && !loading ? (
            <p className="px-2 py-2 text-xs text-gray-500">پروژه‌ای نیست.</p>
          ) : (
            <ul className="space-y-0.5">
              {projects.slice(0, 12).map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/work/projects/${project.id}`}
                    className={cx(
                      "block truncate rounded-md px-2 py-1.5 text-xs transition",
                      pathname === `/work/projects/${project.id}`
                        ? "bg-brand-500 font-medium text-ink"
                        : "text-gray-200 hover:bg-navy-700 hover:text-white",
                    )}
                  >
                    {project.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
