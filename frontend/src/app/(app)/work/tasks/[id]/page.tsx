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
  Field,
  Input,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui";
import DoneCheck from "@/components/work/DoneCheck";
import ProgressBar from "@/components/work/ProgressBar";
import { ApiError, apiFetch } from "@/lib/api";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  formatFaDate,
  isOverdue,
  priorityTone,
  taskStatusTone,
  type WorkProject,
  type WorkProjectMember,
  type WorkTaskDetail,
  type WorkTaskStatus,
} from "@/lib/work";

export default function WorkTaskPage() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);

  const [task, setTask] = useState<WorkTaskDetail | null>(null);
  const [project, setProject] = useState<WorkProject | null>(null);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<WorkTaskStatus>("todo");
  const [assignee, setAssignee] = useState("");
  const [difficulty, setDifficulty] = useState("3");

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId)) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<WorkTaskDetail>(`/work/tasks/${taskId}/`);
      setTask(row);
      setStatus(row.status);
      setAssignee(row.assigned_to ? String(row.assigned_to) : "");
      setDifficulty(String(row.difficulty || 3));
      const [projectRow, memberRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${row.project}/`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${row.project}/members/`),
      ]);
      setProject(projectRow);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بارگذاری کار ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const patchTask = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<WorkTaskDetail>(`/work/tasks/${taskId}/`, {
        method: "PATCH",
        body,
      });
      setTask((current) =>
        current
          ? { ...current, ...updated, steps: current.steps, comments: current.comments }
          : updated,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ذخیره کار ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = async (stepId: number, done: boolean) => {
    try {
      await apiFetch(`/work/tasks/${taskId}/steps/${stepId}/`, {
        method: "PATCH",
        body: { is_completed: done },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "به‌روزرسانی گام ناموفق بود.");
    }
  };

  const addStep = async () => {
    if (!stepTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/work/tasks/${taskId}/steps/`, {
        method: "POST",
        body: { title: stepTitle.trim() },
      });
      setStepTitle("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "افزودن گام ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/work/tasks/${taskId}/comments/`, {
        method: "POST",
        body: { body: comment.trim() },
      });
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ثبت نظر ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!task) return <Alert>{error || "کار پیدا نشد."}</Alert>;

  const overdue = isOverdue(task.due_date, task.status);
  const canManage = Boolean(project?.can_manage);

  return (
    <div className="space-y-5">
      <div>
        <BackButton fallbackHref={`/work/projects/${task.project}`} />
        <p className="mt-3 text-xs text-gray-500">
          <Link href={`/work/projects/${task.project}`} className="text-link">
            {task.project_name}
          </Link>
        </p>
        <div className="mt-3 flex items-start gap-3">
          <DoneCheck
            done={task.status === "done"}
            busy={saving}
            onToggle={(done) => {
              const next = done ? "done" : "todo";
              setStatus(next);
              patchTask({ status: next });
            }}
          />
          <div className="min-w-0 flex-1">
            <h1
              className={`text-lg font-bold ${
                task.status === "done" ? "text-gray-400 line-through" : "text-ink"
              }`}
            >
              {task.title}
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              تیک بزنید تا کار تمام شود.
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={taskStatusTone(task.status)}>
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          <Badge tone={priorityTone(task.priority)}>
            اولویت {PRIORITY_LABELS[task.priority] || task.priority}
          </Badge>
          <Badge tone={overdue ? "red" : "gray"}>
            {overdue ? "گذشته · " : ""}
            {formatFaDate(task.due_date)}
          </Badge>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {task.description && (
        <Card>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{task.description}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">پیشرفت</span>
          <span className="font-medium text-ink">{task.progress_percent}٪</span>
        </div>
        <ProgressBar value={task.progress_percent} className="mt-2" />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">وضعیت و مسئول</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="وضعیت">
            <Select
              value={status}
              onChange={(e) => {
                const next = e.target.value as WorkTaskStatus;
                setStatus(next);
                patchTask({ status: next });
              }}
            >
              {TASK_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {TASK_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="مسئول">
            <Select
              value={assignee}
              disabled={!canManage}
              onChange={(e) => {
                const next = e.target.value;
                setAssignee(next);
                patchTask({ assigned_to: next ? Number(next) : null });
              }}
            >
              <option value="">بدون مسئول</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.phone_number}
                </option>
              ))}
            </Select>
          </Field>
          {canManage && (
            <Field label="سختی (فقط مدیر)">
              <Select
                value={difficulty}
                onChange={(e) => {
                  const next = e.target.value;
                  setDifficulty(next);
                  patchTask({ difficulty: Number(next) });
                }}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {saving && <p className="text-xs text-gray-500">در حال ذخیره...</p>}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">گام‌ها</h2>
        {(task.steps || []).length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">
            بدون گام، پیشرفت صفر است تا وضعیت «تمام» شود.
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {task.steps.map((step) => (
              <li key={step.id}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-4 accent-brand-500"
                    checked={step.is_completed}
                    onChange={(e) => toggleStep(step.id, e.target.checked)}
                  />
                  <span className={step.is_completed ? "text-gray-400 line-through" : ""}>
                    {step.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="flex gap-2">
            <Input
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              placeholder="گام بعدی"
            />
            <Button size="sm" loading={saving} onClick={addStep}>
              افزودن
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">نظرها</h2>
        <ul className="mb-3 space-y-2">
          {(task.comments || []).map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-gray-100 bg-surface/60 px-3 py-2"
            >
              <p className="text-xs font-medium text-ink">{item.author_name}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>
            </li>
          ))}
        </ul>
        <Field label="نظر جدید">
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="یک جمله روشن بنویسید..."
          />
        </Field>
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={saving} onClick={addComment}>
            ثبت نظر
          </Button>
        </div>
      </Card>
    </div>
  );
}
