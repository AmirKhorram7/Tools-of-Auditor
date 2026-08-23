"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import PhoneSuggest from "@/components/work/PhoneSuggest";
import ProgressGauge from "@/components/work/ProgressGauge";
import DoneCheck from "@/components/work/DoneCheck";
import PrerequisitePicker from "@/components/work/PrerequisitePicker";
import TaskBoard from "@/components/work/TaskBoard";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkFlowView from "@/components/work/WorkFlowView";
import WorkGuide from "@/components/work/WorkGuide";
import {
  WorkMeetButton,
  WorkMeetLiveBar,
  WorkMeetModal,
  WorkMeetScope,
} from "@/components/work/meet/WorkMeetPanel";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { useAuth } from "@/lib/auth";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNABLE_TEAM_ROLES,
  LABEL_COLORS,
  TAG_COLORS,
  formatWorkDate,
  isOverdue,
  labelTextColor,
  taskStatusTone,
  teamColor,
  workPriorityLabel,
  workProjectStatusLabel,
  workRoleLabel,
  workStatusLabel,
  type WorkBoard,
  type WorkBoardColumn,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTask,
  type WorkBoardTemplate,
  type WorkTeam,
} from "@/lib/work";

const VIEW_KEY = "ta-work-project-view";

export default function WorkProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const { profile } = useAuth();
  const { t, locale } = useI18n();

  const [project, setProject] = useState<WorkProject | null>(null);
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [projectTeams, setProjectTeams] = useState<WorkTeam[]>([]);
  const [labels, setLabels] = useState<WorkLabel[]>([]);
  const [view, setView] = useState<"board" | "list" | "flow">("board");
  const [selectedPrereqs, setSelectedPrereqs] = useState<number[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskOpen, setTaskOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"teams" | "labels" | "board" | "templates">("labels");
  const [templates, setTemplates] = useState<WorkBoardTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDefault, setTemplateDefault] = useState(true);
  const [templateCols, setTemplateCols] = useState<Array<{ name: string; color: string }>>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("2");
  const [difficulty, setDifficulty] = useState("1");
  const [assignee, setAssignee] = useState("");
  const [columnId, setColumnId] = useState<number | "">("");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(TAG_COLORS[0]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState(LABEL_COLORS[1]);
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [teamId, setTeamId] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "list" || stored === "board" || stored === "flow") setView(stored);
  }, []);

  useEffect(() => {
    setTemplateCols([
      { name: t("work.col.todo"), color: LABEL_COLORS[0] },
      { name: t("work.col.doing"), color: LABEL_COLORS[1] },
      { name: t("work.col.done"), color: LABEL_COLORS[6] },
    ]);
  }, [locale, t]);

  const setSavedView = (next: "board" | "list" | "flow") => {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  };

  const load = useCallback(async (silent = false) => {
    if (!Number.isFinite(projectId)) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [row, boardRow, taskRows, memberRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${projectId}/`),
        apiFetch<WorkBoard>(`/work/projects/${projectId}/board/`),
        apiList<WorkTask>(`/work/tasks/?project=${projectId}`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${projectId}/members/`),
      ]);
      setProject(row);
      setBoard(boardRow);
      setTasks(taskRows);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      const [teamRows, labelRows, linkedTeams] = await Promise.all([
        apiList<WorkTeam>(`/work/teams/?company=${row.company}`),
        apiFetch<WorkLabel[]>(`/work/companies/${row.company}/labels/`),
        apiFetch<WorkTeam[]>(`/work/projects/${projectId}/teams/`),
      ]);
      setTeams(teamRows);
      setLabels(Array.isArray(labelRows) ? labelRows : []);
      setProjectTeams(Array.isArray(linkedTeams) ? linkedTeams : []);
      try {
        const templateRows = await apiList<WorkBoardTemplate>(
          `/work/board-templates/?company=${row.company}`,
        );
        setTemplates(templateRows);
      } catch {
        setTemplates([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadProjectFail"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!board) return;
    setColumnNames(
      Object.fromEntries(board.columns.map((column) => [column.id, column.name])),
    );
  }, [board]);

  const columns = board?.columns || [];
  const myUserId = members.find((member) => member.phone_number === profile?.phone_number)?.user;
  const visibleTasks = useMemo(() => {
    if (!mineOnly) return tasks;
    return tasks.filter((task) => task.assignee_user_id === myUserId);
  }, [mineOnly, tasks, myUserId]);

  const openTaskModal = (column?: WorkBoardColumn) => {
    setFormError(null);
    setSelectedPrereqs([]);
    setColumnId(column?.id || columns[0]?.id || "");
    setTaskOpen(true);
  };

  const createTask = async () => {
    if (!title.trim()) {
      setFormError(t("work.taskTitleRequired"));
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
          start_date: startDate || null,
          due_date: due || null,
          priority: Number(priority),
          difficulty: Number(difficulty),
          assigned_to: assignee ? Number(assignee) : null,
          column: columnId || null,
          label_ids: selectedLabels,
          prerequisite_ids: selectedPrereqs,
        },
      });
      setTaskOpen(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setDue("");
      setAssignee("");
      setSelectedLabels([]);
      setSelectedPrereqs([]);
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createTaskFail"));
    } finally {
      setSaving(false);
    }
  };

  const createLabel = async () => {
    if (!project || !newLabelName.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const label = await apiFetch<WorkLabel>(`/work/companies/${project.company}/labels/`, {
        method: "POST",
        body: { name: newLabelName.trim(), color: newLabelColor },
      });
      setLabels((current) => [...current, label]);
      setSelectedLabels((current) => [...current, label.id]);
      setNewLabelName("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createLabelFail"));
    } finally {
      setSaving(false);
    }
  };

  const deleteLabel = async (labelId: number) => {
    if (!project) return;
    if (!window.confirm(t("work.deleteLabelConfirm"))) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/companies/${project.company}/labels/${labelId}/`, {
        method: "DELETE",
      });
      setLabels((current) => current.filter((label) => label.id !== labelId));
      setSelectedLabels((current) => current.filter((id) => id !== labelId));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteLabelFail"));
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (id: number, done: boolean) => {
    if (done && project?.require_approval && !project.can_manage) {
      setError(t("work.needApproval"));
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/work/tasks/${id}/`, {
        method: "PATCH",
        body: { status: done ? "done" : "todo" },
      });
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.moveTaskFail"));
    } finally {
      setBusyId(null);
    }
  };

  const moveTask = async (task: WorkTask, column: WorkBoardColumn) => {
    setError(null);
    try {
      await apiFetch(`/work/tasks/${task.id}/`, {
        method: "PATCH",
        body: { column: column.id },
      });
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.moveNotAllowed"));
    }
  };

  const addColumn = async (name: string, color: string) => {
    setFormError(null);
    await apiFetch(`/work/projects/${projectId}/columns/`, {
      method: "POST",
      body: { name, color, status_key: "in_progress" },
    });
    setNewColumnName("");
    await load(true);
  };

  const patchColumn = async (columnId: number, body: { name?: string; color?: string }) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/columns/${columnId}/`, {
        method: "PATCH",
        body,
      });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.saveColumnFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeColumn = async (columnId: number) => {
    if (columns.length < 2) {
      setFormError(t("work.minOneColumn"));
      return;
    }
    if (!window.confirm(t("work.deleteColumnConfirm"))) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/columns/${columnId}/`, {
        method: "DELETE",
      });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteColumnFail"));
    } finally {
      setSaving(false);
    }
  };

  const inviteToTeam = async () => {
    if (!inviteTeamId) {
      setFormError(t("work.selectTeam"));
      return;
    }
    if (!invitePhone.trim()) {
      setFormError(t("work.phoneRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/teams/${inviteTeamId}/invite/`, {
        method: "POST",
        body: {
          phone_number: invitePhone.trim(),
          position_title: inviteTitle.trim(),
          role: inviteRole,
        },
      });
      await apiFetch(`/work/projects/${projectId}/add-team/`, {
        method: "POST",
        body: { team_id: Number(inviteTeamId) },
      });
      setInvitePhone("");
      setInviteTitle("");
      setInviteRole("developer");
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.inviteColleagueFail"));
    } finally {
      setSaving(false);
    }
  };

  const addTeam = async () => {
    if (!teamId) {
      setFormError(t("work.selectTeam"));
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
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.addTeamFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!project || !templateName.trim()) {
      setFormError(t("work.templateNameRequired"));
      return;
    }
    const columns = templateCols.filter((row) => row.name.trim());
    if (columns.length === 0) {
      setFormError(t("work.minOneTemplateCol"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/work/board-templates/", {
        method: "POST",
        body: {
          company: project.company,
          name: templateName.trim(),
          is_default: templateDefault,
          columns,
        },
      });
      setTemplateName("");
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.saveTemplateFail"));
    } finally {
      setSaving(false);
    }
  };

  const setDefaultTemplate = async (templateId: number) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/board-templates/${templateId}/default/`, { method: "POST" });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.setDefaultFail"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (templateId: number) => {
    if (!window.confirm(t("work.deleteTemplateConfirm"))) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/board-templates/${templateId}/`, { method: "DELETE" });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteTemplateFail"));
    } finally {
      setSaving(false);
    }
  };

  const applyBoardTemplate = async (templateId: number) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/apply-template/`, {
        method: "POST",
        body: { board_template_id: templateId },
      });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.applyBoardFail"));
    } finally {
      setSaving(false);
    }
  };

  const setApprovalPolicy = async (value: boolean | null) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/`, {
        method: "PATCH",
        body: { require_approval_before_close: value },
      });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.savePolicyFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!project) return <Alert>{error || t("work.projectMissing")}</Alert>;

  const canAddTask = Boolean(project.can_add_task ?? project.can_manage);

  return (
    <WorkMeetScope
      projectId={project.id}
      members={members}
      teams={projectTeams}
      canCreate={canAddTask}
    >
    <div className="space-y-2.5">
      <WorkBreadcrumb
        fallbackHref={`/work/companies/${project.company}`}
        items={[
          { href: "/work", label: t("work.crumb") },
          {
            href: `/work/companies/${project.company}`,
            label: project.company_name || t("work.company"),
          },
          { label: project.name },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">{project.name}</h1>
          <Badge tone="blue">
            {workProjectStatusLabel(t, project.status) || project.status}
          </Badge>
          {projectTeams.map((team) => (
            <Link
              key={team.id}
              href={`/work/teams/${team.id}`}
              className="rounded-md px-2 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: teamColor(team.id),
                color: labelTextColor(teamColor(team.id)),
              }}
            >
              {team.name}
            </Link>
          ))}
          <ProgressGauge value={project.progress_percent} size={44} />
        </div>
        <div className="flex flex-wrap gap-2">
          {canAddTask && (
            <Button size="sm" onClick={() => openTaskModal()}>
              {t("work.addTask")}
            </Button>
          )}
          {project.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => setTeamOpen(true)}>
              {t("work.addTeam")}
            </Button>
          )}
          {project.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => { setFormError(null); setSettingsOpen(true); }}>
              {t("work.settings")}
            </Button>
          )}
          <WorkMeetButton />
          <WorkGuide compact />
        </div>
      </div>

      <WorkMeetLiveBar />

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setSavedView("board")}
            className={`rounded-md px-3 py-1.5 ${view === "board" ? "bg-navy-900 text-white" : "text-gray-600"}`}
          >
            {t("work.board")}
          </button>
          <button
            type="button"
            onClick={() => setSavedView("list")}
            className={`rounded-md px-3 py-1.5 ${view === "list" ? "bg-navy-900 text-white" : "text-gray-600"}`}
          >
            {t("work.list")}
          </button>
          <button
            type="button"
            onClick={() => setSavedView("flow")}
            className={`rounded-md px-3 py-1.5 ${view === "flow" ? "bg-navy-900 text-white" : "text-gray-600"}`}
          >
            {t("work.flow")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMineOnly((value) => !value)}
          className={`rounded-full border px-3 py-1 text-xs ${
            mineOnly ? "border-brand-500 bg-brand-100 text-ink" : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          {mineOnly ? t("work.mine") : t("work.allTasks")}
        </button>
      </div>

      {view === "board" && board ? (
        <TaskBoard
          board={board}
          canManage={project.can_manage}
          canAddTask={canAddTask}
          requireApproval={Boolean(project.require_approval)}
          onBlockedClose={() => setError(t("work.needApproval"))}
          mineOnly={mineOnly}
          currentUserId={myUserId}
          onMove={moveTask}
          onAddTask={canAddTask ? openTaskModal : undefined}
          onAddColumn={project.can_manage ? addColumn : undefined}
        />
      ) : view === "flow" ? (
        <WorkFlowView
          tasks={tasks}
          emptyAction={
            canAddTask ? (
              <Button size="sm" onClick={() => openTaskModal()}>
                {t("work.newTask")}
              </Button>
            ) : undefined
          }
        />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          title={t("work.emptyBoardTitle")}
          description={
            canAddTask
              ? t("work.emptyBoardManage")
              : t("work.emptyBoardOther")
          }
          action={
            canAddTask ? (
              <Button size="sm" onClick={() => openTaskModal()}>
                {t("work.newTask")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <WorkTable
          columns={[
            t("work.colDone"),
            t("work.colTask"),
            t("work.colAssignee"),
            t("work.colStatus"),
            t("work.colLabel"),
            t("work.colDue"),
          ]}
        >
          {visibleTasks.map((task) => {
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
                <WorkTd>{task.assignee_name || t("work.unassigned")}</WorkTd>
                <WorkTd>
                  <Badge tone={taskStatusTone(task.status)}>
                    {task.column_name || workStatusLabel(t, task.status)}
                  </Badge>
                </WorkTd>
                <WorkTd>
                  <div className="flex flex-wrap gap-1">
                    {(task.labels || []).map((label) => (
                      <span
                        key={label.id}
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: label.color,
                          color: labelTextColor(label.color),
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                </WorkTd>
                <WorkTd className={overdue ? "font-medium text-red-600" : ""}>
                  {formatWorkDate(task.due_date, locale, t("work.noDue"))}
                </WorkTd>
              </tr>
            );
          })}
        </WorkTable>
      )}

      <Modal
        open={taskOpen}
        title={t("work.newTask")}
        onClose={() => setTaskOpen(false)}
        className="max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.taskTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t("work.description")}>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">{t("work.assignLater")}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name || member.phone_number}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("work.boardColumn")}>
              <Select value={String(columnId)} onChange={(e) => setColumnId(Number(e.target.value) || "")}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("work.priority")}>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={value}>
                    {workPriorityLabel(t, value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("work.difficultyHint")}>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t("work.prereq")}</p>
            <PrerequisitePicker
              tasks={tasks}
              selected={selectedPrereqs}
              onChange={setSelectedPrereqs}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">{t("work.labelsTitle")}</p>
            {labels.length === 0 ? (
              <p className="text-xs text-gray-500">
                {t("work.noLabelsYet")}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const active = selectedLabels.includes(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() =>
                        setSelectedLabels((current) =>
                          active ? current.filter((id) => id !== label.id) : [...current, label.id],
                        )
                      }
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
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
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTaskOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createTask}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        title={t("work.settingsTitle")}
        onClose={() => setSettingsOpen(false)}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <div className="flex flex-wrap rounded-lg border border-gray-200 bg-[#F7F8FA] p-0.5 text-xs">
            {(
              [
                ["labels", t("work.tab.labels")],
                ["board", t("work.tab.board")],
                ["teams", t("work.tab.teams")],
                ["templates", t("work.tab.templates")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSettingsTab(id)}
                className={`flex-1 rounded-md px-2 py-1.5 ${
                  settingsTab === id ? "bg-navy-900 text-white" : "text-gray-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {settingsTab === "teams" && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("work.teamsTitle")}</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {projectTeams.length === 0 && (
                <p className="text-xs text-gray-500">{t("work.noLinkedTeam")}</p>
              )}
              {projectTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/work/teams/${team.id}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-bold"
                  style={{
                    backgroundColor: teamColor(team.id),
                    color: labelTextColor(teamColor(team.id)),
                  }}
                >
                  {team.name}
                </Link>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <Field label={t("work.linkTeam")}>
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">{t("work.choose")}</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" loading={saving} onClick={() => void addTeam()}>
                {t("common.add")}
              </Button>
            </div>
            <p className="mb-1.5 text-xs font-medium text-ink">{t("work.inviteColleague")}</p>
            <div className="space-y-2">
              <Select
                value={inviteTeamId}
                onChange={(e) => setInviteTeamId(e.target.value)}
              >
                <option value="">{t("work.targetTeam")}</option>
                {(projectTeams.length ? projectTeams : teams).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <PhoneSuggest value={invitePhone} onChange={setInvitePhone} />
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                {ASSIGNABLE_TEAM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {workRoleLabel(t, role)}
                  </option>
                ))}
              </Select>
              <Input
                value={inviteTitle}
                onChange={(e) => setInviteTitle(e.target.value)}
                placeholder={t("work.positionOptional")}
              />
              <Button size="sm" loading={saving} onClick={() => void inviteToTeam()}>
                {t("work.inviteAdd")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t("work.teamClickHint")}
            </p>
          </section>
          )}
          {settingsTab === "labels" && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("work.labelsTitle")}</h3>
            <p className="mb-2 text-xs text-gray-500">{t("work.labelsHint")}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {labels.length === 0 && (
                <p className="text-xs text-gray-500">{t("work.labelExample")}</p>
              )}
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: label.color,
                    color: labelTextColor(label.color),
                  }}
                >
                  {label.name}
                  {project.can_manage_company && (
                    <button
                      type="button"
                      onClick={() => void deleteLabel(label.id)}
                      className="rounded-sm px-0.5 text-[11px] leading-none opacity-80 hover:bg-black/15 hover:opacity-100"
                      aria-label={t("work.deleteLabel")}
                      title={t("common.delete")}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="space-y-2">
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder={t("work.labelName")}
              />
              <div className="flex flex-wrap items-center gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    className={`size-6 rounded-full ${
                      newLabelColor === color ? "ring-2 ring-navy-900/40 ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {newLabelName.trim() && (
                <span
                  className="inline-flex rounded px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: newLabelColor,
                    color: labelTextColor(newLabelColor),
                  }}
                >
                  {newLabelName.trim()}
                </span>
              )}
              <Button size="sm" loading={saving} onClick={() => void createLabel()}>
                {t("work.createLabel")}
              </Button>
            </div>
          </section>
          )}
          {settingsTab === "board" && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("work.columnsTitle")}</h3>
            <p className="mb-3 text-xs text-gray-500">
              {t("work.columnsHint")}
            </p>
            <ul className="space-y-3">
              {columns.map((column) => (
                <li key={column.id} className="rounded-xl border border-black/[0.06] p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <Input
                      value={columnNames[column.id] ?? column.name}
                      onChange={(event) =>
                        setColumnNames((current) => ({
                          ...current,
                          [column.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={saving}
                      onClick={() =>
                        void patchColumn(column.id, {
                          name: (columnNames[column.id] ?? column.name).trim(),
                        })
                      }
                    >
                      {t("common.save")}
                    </Button>
                    {columns.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void removeColumn(column.id)}
                      >
                        {t("common.delete")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {LABEL_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => void patchColumn(column.id, { color })}
                        className={`size-5 rounded-full ${
                          column.color.toLowerCase() === color.toLowerCase()
                            ? "ring-2 ring-navy-900/30 ring-offset-1"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2 rounded-xl border border-dashed border-black/10 p-2.5">
              <p className="text-xs font-medium text-ink">{t("work.newColumn")}</p>
              <Input
                value={newColumnName}
                onChange={(event) => setNewColumnName(event.target.value)}
                placeholder={t("work.columnExample")}
              />
              <div className="flex flex-wrap gap-1.5">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColumnColor(color)}
                    className={`size-5 rounded-full ${
                      newColumnColor === color ? "ring-2 ring-navy-900/30 ring-offset-1" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
              <Button
                size="sm"
                loading={saving}
                onClick={() => {
                  if (!newColumnName.trim()) {
                    setFormError(t("work.columnNameRequired"));
                    return;
                  }
                  setSaving(true);
                  void addColumn(newColumnName.trim(), newColumnColor)
                    .catch((err) => {
                      setFormError(
                        err instanceof ApiError ? err.message : t("work.addColumnFail"),
                      );
                    })
                    .finally(() => setSaving(false));
                }}
              >
                {t("work.addColumn")}
              </Button>
            </div>
          </section>
          )}
          {settingsTab === "templates" && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("work.policyTitle")}</h3>
            <p className="mb-2 text-xs text-gray-500">
              {t("work.policyHint")}
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(
                [
                  [null, t("work.policyFollow")],
                  [true, t("work.policyOn")],
                  [false, t("work.policyOff")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => void setApprovalPolicy(value)}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    project.require_approval_before_close === value
                      ? "bg-navy-900 text-white"
                      : "border border-gray-200 text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[11px] text-gray-500">
              {project.require_approval ? t("work.policyNowOn") : t("work.policyNowOff")}
            </p>
            <h3 className="mb-2 text-sm font-semibold text-ink">{t("work.defaultBoards")}</h3>
            <p className="mb-3 text-xs text-gray-500">
              {t("work.defaultBoardsHint")}
            </p>
            <ul className="mb-3 space-y-2">
              {templates.length === 0 && (
                <li className="text-xs text-gray-500">{t("work.noTemplate")}</li>
              )}
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="rounded-xl border border-black/[0.06] p-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{template.name}</p>
                      {template.is_platform && (
                        <span className="text-[11px] font-bold text-brand-700">{t("work.platformBoard")}</span>
                      )}
                      {template.is_default && !template.is_platform && (
                        <span className="text-[11px] font-bold text-brand-700">{t("work.companyDefault")}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={saving}
                        onClick={() => void applyBoardTemplate(template.id)}
                      >
                        {t("work.useBoard")}
                      </Button>
                      {project.can_manage_company && !template.is_platform && (
                        <>
                          {!template.is_default && (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={saving}
                              onClick={() => void setDefaultTemplate(template.id)}
                            >
                              {t("work.makeDefault")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void deleteTemplate(template.id)}
                          >
                            {t("common.delete")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.columns.map((column) => (
                      <span
                        key={column.id}
                        className="rounded px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: column.color,
                          color: labelTextColor(column.color),
                        }}
                      >
                        {column.name}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            {project.can_manage_company ? (
              <div className="space-y-2 rounded-xl border border-dashed border-black/10 p-2.5">
                <p className="text-xs font-medium text-ink">{t("work.newDefaultBoard")}</p>
                <Input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder={t("work.templateName")}
                />
                <label className="flex items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={templateDefault}
                    onChange={(event) => setTemplateDefault(event.target.checked)}
                  />
                  {t("work.saveAsDefault")}
                </label>
                {templateCols.map((row, index) => (
                  <div key={index} className="space-y-1.5 rounded-lg bg-[#F7F8FA] p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={row.name}
                        onChange={(event) =>
                          setTemplateCols((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={t("work.columnN", { n: index + 1 })}
                      />
                      {templateCols.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setTemplateCols((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                        >
                          {t("common.delete")}
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {LABEL_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            setTemplateCols((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, color } : item,
                              ),
                            )
                          }
                          className={`size-5 rounded-full ${
                            row.color.toLowerCase() === color.toLowerCase()
                              ? "ring-2 ring-navy-900/30 ring-offset-1"
                              : ""
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={color}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setTemplateCols((current) => [
                      ...current,
                      { name: "", color: LABEL_COLORS[current.length % LABEL_COLORS.length] },
                    ])
                  }
                >
                  {t("work.anotherColumn")}
                </Button>
                <Button size="sm" loading={saving} onClick={() => void saveTemplate()}>
                  {t("work.saveTemplate")}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                {t("work.onlyCompanyTemplate")}
              </p>
            )}
          </section>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={teamOpen} title={t("work.addTeamToProject")} onClose={() => setTeamOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.tab.teams")}>
            <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t("work.choose")}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-gray-500">
            {t("work.teamMembersHint")}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTeamOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={addTeam}>
              {t("common.add")}
            </Button>
          </div>
        </div>
      </Modal>
      <WorkMeetModal />
    </div>
    </WorkMeetScope>
  );
}
