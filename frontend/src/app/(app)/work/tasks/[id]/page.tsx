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
import PrerequisitePicker from "@/components/work/PrerequisitePicker";
import ProgressBar from "@/components/work/ProgressBar";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  isOverdue,
  labelTextColor,
  workPriorityLabel,
  workStatusLabel,
  type WorkBoardColumn,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTask,
  type WorkTaskDetail,
} from "@/lib/work";

export default function WorkTaskPage() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);
  const { t, locale } = useI18n();

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
  const [siblings, setSiblings] = useState<WorkTask[]>([]);
  const [selectedPrereqs, setSelectedPrereqs] = useState<number[]>([]);

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
      setSelectedPrereqs((row.prerequisites || []).map((item) => item.id));
      const [projectRow, memberRows, columnRows, siblingRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${row.project}/`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${row.project}/members/`),
        apiFetch<WorkBoardColumn[]>(`/work/projects/${row.project}/columns/`),
        apiList<WorkTask>(`/work/tasks/?project=${row.project}`),
      ]);
      setProject(projectRow);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setColumns(Array.isArray(columnRows) ? columnRows : []);
      setSiblings(siblingRows.filter((item) => item.id !== row.id));
      const labelRows = await apiFetch<WorkLabel[]>(
        `/work/companies/${projectRow.company}/labels/`,
      );
      setLabels(Array.isArray(labelRows) ? labelRows : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadTaskFail"));
    } finally {
      setLoading(false);
    }
  }, [taskId, t]);

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
      setError(err instanceof ApiError ? err.message : t("work.saveTaskFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async () => {
    if (!title.trim()) {
      setError(t("work.taskTitleRequired"));
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
    body.prerequisite_ids = selectedPrereqs;
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
      setError(err instanceof ApiError ? err.message : t("work.updateStepFail"));
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
      setError(err instanceof ApiError ? err.message : t("work.addStepFail"));
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
      setError(err instanceof ApiError ? err.message : t("work.addCommentFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!task) return <Alert>{error || t("work.taskNotFound")}</Alert>;

  const overdue = isOverdue(task.due_date, task.status);
  const canManage = Boolean(project?.can_manage);
  const canMove = Boolean(task.can_move);
  const pctLabel = locale === "en" ? `${task.progress_percent}%` : `${task.progress_percent}٪`;

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref={`/work/projects/${task.project}`}
        items={[
          { href: "/work", label: t("work.crumb") },
          {
            href: `/work/companies/${project?.company || ""}`,
            label: project?.company_name || t("work.company"),
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
            <span>{workStatusLabel(t, task.status)}</span>
            <span>#{task.id}</span>
            {overdue && <Badge tone="red">{t("work.overdueShort")}</Badge>}
            <span className="flex items-center gap-2">
              <ProgressBar value={task.progress_percent} className="w-20" />
              {pctLabel}
            </span>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">{t("work.taskDetails")}</h2>
        <Field label={t("work.taskTitle")}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canManage}
          />
        </Field>
        <Field label={t("work.description")}>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!canManage && !canMove}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("work.startDate")}>
            <JalaliDateField value={startDate} onChange={setStartDate} />
          </Field>
          <Field label={t("work.due")}>
            <JalaliDateField value={due} onChange={setDue} />
          </Field>
          <Field label={t("work.assignee")}>
            <Select
              value={assignee}
              disabled={!canManage}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">{t("work.unassigned")}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name || member.phone_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("work.boardColumn")}>
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
          <Field label={t("work.priority")}>
            <Select
              value={priority}
              disabled={!canManage}
              onChange={(e) => setPriority(e.target.value)}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {workPriorityLabel(t, value)}
                </option>
              ))}
            </Select>
          </Field>
          {canManage && (
            <Field label={t("work.difficulty")}>
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
          <p className="mb-1.5 text-sm font-medium text-ink">{t("work.prereq")}</p>
          <PrerequisitePicker
            tasks={siblings}
            selected={selectedPrereqs}
            onChange={setSelectedPrereqs}
            disabled={!canManage && !canMove}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{t("work.labelsTitle")}</p>
          {labels.length === 0 ? (
            <p className="text-xs text-gray-500">
              {t("work.makeLabelsInSettings")}
              {project && (
                <>
                  {" "}
                  <Link href={`/work/projects/${project.id}`} className="text-link">
                    {t("work.backToBoard")}
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
                    className={`rounded px-2.5 py-0.5 text-xs font-bold disabled:opacity-60 ${
                      active ? "ring-2 ring-navy-900/40" : "opacity-70"
                    }`}
                    style={{
                      backgroundColor: label.color,
                      color: labelTextColor(label.color),
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
            {t("common.save")}
          </Button>
        </div>
        {!canMove && (
          <p className="text-xs text-gray-500">{t("work.onlyAssigneeMove")}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("work.steps")}</h2>
        {(task.steps || []).length === 0 ? (
          <p className="mb-3 text-sm text-gray-500">{t("work.noStepsHint")}</p>
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
              placeholder={t("work.nextStep")}
            />
            <Button size="sm" loading={saving} onClick={addStep}>
              {t("common.add")}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("work.comments")}</h2>
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
        <Field label={t("work.newComment")}>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("work.commentPlaceholder")}
          />
        </Field>
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={saving} onClick={addComment}>
            {t("work.postComment")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
