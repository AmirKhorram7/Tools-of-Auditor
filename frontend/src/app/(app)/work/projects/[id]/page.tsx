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
import TaskBoard from "@/components/work/TaskBoard";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkTable, { WorkTd } from "@/components/work/WorkTable";
import { useAuth } from "@/lib/auth";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import {
  LABEL_COLORS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  colorAlpha,
  formatFaDate,
  isOverdue,
  labelTextColor,
  taskStatusTone,
  teamColor,
  type WorkBoard,
  type WorkBoardColumn,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTask,
  type WorkTeam,
} from "@/lib/work";

const VIEW_KEY = "ta-work-project-view";

export default function WorkProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const { profile } = useAuth();

  const [project, setProject] = useState<WorkProject | null>(null);
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [projectTeams, setProjectTeams] = useState<WorkTeam[]>([]);
  const [labels, setLabels] = useState<WorkLabel[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [taskOpen, setTaskOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[4]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState(LABEL_COLORS[1]);
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [teamId, setTeamId] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_KEY);
    if (stored === "list" || stored === "board") setView(stored);
  }, []);

  const setSavedView = (next: "board" | "list") => {
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "بارگذاری پروژه ناموفق بود.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId]);

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
    setColumnId(column?.id || columns[0]?.id || "");
    setTaskOpen(true);
  };

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
          start_date: startDate || null,
          due_date: due || null,
          priority: Number(priority),
          difficulty: Number(difficulty),
          assigned_to: assignee ? Number(assignee) : null,
          column: columnId || null,
          label_ids: selectedLabels,
        },
      });
      setTaskOpen(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setDue("");
      setAssignee("");
      setSelectedLabels([]);
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت کار ناموفق بود.");
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
      setFormError(err instanceof ApiError ? err.message : "ساخت برچسب ناموفق بود.");
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
      await load(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تغییر وضعیت کار ناموفق بود.");
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
      setError(err instanceof ApiError ? err.message : "جابه‌جایی کار فقط برای مسئول و مدیر است.");
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
      setFormError(err instanceof ApiError ? err.message : "ذخیره ستون ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const removeColumn = async (columnId: number) => {
    if (columns.length < 2) {
      setFormError("حداقل یک ستون باید بماند.");
      return;
    }
    if (!window.confirm("این ستون حذف شود؟ کارها به ستون دیگر می‌روند.")) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/columns/${columnId}/`, {
        method: "DELETE",
      });
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "حذف ستون ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const inviteToTeam = async () => {
    if (!inviteTeamId) {
      setFormError("یک تیم انتخاب کنید.");
      return;
    }
    if (!invitePhone.trim()) {
      setFormError("شماره موبایل الزامی است.");
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
        },
      });
      await apiFetch(`/work/projects/${projectId}/add-team/`, {
        method: "POST",
        body: { team_id: Number(inviteTeamId) },
      });
      setInvitePhone("");
      setInviteTitle("");
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "دعوت همکار ناموفق بود.");
    } finally {
      setSaving(false);
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
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "افزودن تیم ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!project) return <Alert>{error || "پروژه پیدا نشد."}</Alert>;

  return (
    <div className="space-y-4">
      <WorkBreadcrumb
        fallbackHref={`/work/companies/${project.company}`}
        items={[
          { href: "/work", label: "کار" },
          {
            href: `/work/companies/${project.company}`,
            label: project.company_name || "شرکت",
          },
          { label: project.name },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">{project.name}</h1>
            <Badge tone="blue">
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </Badge>
            <ProgressGauge value={project.progress_percent} size={58} />
          </div>
          {project.description ? (
            <p className="mt-1 line-clamp-1 text-sm text-gray-500">{project.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {project.can_manage && (
            <Button size="sm" onClick={() => openTaskModal()}>
              افزودن کار
            </Button>
          )}
          {project.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => setTeamOpen(true)}>
              افزودن تیم
            </Button>
          )}
          {project.can_manage && (
            <Button size="sm" variant="secondary" onClick={() => { setFormError(null); setSettingsOpen(true); }}>
              تنظیمات
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {projectTeams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {projectTeams.map((team) => (
            <Link
              key={team.id}
              href={`/work/teams/${team.id}`}
              className="rounded-lg px-3 py-1.5 text-sm font-bold shadow-sm"
              style={{
                backgroundColor: teamColor(team.id),
                color: labelTextColor(teamColor(team.id)),
              }}
            >
              {team.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setSavedView("board")}
            className={`rounded-md px-3 py-1.5 ${view === "board" ? "bg-navy-900 text-white" : "text-gray-600"}`}
          >
            بورد
          </button>
          <button
            type="button"
            onClick={() => setSavedView("list")}
            className={`rounded-md px-3 py-1.5 ${view === "list" ? "bg-navy-900 text-white" : "text-gray-600"}`}
          >
            فهرست
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMineOnly((value) => !value)}
          className={`rounded-full border px-3 py-1 text-xs ${
            mineOnly ? "border-brand-500 bg-brand-100 text-ink" : "border-gray-200 bg-white text-gray-600"
          }`}
        >
          {mineOnly ? "کارهای من" : "همه کارها"}
        </button>
      </div>

      {view === "board" && board ? (
        <TaskBoard
          board={board}
          canManage={project.can_manage}
          mineOnly={mineOnly}
          currentUserId={myUserId}
          onMove={moveTask}
          onAddTask={openTaskModal}
          onAddColumn={project.can_manage ? addColumn : undefined}
        />
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          title="کاری در این نما نیست"
          description={
            project.can_manage
              ? "یک کار بسازید و مسئول بگذارید تا روی بورد دیده شود."
              : "هنوز کاری به این پروژه اضافه نشده."
          }
          action={
            project.can_manage ? (
              <Button size="sm" onClick={() => openTaskModal()}>
                کار جدید
              </Button>
            ) : undefined
          }
        />
      ) : (
        <WorkTable columns={["تمام", "کار", "مسئول", "وضعیت", "برچسب", "سررسید"]}>
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
                <WorkTd>{task.assignee_name || "بدون مسئول"}</WorkTd>
                <WorkTd>
                  <Badge tone={taskStatusTone(task.status)}>
                    {task.column_name || TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </WorkTd>
                <WorkTd>
                  <div className="flex flex-wrap gap-1">
                    {(task.labels || []).map((label) => (
                      <span
                        key={label.id}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: colorAlpha(label.color, 0.14),
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                </WorkTd>
                <WorkTd className={overdue ? "font-medium text-red-600" : ""}>
                  {formatFaDate(task.due_date)}
                </WorkTd>
              </tr>
            );
          })}
        </WorkTable>
      )}

      <Modal
        open={taskOpen}
        title="کار جدید"
        onClose={() => setTaskOpen(false)}
        className="max-w-xl max-h-[90vh] overflow-y-auto"
      >
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
            <Field label="شروع کار">
              <JalaliDateField value={startDate} onChange={setStartDate} />
            </Field>
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
            <Field label="ستون بورد">
              <Select value={String(columnId)} onChange={(e) => setColumnId(Number(e.target.value) || "")}>
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
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
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">برچسب‌ها</p>
            {labels.length === 0 ? (
              <p className="text-xs text-gray-500">
                هنوز برچسبی نیست. از تنظیمات پروژه بسازید.
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

      <Modal
        open={settingsOpen}
        title="تنظیمات پروژه"
        onClose={() => setSettingsOpen(false)}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-5">
          {formError && <Alert>{formError}</Alert>}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">تیم‌ها</h3>
            <div className="mb-3 flex flex-wrap gap-2">
              {projectTeams.length === 0 && (
                <p className="text-xs text-gray-500">یک تیم را به پروژه وصل کنید، بعد همکار دعوت کنید.</p>
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
              <Field label="وصل کردن تیم">
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">انتخاب کنید</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button size="sm" loading={saving} onClick={() => void addTeam()}>
                افزودن
              </Button>
            </div>
            <p className="mb-1.5 text-xs font-medium text-ink">دعوت / افزودن همکار</p>
            <div className="space-y-2">
              <Select
                value={inviteTeamId}
                onChange={(e) => setInviteTeamId(e.target.value)}
              >
                <option value="">تیم مقصد</option>
                {(projectTeams.length ? projectTeams : teams).map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <PhoneSuggest value={invitePhone} onChange={setInvitePhone} />
              <Input
                value={inviteTitle}
                onChange={(e) => setInviteTitle(e.target.value)}
                placeholder="سمت (اختیاری)"
              />
              <Button size="sm" loading={saving} onClick={() => void inviteToTeam()}>
                دعوت و افزودن
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              روی نام تیم بزنید تا عضو را حذف یا ویرایش کنید.
            </p>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">برچسب‌ها</h3>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {labels.length === 0 && (
                <p className="text-xs text-gray-500">مثلاً فورس‌ماژور یا مهم.</p>
              )}
              {labels.map((label) => (
                <span
                  key={label.id}
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: colorAlpha(label.color, 0.14),
                    color: label.color,
                  }}
                >
                  {label.name}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="نام برچسب"
                className="max-w-[180px]"
              />
              {LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewLabelColor(color)}
                  className={`size-5 rounded-full border ${
                    newLabelColor === color ? "border-navy-900" : "border-white"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <Button size="sm" loading={saving} onClick={() => void createLabel()}>
                ساخت
              </Button>
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">کارت‌های بورد</h3>
            <p className="mb-3 text-xs text-gray-500">
              نام و رنگ هر ستون را اینجا عوض کنید.
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
                      ذخیره
                    </Button>
                    {columns.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void removeColumn(column.id)}
                      >
                        حذف
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
              <p className="text-xs font-medium text-ink">ستون تازه</p>
              <Input
                value={newColumnName}
                onChange={(event) => setNewColumnName(event.target.value)}
                placeholder="مثلاً بازبینی"
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
                    setFormError("نام ستون الزامی است.");
                    return;
                  }
                  setSaving(true);
                  void addColumn(newColumnName.trim(), newColumnColor)
                    .catch((err) => {
                      setFormError(
                        err instanceof ApiError ? err.message : "افزودن ستون ناموفق بود.",
                      );
                    })
                    .finally(() => setSaving(false));
                }}
              >
                افزودن ستون
              </Button>
            </div>
          </section>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
              بستن
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
