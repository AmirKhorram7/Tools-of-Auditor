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
import ProgressBar from "@/components/work/ProgressBar";
import TaskCard from "@/components/work/TaskCard";
import WeekStrip from "@/components/work/WeekStrip";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  type WorkCompany,
  type WorkDashboard,
  type WorkInvitation,
  type WorkTask,
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
      <WorkBreadcrumb fallbackHref="/dashboard" items={[{ label: "کار" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">مدیریت کار</h1>
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
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={`/work/companies/${company.id}`}
                className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-bold text-white hover:bg-navy-800"
              >
                {company.name}
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
            description="وقتی مدیر کاری به شما بدهد، اینجا و روی بورد پروژه دیده می‌شود."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {myTasks.map((task) => (
              <TaskCard
                key={task.id}
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
      </section>

      {manager && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-ink">گزارش مدیر</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              وضعیت پروژه‌ها، کار بدون مسئول، و کارت کارها برای پیگیری.
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
            <h3 className="mb-2 text-sm font-semibold text-ink">کارت کارها</h3>
            {allTasks.length === 0 ? (
              <EmptyState
                title="کاری ثبت نشده"
                description="از صفحه پروژه، روی بورد کار بسازید و مسئول بگذارید."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {allTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
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
