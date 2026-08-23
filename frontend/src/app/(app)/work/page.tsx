"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
} from "@/components/ui";
import ProgressGauge from "@/components/work/ProgressGauge";
import TaskCard from "@/components/work/TaskCard";
import WeekStrip from "@/components/work/WeekStrip";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkGuide from "@/components/work/WorkGuide";
import WorkSection from "@/components/work/WorkSection";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  type WorkCompany,
  type WorkDashboard,
  type WorkInvitation,
  type WorkTask,
} from "@/lib/work";

export default function WorkHomePage() {
  const { t } = useI18n();
  const [data, setData] = useState<WorkDashboard | null>(null);
  const [companies, setCompanies] = useState<WorkCompany[]>([]);
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
      const [dash, companyRows, inbox, taskRows] = await Promise.all([
        apiFetch<WorkDashboard>("/work/dashboard/"),
        apiList<WorkCompany>("/work/companies/"),
        apiList<WorkInvitation>("/work/invitations/"),
        apiList<WorkTask>("/work/tasks/"),
      ]);
      setData(dash);
      setCompanies(companyRows);
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
    <div className="space-y-4">
      <WorkBreadcrumb fallbackHref="/dashboard" items={[{ label: t("work.crumb") }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">{t("work.title")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <WorkGuide compact />
          <Link href="/work/inbox">
            <Button variant="secondary" size="sm">
              {t("work.inbox")}
              {invites.length > 0 ? ` (${invites.length})` : ""}
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCompanyOpen(true)}>
            {t("work.newCompany")}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invites.length > 0 && (
        <Card className="border-brand-200 bg-brand-50">
          <p className="text-sm font-medium text-ink">
            {t("work.pendingInvites", { count: invites.length })}
          </p>
          <Link href="/work/inbox" className="mt-3 inline-block">
            <Button size="sm">{t("work.seeAccept")}</Button>
          </Link>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{t("work.companies")}</h2>
          <Button size="sm" variant="secondary" onClick={() => setCompanyOpen(true)}>
            {t("common.add")}
          </Button>
        </div>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/work/companies/${company.id}`}
                className="group flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(26,43,73,0.05)] transition hover:border-navy-400 hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-sm font-bold text-white">
                  {company.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">{company.name}</span>
                  <span className="mt-0.5 block text-[11px] text-gray-500 group-hover:text-navy-800">
                    {t("work.teamsAndProjects")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <WorkSection
        id="week"
        title={t("work.myWeek")}
        hint={t("work.myWeekHint")}
      >
        <WeekStrip tasks={weekTasks} />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label={t("work.openTasks")} value={counts?.assigned ?? 0} />
          <Stat label={t("work.today")} value={counts?.today ?? 0} />
          <Stat label={t("work.overdue")} value={counts?.overdue ?? 0} danger />
        </div>
      </WorkSection>

      <WorkSection id="my-tasks" title={t("work.myTasks")} count={myTasks.length}>
        {myTasks.length === 0 ? (
          <EmptyState
            title={t("work.noAssignedTitle")}
            description={t("work.noAssignedDesc")}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

      {manager && (
        <WorkSection
          id="manager"
          title={t("work.managerReport")}
          hint={t("work.managerHint")}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t("work.unassigned")} value={manager.unassigned_count} />
            <Stat label={t("work.openInvites")} value={manager.pending_invites} />
            <Stat label={t("work.doneThisWeek")} value={manager.completed_this_week} />
            <Stat label={t("work.atRisk")} value={manager.at_risk.length} danger />
          </div>

          <div className="mt-3 space-y-3">
            {manager.at_risk.length > 0 && (
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
                        {project.overdue_count || 0}
                      </WorkTd>
                      <WorkTd>{project.blocked_count || 0}</WorkTd>
                      <WorkTd>{project.due_soon_count || 0}</WorkTd>
                      <WorkTd>{project.unassigned_count || 0}</WorkTd>
                      <WorkTd>
                        <ProgressGauge value={project.progress_percent} size={42} />
                      </WorkTd>
                    </tr>
                  ))}
                </WorkTable>
              </WorkSection>
            )}

            {manager.projects.length === 0 ? (
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
                        {project.overdue_count}
                      </WorkTd>
                      <WorkTd>{project.blocked_count}</WorkTd>
                      <WorkTd>{project.unassigned_count}</WorkTd>
                      <WorkTd>
                        <ProgressGauge value={project.progress_percent} size={42} />
                      </WorkTd>
                    </tr>
                  ))}
                </WorkTable>
              </WorkSection>
            )}

            {manager.workload.length > 0 && (
              <WorkSection id="workload" title={t("work.workload")} count={manager.workload.length}>
                <WorkTable compact columns={[t("work.person"), t("work.openTasks")]}>
                  {manager.workload.map((row) => (
                    <tr key={row.user_id}>
                      <WorkTd className="font-medium text-ink">{row.name}</WorkTd>
                      <WorkTd>{row.open_tasks}</WorkTd>
                    </tr>
                  ))}
                </WorkTable>
              </WorkSection>
            )}

            <WorkSection
              id="all-tasks"
              title={t("work.taskCards")}
              count={allTasks.length}
              defaultOpen={false}
            >
              {allTasks.length === 0 ? (
                <EmptyState
                  title={t("work.noTaskTitle")}
                  description={t("work.noTaskDesc")}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {allTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </WorkSection>
          </div>
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

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Card className="p-2.5">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${danger ? "text-red-600" : "text-ink"}`}>
        {value}
      </p>
    </Card>
  );
}
