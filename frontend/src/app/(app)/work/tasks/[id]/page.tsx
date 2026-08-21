"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import JalaliDateField from "@/components/work/JalaliDateField";
import ProgressBar from "@/components/work/ProgressBar";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch } from "@/lib/api";
import {
  PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  colorAlpha,
  formatFaDate,
  isOverdue,
  type WorkBoardColumn,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTaskDetail,
} from "@/lib/work";

export default function WorkTaskPage() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);

  const [task, setTask] = useState<WorkTaskDetail | null>(null);
  const [project, setProject] = useState<WorkProject | null>(null);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [columns, setColumns] = useState<WorkBoardColumn[]>([]);
  const [labels, setLabels] = useState<WorkLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [due, setDue] = useState("");
  const [columnId, setColumnId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("2");
  const [difficulty, setDifficulty] = useState("3");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(taskId)) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<WorkTaskDetail>(`/work/tasks/${taskId}/`);
      setTask(row);
      setTitle(row.title);
      setDescription(row.description || "");
      setStartDate(row.start_date || "");
      setDue(row.due_date || "");
      setColumnId(row.column ? String(row.column) : "");
      setAssignee(row.assigned_to ? String(row.assigned_to) : "");
      setPriority(String(row.priority || 2));
      setDifficulty(String(row.difficulty || 3));
      setSelectedLabels((row.labels || []).map((label) => label.id));
      const [projectRow, memberRows, columnRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${row.project}/`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${row.project}/members/`),
        apiFetch<WorkBoardColumn[]>(`/work/projects/${row.project}/columns/`),
      ]);
      setProject(projectRow);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setColumns(Array.isArray(columnRows) ? columnRows : []);
      const labelRows = await apiFetch<WorkLabel[]>(
        `/work/companies/${projectRow.company}/labels/`,
      );
      setLabels(Array.isArray(labelRows) ? labelRows : []);
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

  const saveDetails = async () => {
    if (!title.trim()) {
      setError("عنوان کار الزامی است.");
      return;
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      start_date: startDate || null,
      due_date: due || null,
    };
    if (canMove) body.column = columnId ? Number(columnId) : null;
    if (canManage) {
      body.assigned_to = assignee ? Number(assignee) : null;
      body.priority = Number(priority);
      body.difficulty = Number(difficulty);
      body.label_ids = selectedLabels;
    }
    await patchTask(body);
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
  const canMove = Boolean(task.can_move);

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref={`/work/projects/${task.project}`}
        items={[
          { href: "/work", label: "کار" },
          {
            href: `/work/companies/${project?.company || ""}`,
            label: project?.company_name || "شرکت",
          },
          { href: `/work/projects/${task.project}`, label: task.project_name },
          { label: task.title },
        ]}
      />

      <div className="flex items-start gap-3">
        <DoneCheck
          done={task.status === "done"}
          busy={saving}
          onToggle={(done) => {
            if (!canMove) return;
            patchTask({ status: done ? "done" : "todo" });
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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{TASK_STATUS_LABELS[task.status]}</span>
            <span>#{task.id}</span>
            {overdue && <Badge tone="red">گذشته</Badge>}
            <span className="flex items-center gap-2">
              <ProgressBar value={task.progress_percent} className="w-20" />
              {task.progress_percent}٪
            </span>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">جزئیات کار</h2>
        <Field label="عنوان">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label="توضیح">
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage && !canMove}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="شروع کار">
            <JalaliDateField value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="سررسید">
            <JalaliDateField value={due} onChange={setDue} />
          </Field>
          <Field label="مسئول">
            <Select
              value={assignee}
              disabled={!canManage}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">بدون مسئول</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.phone_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ستون بورد">
            <Select
              value={columnId}
              disabled={!canMove}
              onChange={(e) => setColumnId(e.target.value)}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="اولویت">
            <Select
              value={priority}
              disabled={!canManage}
              onChange={(e) => setPriority(e.target.value)}
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {canManage && (
            <Field label="سختی">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">برچسب‌ها</p>
          {labels.length === 0 ? (
            <p className="text-xs text-gray-500">
              برچسب را از تنظیمات پروژه بسازید.
              {project && (
                <>
                  {" "}
                  <Link href={`/work/projects/${project.id}`} className="text-link">
                    بازگشت به بورد
                  </Link>
                </>
              )}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => {
                const active = selectedLabels.includes(label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      setSelectedLabels((current) =>
                        active ? current.filter((id) => id !== label.id) : [...current, label.id],
                      )
                    }
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium disabled:opacity-60 ${
                      active ? "ring-2 ring-navy-900/40" : "opacity-70"
                    }`}
                    style={{
                      backgroundColor: colorAlpha(label.color, 0.14),
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" loading={saving} onClick={() => void saveDetails()}>
            ذخیره
          </Button>
        </div>
        {!canMove && (
          <p className="text-xs text-gray-500">فقط مسئول این کار و مدیر می‌توانند ستون را عوض کنند.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">گام‌ها</h2>
        {(task.steps || []).length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">بدون گام هم می‌توانید کار را جلو ببرید.</p>
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
