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
  cx,
} from "@/components/ui";
import DeskChat from "@/components/work/DeskChat";
import DoneCheck from "@/components/work/DoneCheck";
import JalaliDateField from "@/components/work/JalaliDateField";
import PrerequisitePicker from "@/components/work/PrerequisitePicker";
import ProgressGauge from "@/components/work/ProgressGauge";
import TaskBoard from "@/components/work/TaskBoard";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkFlowView from "@/components/work/WorkFlowView";
import WorkGuide from "@/components/work/WorkGuide";
import {
  WorkMeetLiveBar,
  WorkMeetModal,
  WorkMeetScope,
} from "@/components/work/meet/WorkMeetPanel";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { useAuth } from "@/lib/auth";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  deskSettingsHref,
  formatWorkDate,
  formatWorkDateTime,
  isOverdue,
  labelTextColor,
  taskStatusTone,
  workPriorityLabel,
  workStatusLabel,
  type WorkBoard,
  type WorkBoardColumn,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTask,
  type WorkTeam,
} from "@/lib/work";

const VIEW_KEY = "ta-work-desk-view";
const CHAT_KEY = "ta-work-desk-chat";

type ChatLayout = "closed" | "side" | "full";

function readChatLayout(raw: string | null): ChatLayout {
  if (raw === "0" || raw === "closed") return "closed";
  if (raw === "2" || raw === "full") return "full";
  return "side";
}

