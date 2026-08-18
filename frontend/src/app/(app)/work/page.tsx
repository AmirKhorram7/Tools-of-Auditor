"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
} from "@/components/ui";
import DoneCheck from "@/components/work/DoneCheck";
import ProgressBar from "@/components/work/ProgressBar";
import WeekStrip from "@/components/work/WeekStrip";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  formatFaDate,
  isOverdue,
  taskStatusTone,
  type WorkCompany,
  type WorkDashboard,
  type WorkInvitation,
  type WorkTask,
  type WorkTaskRow,
} from "@/lib/work";

export default function WorkHomePage() {
  const [data, setData] = useState<WorkDashboard | null>(null);
  const [companies, setCompanies] = useState<WorkCompany[]>([]);
  const [invites, setInvites] = useState<WorkInvitation[]>([]);
  const [allTasks, setAllTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
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
      setError(err instanceof ApiError ? err.message : "بارگذاری پیشخوان ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createCompany = async () => {
    if (!companyName.trim()) {
      setFormError("نام شرکت الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "ساخت شرکت ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (id: number, done: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/work/tasks/${id}/`, {
        method: "PATCH",
        body: { status: done ? "done" : "todo" },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تغییر وضعیت کار ناموفق بود.");
    } finally {
      setBusyId(null);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">مدیریت کار</h1>
          <p className="mt-1 text-sm text-gray-500">
            کار روشن، پیشرفت دیده می‌شود، کار تمام می‌شود.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/work/inbox">
            <Button variant="secondary" size="sm">
              اعلان‌ها
              {invites.length > 0 ? ` (${invites.length})` : ""}
            </Button>
          </Link>
          <Button size="sm" onClick={() => setCompanyOpen(true)}>
            شرکت جدید
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invites.length > 0 && (
        <Card className="border-brand-200 bg-brand-50">
          <p className="text-sm font-medium text-ink">
            {invites.length} دعوت در انتظار شماست.
          </p>
          <Link href="/work/inbox" className="mt-3 inline-block">
            <Button size="sm">مشاهده و پذیرش</Button>
          </Link>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">شرکت‌ها</h2>
          <Button size="sm" variant="secondary" onClick={() => setCompanyOpen(true)}>
            افزودن
          </Button>
        </div>
        {companies.length === 0 ? (
          <EmptyState
            title="هنوز شرکتی ندارید"
            description="اول شرکت را بسازید، بعد تیم دعوت کنید و کار تعریف کنید."
            action={
              <Button size="sm" onClick={() => setCompanyOpen(true)}>
                ساخت اولین شرکت
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((company) => (
              <Link key={company.id} href={`/work/companies/${company.id}`}>
                <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-md transition hover:bg-navy-800">
                  <p className="text-[11px] font-semibold tracking-wide text-brand-400">
                    شرکت
                  </p>
                  <p className="mt-1 text-xl font-bold">{company.name}</p>
                  <p className="mt-3 text-xs text-gray-300">ورود به تیم و پروژه‌ها ←</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-ink">هفته من</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            روزهایی که سررسید دارید، روز کار است. بقیه روزها استراحت.
          </p>
        </div>
        <WeekStrip tasks={weekTasks} />
        <div className="grid grid-cols-3 gap-3">
          <Stat label="کارهای باز" value={counts?.assigned ?? 0} />
          <Stat label="امروز" value={counts?.today ?? 0} />
          <Stat label="عقب‌افتاده" value={counts?.overdue ?? 0} danger />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-ink">کارهای من</h2>
        {myTasks.length === 0 ? (
          <EmptyState
            title="کاری به شما واگذار نشده"
            description="وقتی مدیر کاری به شما بدهد، اینجا با یک تیک تمام می‌شود."
          />
        ) : (
          <TaskTable
            tasks={myTasks}
            busyId={busyId}
            onToggleDone={toggleDone}
            showAssignee={false}
          />
        )}
      </section>

      {manager && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-ink">گزارش مدیر</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              پیشرفت پروژه‌ها و اینکه کار دست کیست.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="بدون مسئول" value={manager.unassigned_count} />
            <Stat label="دعوت‌های باز" value={manager.pending_invites} />
            <Stat label="تمام‌شده این هفته" value={manager.completed_this_week} />
            <Stat label="در ریسک" value={manager.at_risk.length} danger />
          </div>

          {manager.projects.length === 0 ? (
            <EmptyState
              title="پروژه کاری ندارید"
              description="وارد شرکت شوید، تیم بسازید، بعد پروژه و کار تعریف کنید."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {manager.projects.map((project) => (
                <Link key={project.id} href={`/work/projects/${project.id}`}>
                  <Card className="transition hover:border-brand-500 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-ink">{project.name}</p>
                      <Badge tone="blue">{project.progress_percent}٪</Badge>
                    </div>
                    <ProgressBar value={project.progress_percent} className="mt-3" />
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                      <span>عقب‌افتاده {project.overdue_count}</span>
                      <span>مسدود {project.blocked_count}</span>
                      <span>بدون مسئول {project.unassigned_count}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">جدول پروژه‌ها</h3>
            <WorkTable columns={["پروژه", "وضعیت", "پیشرفت", "سررسید", "ریسک"]}>
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
                  <WorkTd>
                    {PROJECT_STATUS_LABELS[project.status] || project.status}
                  </WorkTd>
                  <WorkTd>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={project.progress_percent} className="w-20" />
                      <span>{project.progress_percent}٪</span>
                    </div>
                  </WorkTd>
                  <WorkTd>{formatFaDate(project.due_date)}</WorkTd>
                  <WorkTd>
                    {project.overdue_count > 0 || project.blocked_count > 0 ? (
                      <Badge tone="red">
                        {project.overdue_count} عقب · {project.blocked_count} مسدود
                      </Badge>
                    ) : (
                      <Badge tone="green">آرام</Badge>
                    )}
                  </WorkTd>
                </tr>
              ))}
            </WorkTable>
          </div>

          {manager.workload.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">بار کار افراد</h3>
              <WorkTable columns={["فرد", "کارهای باز"]}>
                {manager.workload.map((row) => (
                  <tr key={row.user_id}>
                    <WorkTd className="font-medium text-ink">{row.name}</WorkTd>
                    <WorkTd>{row.open_tasks}</WorkTd>
                  </tr>
                ))}
              </WorkTable>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">جدول تخصیص کارها</h3>
            {allTasks.length === 0 ? (
              <EmptyState
                title="کاری ثبت نشده"
                description="از صفحه پروژه، کار بسازید و مسئول بگذارید."
              />
            ) : (
              <TaskTable
                tasks={allTasks}
                busyId={busyId}
                onToggleDone={toggleDone}
                showAssignee
              />
            )}
          </div>
        </section>
      )}

      <Modal
        open={companyOpen}
        title="شرکت جدید"
        onClose={() => setCompanyOpen(false)}
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="نام شرکت">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="مثلاً هلدینگ نمونه"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompanyOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={createCompany}>
              ساخت
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
    <Card className="p-3 sm:p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold sm:text-2xl ${danger ? "text-red-600" : "text-ink"}`}>
        {value}
      </p>
    </Card>
  );
}

function TaskTable({
  tasks,
  busyId,
  onToggleDone,
  showAssignee,
}: {
  tasks: Array<
    Pick<WorkTaskRow, "id" | "title" | "status" | "priority" | "due_date" | "project_name"> & {
      assignee_name?: string | null;
      project?: number;
      project_id?: number;
    }
  >;
  busyId: number | null;
  onToggleDone: (id: number, done: boolean) => void;
  showAssignee: boolean;
}) {
  const columns = showAssignee
    ? ["تمام", "کار", "پروژه", "مسئول", "وضعیت", "سررسید"]
    : ["تمام", "کار", "پروژه", "وضعیت", "سررسید"];

  return (
    <WorkTable columns={columns}>
      {tasks.map((task) => {
        const overdue = isOverdue(task.due_date, task.status);
        const projectId = task.project_id ?? task.project;
        return (
          <tr key={task.id} className="hover:bg-surface">
            <WorkTd>
              <DoneCheck
                done={task.status === "done"}
                busy={busyId === task.id}
                onToggle={(done) => onToggleDone(task.id, done)}
              />
            </WorkTd>
            <WorkTd>
              <Link
                href={`/work/tasks/${task.id}`}
                className={`font-semibold hover:text-link ${
                  task.status === "done" ? "text-gray-400 line-through" : "text-navy-900"
                }`}
              >
                {task.title}
              </Link>
            </WorkTd>
            <WorkTd>
              {projectId ? (
                <Link href={`/work/projects/${projectId}`} className="text-link">
                  {task.project_name}
                </Link>
              ) : (
                task.project_name
              )}
            </WorkTd>
            {showAssignee && (
              <WorkTd>{task.assignee_name || "بدون مسئول"}</WorkTd>
            )}
            <WorkTd>
              <Badge tone={taskStatusTone(task.status)}>
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
            </WorkTd>
            <WorkTd className={overdue ? "font-medium text-red-600" : ""}>
              {formatFaDate(task.due_date)}
              <span className="ms-1 text-[11px] text-gray-400">
                · {PRIORITY_LABELS[task.priority] || task.priority}
              </span>
            </WorkTd>
          </tr>
        );
      })}
    </WorkTable>
  );
}
