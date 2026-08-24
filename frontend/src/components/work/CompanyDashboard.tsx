"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Avatar, Badge, Button, EmptyState, Input, cx } from "@/components/ui";
import ProgressBar from "@/components/work/ProgressBar";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { useI18n } from "@/lib/i18n";
import {
  daysUntil,
  formatWorkDate,
  relativeFromNow,
  teamInitials,
  workPriorityLabel,
  workProjectStatusLabel,
  type WorkCompany,
  type WorkProject,
  type WorkTeam,
} from "@/lib/work";

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 18.2C2.5 15.8 5.3 14 8 14s5.5 1.8 5.5 4.2V19H2.5v-.8Zm11.7-.2c.4-1.5 1.8-2.7 3.8-3.3 1.6-.5 3.5-.3 4.7.4.4.3.8.7 1 .1V19h-9.5v-1Z" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <path d="M4 19V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4 16.5 9 12l3.5 3 7.5-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.2 12.3 11 15l4.8-5.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.2L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path
        d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path
        d="M13.4 5.6 18.4 10.6 8 21H3v-5L13.4 5.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11.6 7.4 16.6 12.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 7v11.5A1.5 1.5 0 0 0 8.5 20h7a1.5 1.5 0 0 0 1.5-1.5V7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPlusUser() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 18.2C3.5 15.7 5.9 14 9 14s5.5 1.7 5.5 4.2V19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.5 10v6M14.5 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function priorityDot(priority: number) {
  if (priority >= 4) return "bg-red-500";
  if (priority === 3) return "bg-orange-500";
  if (priority === 2) return "bg-brand-500";
  return "bg-gray-400";
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-black/[0.05] bg-white px-3 py-1.5 shadow-[0_1px_3px_rgba(20,35,58,0.06)]">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF3FA] text-navy-800 [&>svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0">
        <p className={cx("text-base font-bold leading-none", valueClass ?? "text-ink")}>{value}</p>
        <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function CompanyDashboard({
  company,
  teams,
  projects,
  query,
  onQuery,
  policyBusy,
  busyId,
  onTogglePolicy,
  onAddTeam,
  onEditProject,
  onDeleteProject,
}: {
  company: WorkCompany;
  teams: WorkTeam[];
  projects: WorkProject[];
  query: string;
  onQuery: (value: string) => void;
  policyBusy?: boolean;
  busyId?: number | null;
  onTogglePolicy: () => void;
  onAddTeam: () => void;
  onEditProject: (project: WorkProject) => void;
  onDeleteProject: (project: WorkProject) => void;
}) {
  const { t, n, locale, dir } = useI18n();
  const policyOn = Boolean(company.require_approval_before_close);
  const activeProjects = projects.filter(
    (row) => row.status !== "completed" && row.status !== "cancelled",
  );
  const avg =
    projects.length === 0
      ? 0
      : Math.round(
          projects.reduce((sum, row) => sum + (row.progress_percent || 0), 0) / projects.length,
        );
  const featured =
    [...teams].sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))[0] ?? null;
  const filtered = projects.filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const lastChange = relativeFromNow(company.updated_at);
  const lastChangeLabel = lastChange
    ? lastChange.kind === "now"
      ? t("work.justNow")
      : t("work.daysAgo", { count: n(lastChange.days) })
    : "";
  const pct = (value: number) => (locale === "en" ? `${n(value)}%` : `${n(value)}٪`);

  const dueHint = (due: string | null) => {
    const days = daysUntil(due);
    if (days === null) return { text: t("work.noDue"), tone: "text-gray-400" };
    if (days === 0) return { text: t("work.dueToday"), tone: "text-brand-700" };
    if (days > 0) {
      return {
        text: t("work.dueInDays", { count: n(days) }),
        tone: days <= 7 ? "text-brand-700" : "text-gray-500",
      };
    }
    return { text: t("work.dueOverdue", { count: n(Math.abs(days)) }), tone: "text-red-600" };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("work.activeProjects")}
          value={n(activeProjects.length)}
          icon={<IconGrid />}
        />
        <StatCard label={t("work.teams")} value={n(teams.length)} icon={<IconPeople />} />
        <StatCard label={t("work.avgProgress")} value={pct(avg)} icon={<IconChart />} />
        <StatCard
          label={t("work.policyShort")}
          value={policyOn ? t("work.policyOnWord") : t("work.policyOffWord")}
          icon={<IconCheck />}
          valueClass={policyOn ? "text-green-600" : "text-gray-500"}
        />
      </div>

      <div className="grid shrink-0 gap-2 lg:h-[7.25rem] lg:grid-cols-2" dir="ltr">
        <section
          dir={dir}
          className="flex overflow-hidden rounded-xl border border-black/[0.05] bg-white shadow-[0_1px_3px_rgba(20,35,58,0.06)]"
        >
          <div className="relative w-[8.5rem] shrink-0 bg-[#1A2B49] sm:w-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/work/team-banner.jpg"
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-[#14233A]/35" />
            {featured && (
              <span className="absolute start-1.5 top-1.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-navy-800">
                {t("work.activeTeam")}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center p-2">
            {featured ? (
              <>
                <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
                  {teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/work/teams/${team.id}`}
                      className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-navy-900 text-[10px] font-bold text-white">
                        {teamInitials(team.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-ink">{team.name}</span>
                        <span className="block truncate text-[10px] text-gray-500">
                          {t("work.teamMeta", {
                            members: n(team.member_count ?? 0),
                            projects: n(team.project_count ?? 0),
                          })}
                        </span>
                      </span>
                      {(team.id === featured.id ? featured.preview_members : null)?.length ? (
                        <span className="hidden -space-x-1.5 space-x-reverse sm:flex">
                          {featured.preview_members!.slice(0, 3).map((member) => (
                            <Avatar
                              key={member.id}
                              src={member.profile_image}
                              name={member.full_name}
                              size={20}
                              className="ring-1 ring-white"
                            />
                          ))}
                        </span>
                      ) : null}
                    </Link>
                  ))}
                </div>
                {company.can_manage && (
                  <button
                    type="button"
                    onClick={onAddTeam}
                    className="mt-1 inline-flex items-center justify-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-navy-800 hover:bg-surface"
                  >
                    <IconPlusUser />
                    + {t("work.addNewTeam")}
                  </button>
                )}
              </>
            ) : (
              <div className="px-1">
                <p className="text-xs font-bold text-ink">{t("work.noTeamTitle")}</p>
                <p className="mt-0.5 text-[11px] text-gray-500">{t("work.noTeamDesc")}</p>
                <Button size="sm" className="mt-1.5" onClick={onAddTeam}>
                  {t("work.createTeam")}
                </Button>
              </div>
            )}
          </div>
        </section>

        <section
          dir={dir}
          className="flex flex-col justify-center rounded-xl border border-black/[0.05] bg-white px-3 py-2 shadow-[0_1px_3px_rgba(20,35,58,0.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-ink">
              <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
              <span className="truncate">{t("work.companyPolicy")}</span>
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cx(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  policyOn ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600",
                )}
              >
                {policyOn ? t("work.policyActive") : t("work.policyOffWord")}
              </span>
              <button
                type="button"
                disabled={!company.can_manage || policyBusy}
                onClick={onTogglePolicy}
                className="disabled:opacity-70"
                aria-pressed={policyOn}
                aria-label={policyOn ? t("work.policyIsOn") : t("work.policyIsOff")}
              >
                <span
                  className={cx(
                    "relative block h-6 w-11 rounded-full transition",
                    policyOn ? "bg-green-500" : "bg-gray-300",
                  )}
                >
                  <span
                    className={cx(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition",
                      policyOn ? "end-0.5" : "start-0.5",
                    )}
                  />
                </span>
              </button>
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-gray-600">
            <span className="font-bold text-ink">{t("work.policyTwoStep")}. </span>
            {t("work.policyBody")}
          </p>
          {lastChangeLabel && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
              <IconClock />
              {t("work.policyLastChange", { when: lastChangeLabel })}
            </p>
          )}
        </section>
      </div>

      <section className="flex min-h-0 flex-1 flex-col gap-1.5">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="size-1.5 rounded-full bg-brand-500" />
            {t("work.workProjects")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M16 16.5 20 20.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <Input
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder={t("work.searchProject")}
                className="h-8 w-44 rounded-full py-1 ps-8 text-sm"
              />
            </div>
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
              {t("work.resultCount", { count: n(filtered.length) })}
            </span>
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title={t("work.noProjectTitle")}
            description={t("work.noProjectDesc")}
          />
        ) : (
          <WorkTable
            compact
            className="min-h-0 flex-1 overflow-auto"
            columns={[
              t("work.colProject"),
              t("common.status"),
              t("work.colProgress"),
              t("work.priority"),
              t("work.due"),
              t("work.colActions"),
            ]}
          >
            {filtered.map((project) => {
              const hint = dueHint(project.due_date);
              const teamLine = project.team_names?.filter(Boolean).join(" · ");
              return (
                <tr key={project.id} className="hover:bg-surface">
                  <WorkTd>
                    <Link
                      href={`/work/projects/${project.id}`}
                      className="flex items-center gap-2"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-navy-900 text-white [&>svg]:size-3.5">
                        <IconGrid />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-navy-900">
                          {project.name} — {t("work.boardLink")}
                        </span>
                        {teamLine && (
                          <span className="block truncate text-[11px] text-gray-500">{teamLine}</span>
                        )}
                      </span>
                    </Link>
                  </WorkTd>
                  <WorkTd>
                    <Badge tone="blue">
                      {workProjectStatusLabel(t, project.status) || project.status}
                    </Badge>
                  </WorkTd>
                  <WorkTd>
                    <div className="flex min-w-24 items-center gap-2">
                      <ProgressBar value={project.progress_percent} className="w-20" />
                      <span className="text-xs text-gray-500">{pct(project.progress_percent)}</span>
                    </div>
                  </WorkTd>
                  <WorkTd>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={cx("size-1.5 rounded-full", priorityDot(project.priority))} />
                      {workPriorityLabel(t, project.priority)}
                    </span>
                  </WorkTd>
                  <WorkTd>
                    <span className="block text-sm text-ink">
                      {formatWorkDate(project.due_date, locale, t("work.noDue"))}
                    </span>
                    {project.due_date && (
                      <span className={cx("block text-[11px]", hint.tone)}>{hint.text}</span>
                    )}
                  </WorkTd>
                  <WorkTd>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/work/projects/${project.id}`}
                        className="rounded-md p-1.5 text-gray-500 hover:bg-surface hover:text-navy-800"
                        title={t("work.viewProject")}
                        aria-label={t("work.viewProject")}
                      >
                        <IconEye />
                      </Link>
                      {project.can_manage && (
                        <button
                          type="button"
                          onClick={() => onEditProject(project)}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-surface hover:text-navy-800"
                          title={t("work.editProject")}
                          aria-label={t("work.editProject")}
                        >
                          <IconPencil />
                        </button>
                      )}
                      {project.can_manage && (
                        <button
                          type="button"
                          disabled={busyId === project.id}
                          onClick={() => onDeleteProject(project)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title={t("work.deleteProject")}
                          aria-label={t("work.deleteProject")}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  </WorkTd>
                </tr>
              );
            })}
          </WorkTable>
        )}
      </section>
    </div>
  );
}