function IconChat() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5A2.5 2.5 0 0 1 13.5 13H9l-3.5 3v-3H6.5A2.5 2.5 0 0 1 4 10.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ViewIconBoard() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function ViewIconList() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path d="M2 3.5h12M2 8h12M2 12.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ViewIconFlow() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <circle cx="3.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="4" r="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12.5" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.5 8h3M8.5 8 11 5.2M8.5 8 11 10.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export default function DeskPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const { profile } = useAuth();
  const { t, locale, dir } = useI18n();

  const [project, setProject] = useState<WorkProject | null>(null);
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [projectTeams, setProjectTeams] = useState<WorkTeam[]>([]);
  const [labels, setLabels] = useState<WorkLabel[]>([]);
  const [view, setView] = useState<"board" | "list" | "flow">("board");
  const [selectedPrereqs, setSelectedPrereqs] = useState<number[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLayout, setChatLayout] = useState<ChatLayout>("side");

  const [taskOpen, setTaskOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("2");
  const [difficulty, setDifficulty] = useState("1");
  const [assignee, setAssignee] = useState("");
  const [columnId, setColumnId] = useState<number | "">("");
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "list" || stored === "board" || stored === "flow") setView(stored);
    setChatLayout(readChatLayout(window.localStorage.getItem(CHAT_KEY)));
  }, []);

  const setChatVisible = (next: ChatLayout) => {
    setChatLayout(next);
    window.localStorage.setItem(
      CHAT_KEY,
      next === "closed" ? "0" : next === "full" ? "2" : "1",
    );
  };

  const setSavedView = (next: "board" | "list" | "flow") => {
    setView(next);
    window.localStorage.setItem(VIEW_KEY, next);
  };

  const load = useCallback(
    async (silent = false) => {
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
        const [labelRows, linkedTeams] = await Promise.all([
          apiFetch<WorkLabel[]>(`/work/companies/${row.company}/labels/`),
          apiFetch<WorkTeam[]>(`/work/projects/${projectId}/teams/`),
        ]);
        setLabels(Array.isArray(labelRows) ? labelRows : []);
        setProjectTeams(Array.isArray(linkedTeams) ? linkedTeams : []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("work.loadDeskFail"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId, t],
  );

  useEffect(() => {
    load();
  }, [load]);

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

  const removeTask = async (id: number) => {
    if (!window.confirm(t("work.deleteTaskConfirm"))) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/work/tasks/${id}/`, { method: "DELETE" });
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.deleteTaskFail"));
    } finally {
      setBusyId(null);
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
    await apiFetch(`/work/projects/${projectId}/columns/`, {
      method: "POST",
      body: { name, color, status_key: "in_progress" },
    });
    await load(true);
  };

  if (loading) return <PageLoader />;
  if (!project) return <Alert>{error || t("work.deskMissing")}</Alert>;

  const canAddTask = Boolean(project.can_add_task ?? project.can_manage);

  return (
    <WorkMeetScope
      projectId={project.id}
      members={members}
      teams={projectTeams}
      canCreate={canAddTask}
    >
      <div className="flex h-[calc(100vh-6.75rem)] min-h-[36rem] flex-col gap-2 pt-2">
        <header className="flex shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-navy-900/10 bg-white px-3 py-2">
          <WorkBreadcrumb
            fallbackHref="/work"
            items={[{ href: "/work", label: t("work.crumb") }, { label: project.name }]}
          />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-navy-900 text-white">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d="M4 5h7v6H4V5Zm9 0h7v6h-7V5ZM4 13h7v6H4v-6Zm9 0h7v6h-7v-6Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-bold text-ink">{project.name}</h1>
              <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-[11px] font-semibold text-navy-800">
                {t("work.desk")}
              </span>
              <ProgressGauge value={project.progress_percent} size={24} />
            </div>
            <p className="truncate text-[11px] text-gray-500">
              {t("work.deskMeta", {
                owner: project.owner_name || t("work.none"),
                date: formatWorkDateTime(project.created_at, locale, "—"),
              })}
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-[#F2F3F5] p-0.5 text-sm">
            {(
              [
                { key: "board" as const, label: t("work.board"), icon: <ViewIconBoard /> },
                { key: "list" as const, label: t("work.list"), icon: <ViewIconList /> },
                { key: "flow" as const, label: t("work.flow"), icon: <ViewIconFlow /> },
              ]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSavedView(item.key)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 ${
                  view === item.key
                    ? "bg-white font-semibold text-navy-900 shadow-sm"
                    : "text-gray-500 hover:text-navy-800"
                }`}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMineOnly((value) => !value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              mineOnly
                ? "border-brand-500 bg-brand-100 text-ink"
                : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            {mineOnly ? t("work.mine") : t("work.allTasks")}
          </button>
          {canAddTask && (
            <Button size="sm" onClick={() => openTaskModal()}>
              + {t("work.addTask")}
            </Button>
          )}
          <Link href={deskSettingsHref(project.id)}>
            <Button size="sm" variant="secondary">
              {t("work.settings")}
            </Button>
          </Link>
          <WorkGuide compact />
        </header>

        <WorkMeetLiveBar />
        {error && <Alert>{error}</Alert>}

        <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row" dir="ltr">
          {chatLayout !== "closed" ? (
            <div
              className={cx(
                "flex w-full shrink-0 flex-col",
                chatLayout === "full"
                  ? "h-[min(72vh,42rem)] md:h-full"
                  : "h-[19rem] md:h-full md:w-[22rem] lg:w-[24rem]",
              )}
            >
              <DeskChat
                projectId={project.id}
                members={members}
                teams={projectTeams}
                currentUserId={myUserId}
                expanded={chatLayout === "full"}
                onToggleExpand={() =>
                  setChatVisible(chatLayout === "full" ? "side" : "full")
                }
                onCollapse={() => setChatVisible("closed")}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setChatVisible("side")}
              className="flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-navy-900/10 bg-white text-navy-800 shadow-[0_1px_4px_rgba(20,35,58,0.06)] hover:border-brand-500 md:h-full md:w-10 md:flex-col md:py-3"
              title={t("work.chatOpen")}
              aria-label={t("work.chatOpen")}
            >
              <IconChat />
              <span className="text-[10px] font-semibold md:[writing-mode:vertical-rl]">
                {t("work.chat")}
              </span>
            </button>
          )}

          {chatLayout !== "full" && (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto" dir={dir}>

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
                  canAddTask ? t("work.emptyBoardManage") : t("work.emptyBoardOther")
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
                  ...(project.can_manage ? [t("work.colActions")] : []),
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
                            task.status === "done"
                              ? "text-gray-400 line-through"
                              : "text-navy-900"
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
                      {project.can_manage && (
                        <WorkTd>
                          <button
                            type="button"
                            disabled={busyId === task.id}
                            onClick={() => void removeTask(task.id)}
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {t("work.deleteTask")}
                          </button>
                        </WorkTd>
                      )}
                    </tr>
                  );
                })}
              </WorkTable>
            )}
          </div>
          )}
        </div>
      </div>

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
              <Select
                value={String(columnId)}
                onChange={(e) => setColumnId(Number(e.target.value) || "")}
              >
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
              <p className="text-xs text-gray-500">{t("work.noLabelsYet")}</p>
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
                          active
                            ? current.filter((id) => id !== label.id)
                            : [...current, label.id],
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
      <WorkMeetModal />
    </WorkMeetScope>
  );
}
