"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
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
  Select,
  Textarea,
} from "@/components/ui";
import JalaliDateField from "@/components/work/JalaliDateField";
import ProgressBar from "@/components/work/ProgressBar";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  formatFaDate,
  type WorkCompany,
  type WorkProject,
  type WorkTeam,
} from "@/lib/work";

export default function WorkCompanyPage() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params.id);

  const [company, setCompany] = useState<WorkCompany | null>(null);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamOpen, setTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [projectDue, setProjectDue] = useState("");
  const [projectPriority, setProjectPriority] = useState("2");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(companyId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, teamRows, projectRows] = await Promise.all([
        apiFetch<WorkCompany>(`/work/companies/${companyId}/`),
        apiList<WorkTeam>(`/work/teams/?company=${companyId}`),
        apiList<WorkProject>(`/work/projects/?company=${companyId}`),
      ]);
      setCompany(row);
      setTeams(teamRows);
      setProjects(projectRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بارگذاری شرکت ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const createTeam = async () => {
    if (!teamName.trim()) {
      setFormError("نام تیم الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/work/teams/", {
        method: "POST",
        body: { company: companyId, name: teamName.trim() },
      });
      setTeamOpen(false);
      setTeamName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت تیم ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const createProject = async () => {
    if (!projectName.trim()) {
      setFormError("نام پروژه الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/work/projects/", {
        method: "POST",
        body: {
          company: companyId,
          name: projectName.trim(),
          description: projectDesc.trim(),
          due_date: projectDue || null,
          priority: Number(projectPriority),
        },
      });
      setProjectOpen(false);
      setProjectName("");
      setProjectDesc("");
      setProjectDue("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت پروژه ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!company) {
    return <Alert>{error || "شرکت پیدا نشد."}</Alert>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton fallbackHref="/work" />
          <div className="mt-3 rounded-2xl bg-navy-900 p-5 text-white">
            <p className="text-[11px] font-semibold tracking-wide text-brand-400">شرکت</p>
            <h1 className="mt-1 text-2xl font-bold">{company.name}</h1>
            <p className="mt-2 text-sm text-gray-300">
              ۱) تیم بسازید ۲) همکار دعوت کنید ۳) پروژه و کار تعریف کنید.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setFormError(null); setTeamOpen(true); }}>
            تیم جدید
          </Button>
          <Button size="sm" onClick={() => { setFormError(null); setProjectOpen(true); }}>
            پروژه جدید
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">تیم‌ها</h2>
        {teams.length === 0 ? (
          <EmptyState
            title="هنوز تیمی نیست"
            description="یک تیم بسازید و همکاران را با شماره موبایل دعوت کنید."
            action={
              <Button size="sm" onClick={() => setTeamOpen(true)}>
                ساخت تیم
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => (
              <Link key={team.id} href={`/work/teams/${team.id}`}>
                <Card className="transition hover:border-brand-500 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold text-navy-900">{team.name}</p>
                    <Badge>{team.status === "active" ? "فعال" : "بایگانی"}</Badge>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    {team.can_manage ? "مشاهده و ویرایش تیم ←" : "مشاهده اعضای تیم ←"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">پروژه‌های کار</h2>
        {projects.length === 0 ? (
          <EmptyState
            title="پروژه‌ای نیست"
            description="پروژه بسازید، تیم را به آن وصل کنید، بعد کار تعریف کنید."
            action={
              <Button size="sm" onClick={() => setProjectOpen(true)}>
                ساخت پروژه
              </Button>
            }
          />
        ) : (
          <WorkTable columns={["پروژه", "وضعیت", "پیشرفت", "اولویت", "سررسید"]}>
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-surface">
                <WorkTd>
                  <Link
                    href={`/work/projects/${project.id}`}
                    className="font-bold text-navy-900 hover:text-link"
                  >
                    {project.name}
                  </Link>
                </WorkTd>
                <WorkTd>
                  <Badge tone="blue">
                    {PROJECT_STATUS_LABELS[project.status] || project.status}
                  </Badge>
                </WorkTd>
                <WorkTd>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={project.progress_percent} className="w-20" />
                    <span>{project.progress_percent}٪</span>
                  </div>
                </WorkTd>
                <WorkTd>{PRIORITY_LABELS[project.priority] || project.priority}</WorkTd>
                <WorkTd>{formatFaDate(project.due_date)}</WorkTd>
              </tr>
            ))}
          </WorkTable>
        )}
      </section>

      <Modal open={teamOpen} title="تیم جدید" onClose={() => setTeamOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="نام تیم">
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="مثلاً تیم مالی"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTeamOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={createTeam}>
              ساخت
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={projectOpen} title="پروژه جدید" onClose={() => setProjectOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="نام پروژه">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="مثلاً بستن حساب‌های سال"
            />
          </Field>
          <Field label="توضیح">
            <Textarea
              rows={3}
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
            />
          </Field>
          <Field label="سررسید">
            <JalaliDateField value={projectDue} onChange={setProjectDue} />
          </Field>
          <Field label="اولویت">
            <Select
              value={projectPriority}
              onChange={(e) => setProjectPriority(e.target.value)}
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProjectOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={createProject}>
              ساخت
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
