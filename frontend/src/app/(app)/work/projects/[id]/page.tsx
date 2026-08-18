"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import BackButton from "@/components/BackButton";
import {
  Alert,
  Badge,
  Button,
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
import DoneCheck from "@/components/work/DoneCheck";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  formatFaDate,
  isOverdue,
  taskStatusTone,
  type WorkProject,
  type WorkProjectMember,
  type WorkTask,
  type WorkTaskStatus,
  type WorkTeam,
} from "@/lib/work";

export default function WorkProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);

  const [project, setProject] = useState<WorkProject | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [filter, setFilter] = useState<WorkTaskStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskOpen, setTaskOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("2");
  const [difficulty, setDifficulty] = useState("1");
  const [assignee, setAssignee] = useState("");
  const [teamId, setTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, taskRows, memberRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${projectId}/`),
        apiList<WorkTask>(`/work/tasks/?project=${projectId}`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${projectId}/members/`),
      ]);
      setProject(row);
      setTasks(taskRows);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      const teamRows = await apiList<WorkTeam>(`/work/teams/?company=${row.company}`);
      setTeams(teamRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بارگذاری پروژه ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((task) => task.status === filter)),
    [filter, tasks],
  );

  const createTask = async () => {
    if (!title.trim()) {
      setFormError("عنوان کار الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/work/tasks/", {
        method: "POST",
        body: {
          project: projectId,
          title: title.trim(),
          description: description.trim(),
          due_date: due || null,
          priority: Number(priority),
          difficulty: Number(difficulty),
          assigned_to: assignee ? Number(assignee) : null,
        },
      });
      setTaskOpen(false);
      setTitle("");
      setDescription("");
      setDue("");
      setAssignee("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت کار ناموفق بود.");
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

  const addTeam = async () => {
    if (!teamId) {
      setFormError("یک تیم انتخاب کنید.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/add-team/`, {
        method: "POST",
        body: { team_id: Number(teamId) },
      });
      setTeamOpen(false);
      setTeamId("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "افزودن تیم ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!project) return <Alert>{error || "پروژه پیدا نشد."}</Alert>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackButton fallbackHref={`/work/companies/${project.company}`} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">{project.name}</h1>
            <Badge tone="blue">
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {project.description || "پیشرفت این پروژه از سختی کارها حساب می‌شود."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => setTeamOpen(true)}>
              افزودن تیم
            </Button>
          )}
          {project.can_manage && (
            <Button size="sm" onClick={() => setTaskOpen(true)}>
              کار جدید
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-gray-500">پیشرفت</span>
          <span className="font-medium text-ink">{project.progress_percent}٪</span>
        </div>
        <ProgressBar value={project.progress_percent} className="mt-2" />
        <p className="mt-2 text-[11px] text-gray-500">
          سررسید {formatFaDate(project.due_date)} · اولویت{" "}
          {PRIORITY_LABELS[project.priority] || project.priority} ·{" "}
          <Link href={`/work/companies/${project.company}`} className="text-link">
            شرکت
          </Link>
        </p>
      </section>

      {members.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {members.map((member) => (
            <span
              key={member.id}
              className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-ink"
            >
              {member.full_name || member.phone_number}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="همه"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {TASK_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={TASK_STATUS_LABELS[status]}
            active={filter === status}
            onClick={() => setFilter(status)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="کاری در این نما نیست"
          description={
            project.can_manage
              ? "یک کار بسازید و مسئول بگذارید تا پیشرفت دیده شود."
              : "هنوز کاری به این پروژه اضافه نشده."
          }
          action={
            project.can_manage ? (
              <Button size="sm" onClick={() => setTaskOpen(true)}>
                کار جدید
              </Button>
            ) : undefined
          }
        />
      ) : (
        <WorkTable columns={["تمام", "کار", "مسئول", "وضعیت", "سررسید"]}>
          {visible.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            return (
              <tr key={task.id} className="hover:bg-surface">
                <WorkTd>
                  <DoneCheck
                    done={task.status === "done"}
                    busy={busyId === task.id}
                    onToggle={(done) => toggleDone(task.id, done)}
                  />
                </WorkTd>
                <WorkTd>
                  <Link
                    href={`/work/tasks/${task.id}`}
                    className={`font-bold hover:text-link ${
                      task.status === "done" ? "text-gray-400 line-through" : "text-navy-900"
                    }`}
                  >
                    {task.title}
                  </Link>
                </WorkTd>
                <WorkTd>{task.assignee_name || "بدون مسئول"}</WorkTd>
                <WorkTd>
                  <Badge tone={taskStatusTone(task.status)}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </WorkTd>
                <WorkTd className={overdue ? "font-medium text-red-600" : ""}>
                  {formatFaDate(task.due_date)}
                </WorkTd>
              </tr>
            );
          })}
        </WorkTable>
      )}

      <Modal open={taskOpen} title="کار جدید" onClose={() => setTaskOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="عنوان">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="توضیح">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="سررسید">
              <JalaliDateField value={due} onChange={setDue} />
            </Field>
            <Field label="مسئول">
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">بعداً تعیین می‌شود</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.phone_number}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="اولویت">
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="سختی (وزن پیشرفت)">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTaskOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={createTask}>
              ساخت
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={teamOpen} title="افزودن تیم به پروژه" onClose={() => setTeamOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label="تیم">
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-gray-500">
            اعضای فعال تیم به پروژه اضافه می‌شوند.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTeamOpen(false)}>
              انصراف
            </Button>
            <Button loading={saving} onClick={addTeam}>
              افزودن
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-brand-500 bg-brand-500 font-medium text-ink"
          : "border-gray-200 bg-white text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}
