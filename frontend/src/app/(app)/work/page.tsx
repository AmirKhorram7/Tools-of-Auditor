"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  cx,
} from "@/components/ui";
import ProgressGauge from "@/components/work/ProgressGauge";
import TaskCard from "@/components/work/TaskCard";
import WeekStrip from "@/components/work/WeekStrip";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkGuide from "@/components/work/WorkGuide";
import WorkPhotoCard from "@/components/work/WorkPhotoCard";
import WorkSection from "@/components/work/WorkSection";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  workCompanyPhoto,
  type WorkCompany,
  type WorkDashboard,
  type WorkInvitation,
  type WorkProject,
  type WorkTask,
  type WorkTeam,
} from "@/lib/work";

export default function WorkHomePage() {
  const { t, n } = useI18n();
  const [data, setData] = useState<WorkDashboard | null>(null);
  const [companies, setCompanies] = useState<WorkCompany[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [invites, setInvites] = useState<WorkInvitation[]>([]);
  const [allTasks, setAllTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, companyRows, teamRows, projectRows, inbox, taskRows] = await Promise.all([
        apiFetch<WorkDashboard>("/work/dashboard/"),
        apiList<WorkCompany>("/work/companies/"),
        apiList<WorkTeam>("/work/teams/"),
        apiList<WorkProject>("/work/projects/"),
        apiList<WorkInvitation>("/work/invitations/"),
        apiList<WorkTask>("/work/tasks/"),
      ]);
      setData(dash);
      setCompanies(companyRows);
      setTeams(teamRows);
      setProjects(projectRows);
      setInvites(inbox.filter((row) => row.status === "pending"));
      setAllTasks(taskRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadHomeFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const createCompany = async () => {
    if (!companyName.trim()) {
      setFormError(t("work.companyRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/work/companies/", {
        method: "POST",
        body: { name: companyName.trim() },
      });
      setCompanyOpen(false);
      setCompanyName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.companyFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const counts = data?.employee.counts;
  const manager = data?.manager;
  const myTasks = data?.employee.assigned || [];
  const weekTasks = [
    ...(data?.employee.assigned || []),
    ...(data?.employee.today || []),
    ...(data?.employee.overdue || []),
  ];

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <WorkBreadcrumb fallbackHref="/dashboard" items={[{ label: t("work.crumb") }]} />
          <h1 className="text-base font-bold text-ink">{t("work.title")}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkGuide compact icon />
          <Link href="/work/inbox">
            <Button variant="secondary" size="sm">
              {t("work.inbox")}
              {invites.length > 0 ? ` (${n(invites.length)})` : ""}
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCompanyOpen(true)}>
            + {t("work.newCompany")}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invites.length > 0 && (
        <Link
          href="/work/inbox"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-ink"
        >
          <span>{t("work.pendingInvites", { count: n(invites.length) })}</span>
          <span className="shrink-0 font-semibold text-navy-800">{t("work.seeAccept")}</span>
        </Link>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-ink">{t("work.companies")}</h2>
        {companies.length === 0 ? (
          <EmptyState
            title={t("work.noCompanyTitle")}
            description={t("work.noCompanyDesc")}
            action={
              <Button size="sm" onClick={() => setCompanyOpen(true)}>
                {t("work.firstCompany")}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            {companies.map((company) => {
              const companyTeams = teams.filter((row) => row.company === company.id);
              const projectCount = projects.filter((row) => row.company === company.id).length;
              const teamNames = companyTeams.map((row) => row.name).join(" · ");
              return (
                <WorkPhotoCard
                  key={company.id}
                  href={`/work/companies/${company.id}`}
                  imageSrc={workCompanyPhoto(company.id)}
                  className="w-full max-w-[22.5rem]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{company.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500 group-hover:text-navy-800">
                      {teamNames || t("work.noTeamEmpty")}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-navy-800">
                      {t("work.companyCardMeta", {
                        teams: n(companyTeams.length),
                        projects: n(projectCount),
                      })}
                    </p>
                  </div>
                </WorkPhotoCard>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0">
          <WorkSection id="week" title={t("work.myWeek")} hint={t("work.myWeekHint")}>
            <WeekStrip tasks={weekTasks} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label={t("work.openTasks")} value={n(counts?.assigned ?? 0)} />
              <MiniStat label={t("work.today")} value={n(counts?.today ?? 0)} />
              <MiniStat label={t("work.overdue")} value={n(counts?.overdue ?? 0)} danger />
            </div>
          </WorkSection>
        </div>

        <div className="min-w-0">
          <WorkSection id="my-tasks" title={t("work.myTasks")} count={myTasks.length}>
            {myTasks.length === 0 ? (
              <div className="px-1 py-8 text-center">
                <p className="text-sm font-medium text-ink">{t("work.noAssignedTitle")}</p>
                <p className="mt-1 text-[12px] leading-6 text-gray-500">{t("work.noAssignedDesc")}</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {myTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    href={`/work/projects/${task.project_id}`}
                    columnName={task.project_name}
                    task={{
                      id: task.id,
                      title: task.title,
                      status: task.status,
                      due_date: task.due_date,
                      progress_percent: task.progress_percent,
                    }}
                  />
                ))}
              </div>
            )}
          </WorkSection>
        </div>
      </div>

      {manager && manager.at_risk.length > 0 && (
        <WorkSection id="risk" title={t("work.riskProjects")} count={manager.at_risk.length}>
          <WorkTable
            compact
            columns={[
              t("work.colProject"),
              t("work.colLate"),
              t("work.colBlocked"),
              t("work.colSoon"),
              t("work.unassigned"),
              t("work.colProgress"),
            ]}
          >
            {manager.at_risk.map((project) => (
              <tr key={project.id} className="hover:bg-surface">
                <WorkTd>
                  <Link
                    href={`/work/projects/${project.id}`}
                    className="font-semibold text-navy-900 hover:text-link"
                  >
                    {project.name}
                  </Link>
                </WorkTd>
                <WorkTd className={(project.overdue_count || 0) > 0 ? "font-bold text-red-600" : ""}>
                  {n(project.overdue_count || 0)}
                </WorkTd>
                <WorkTd>{n(project.blocked_count || 0)}</WorkTd>
                <WorkTd>{n(project.due_soon_count || 0)}</WorkTd>
                <WorkTd>{n(project.unassigned_count || 0)}</WorkTd>
                <WorkTd>
                  <ProgressGauge value={project.progress_percent} size={42} />
                </WorkTd>
              </tr>
            ))}
          </WorkTable>
        </WorkSection>
      )}

      {manager &&
        (manager.projects.length === 0 ? (
          <EmptyState
            title={t("work.noWorkProjectTitle")}
            description={t("work.noWorkProjectDesc")}
          />
        ) : (
          <WorkSection id="projects" title={t("work.projects")} count={manager.projects.length}>
            <WorkTable
              compact
              columns={[
                t("work.colProject"),
                t("work.colLate"),
                t("work.colBlocked"),
                t("work.unassigned"),
                t("work.colProgress"),
              ]}
            >
              {manager.projects.map((project) => (
                <tr key={project.id} className="hover:bg-surface">
                  <WorkTd>
                    <Link
                      href={`/work/projects/${project.id}`}
                      className="font-semibold text-navy-900 hover:text-link"
                    >
                      {project.name}
                    </Link>
                  </WorkTd>
                  <WorkTd className={project.overdue_count > 0 ? "font-bold text-red-600" : ""}>
                    {n(project.overdue_count)}
                  </WorkTd>
                  <WorkTd>{n(project.blocked_count)}</WorkTd>
                  <WorkTd>{n(project.unassigned_count)}</WorkTd>
                  <WorkTd>
                    <ProgressGauge value={project.progress_percent} size={42} />
                  </WorkTd>
                </tr>
              ))}
            </WorkTable>
          </WorkSection>
        ))}

      {manager && manager.workload.length > 0 && (
        <WorkSection id="workload" title={t("work.workload")} count={manager.workload.length}>
          <WorkTable compact columns={[t("work.person"), t("work.openTasks")]}>
            {manager.workload.map((row) => (
              <tr key={row.user_id}>
                <WorkTd className="font-medium text-ink">{row.name}</WorkTd>
                <WorkTd>{n(row.open_tasks)}</WorkTd>
              </tr>
            ))}
          </WorkTable>
        </WorkSection>
      )}

      {manager && (
        <WorkSection
          id="all-tasks"
          title={t("work.taskCards")}
          count={allTasks.length}
          defaultOpen={false}
        >
          {allTasks.length === 0 ? (
            <EmptyState title={t("work.noTaskTitle")} description={t("work.noTaskDesc")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {allTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </WorkSection>
      )}

      <Modal
        open={companyOpen}
        title={t("work.newCompany")}
        onClose={() => setCompanyOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.companyName")}>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("work.companyPlaceholder")}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompanyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createCompany}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/[0.05] bg-white px-2.5 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={cx("mt-0.5 text-lg font-bold", danger ? "text-red-600" : "text-ink")}>
        {value}
      </p>
    </div>
  );
}
