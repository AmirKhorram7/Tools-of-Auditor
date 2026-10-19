"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CalendarColorGrid } from "@/components/CalendarColorPicker";
import {
  Alert,
  Button,
  Field,
  Input,
  PageLoader,
  Select,
} from "@/components/ui";
import PhoneSuggest from "@/components/work/PhoneSuggest";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import { WorkMeetButton, WorkMeetModal, WorkMeetScope } from "@/components/work/meet/WorkMeetPanel";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  ASSIGNABLE_TEAM_ROLES,
  BOARD_COLUMN_COLORS,
  LABEL_COLORS,
  deskHref,
  formatWorkDateTime,
  labelTextColor,
  teamColor,
  workRoleLabel,
  type WorkBoard,
  type WorkBoardTemplate,
  type WorkLabel,
  type WorkProject,
  type WorkProjectMember,
  type WorkTeam,
} from "@/lib/work";

export default function DeskSettingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const router = useRouter();
  const { t, locale } = useI18n();

  const [project, setProject] = useState<WorkProject | null>(null);
  const [board, setBoard] = useState<WorkBoard | null>(null);
  const [members, setMembers] = useState<WorkProjectMember[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [projectTeams, setProjectTeams] = useState<WorkTeam[]>([]);
  const [labels, setLabels] = useState<WorkLabel[]>([]);
  const [templates, setTemplates] = useState<WorkBoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTeamName, setNewTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [inviteRole, setInviteRole] = useState("developer");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#E67C73");
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState<string>(BOARD_COLUMN_COLORS.inProgress);
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [templateName, setTemplateName] = useState("");
  const [templateDefault, setTemplateDefault] = useState(true);
  const [templateCols, setTemplateCols] = useState<Array<{ name: string; color: string }>>([]);

  useEffect(() => {
    setTemplateCols([
      { name: t("work.col.todo"), color: BOARD_COLUMN_COLORS.todo },
      { name: t("work.col.doing"), color: BOARD_COLUMN_COLORS.inProgress },
      { name: t("work.col.test"), color: BOARD_COLUMN_COLORS.test },
      { name: t("work.col.wait"), color: BOARD_COLUMN_COLORS.waiting },
      { name: t("work.col.done"), color: BOARD_COLUMN_COLORS.done },
    ]);
  }, [locale, t]);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, boardRow, memberRows] = await Promise.all([
        apiFetch<WorkProject>(`/work/projects/${projectId}/`),
        apiFetch<WorkBoard>(`/work/projects/${projectId}/board/`),
        apiFetch<WorkProjectMember[]>(`/work/projects/${projectId}/members/`),
      ]);
      setProject(row);
      setBoard(boardRow);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      const [teamRows, labelRows, linkedTeams, templateRows] = await Promise.all([
        apiList<WorkTeam>(`/work/teams/?company=${row.company}`),
        apiFetch<WorkLabel[]>(`/work/companies/${row.company}/labels/`),
        apiFetch<WorkTeam[]>(`/work/projects/${projectId}/teams/`),
        apiList<WorkBoardTemplate>(`/work/board-templates/?company=${row.company}`).catch(
          () => [] as WorkBoardTemplate[],
        ),
      ]);
      setTeams(teamRows);
      setLabels(Array.isArray(labelRows) ? labelRows : []);
      setProjectTeams(Array.isArray(linkedTeams) ? linkedTeams : []);
      setTemplates(templateRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadDeskFail"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!board) return;
    setColumnNames(Object.fromEntries(board.columns.map((column) => [column.id, column.name])));
  }, [board]);

  const columns = board?.columns || [];

  const createTeam = async () => {
    if (!newTeamName.trim()) {
      setFormError(t("work.teamRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/teams/`, {
        method: "POST",
        body: { name: newTeamName.trim() },
      });
      setNewTeamName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createTeamFail"));
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
      setTeamId("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.addTeamFail"));
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
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.inviteColleagueFail"));
    } finally {
      setSaving(false);
    }
  };

  const createLabel = async () => {
    if (!project || !newLabelName.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/companies/${project.company}/labels/`, {
        method: "POST",
        body: { name: newLabelName.trim(), color: newLabelColor },
      });
      setNewLabelName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createLabelFail"));
    } finally {
      setSaving(false);
    }
  };

  const patchLabelColor = async (labelId: number, color: string) => {
    if (!project) return;
    try {
      const row = await apiFetch<WorkLabel>(
        `/work/companies/${project.company}/labels/${labelId}/`,
        { method: "PATCH", body: { color } },
      );
      setLabels((current) => current.map((item) => (item.id === labelId ? row : item)));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createLabelFail"));
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
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteLabelFail"));
    } finally {
      setSaving(false);
    }
  };

  const patchColumn = async (columnId: number, body: { name?: string; color?: string }) => {
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/columns/${columnId}/`, {
        method: "PATCH",
        body,
      });
      await load();
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
      await apiFetch(`/work/projects/${projectId}/columns/${columnId}/`, { method: "DELETE" });
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteColumnFail"));
    } finally {
      setSaving(false);
    }
  };

  const addColumn = async () => {
    if (!newColumnName.trim()) {
      setFormError(t("work.columnNameRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch(`/work/projects/${projectId}/columns/`, {
        method: "POST",
        body: { name: newColumnName.trim(), color: newColumnColor, status_key: "in_progress" },
      });
      setNewColumnName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.addColumnFail"));
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
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.savePolicyFail"));
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
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.applyBoardFail"));
    } finally {
      setSaving(false);
    }
  };

  const saveTemplate = async () => {
    if (!project || !templateName.trim()) {
      setFormError(t("work.templateNameRequired"));
      return;
    }
    const cols = templateCols.filter((row) => row.name.trim());
    if (cols.length === 0) {
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
          columns: cols,
        },
      });
      setTemplateName("");
      await load();
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
      await load();
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
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.deleteTemplateFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeDesk = async () => {
    if (!project) return;
    if (!window.confirm(t("work.deleteDeskConfirm"))) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/work/projects/${project.id}/`, { method: "DELETE" });
      router.push("/work");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.deleteDeskFail"));
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!project) return <Alert>{error || t("work.deskMissing")}</Alert>;

  const canManage = project.can_manage;
  const canAddTask = Boolean(project.can_add_task ?? project.can_manage);

  return (
    <WorkMeetScope
      projectId={project.id}
      members={members}
      teams={projectTeams}
      canCreate={canAddTask}
    >
      <div className="mx-auto max-w-3xl space-y-4 pt-4">
        <WorkBreadcrumb
          fallbackHref={deskHref(project.id)}
          items={[
            { href: "/work", label: t("work.crumb") },
            { href: deskHref(project.id), label: project.name },
            { label: t("work.settings") },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-ink">{t("work.deskSettingsTitle")}</h1>
            <p className="mt-1 text-xs text-gray-500">
              {t("work.deskMeta", {
                owner: project.owner_name || t("work.none"),
                date: formatWorkDateTime(project.created_at, locale, "—"),
              })}
            </p>
          </div>
          <Link href={deskHref(project.id)}>
            <Button size="sm" variant="secondary">
              {t("work.backToDesk")}
            </Button>
          </Link>
        </div>

        {error && <Alert>{error}</Alert>}
        {formError && <Alert>{formError}</Alert>}

        <section className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <h2 className="text-sm font-bold text-ink">{t("work.policyTitle")}</h2>
          <p className="mt-1 text-xs leading-6 text-gray-500">{t("work.policyHint")}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
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
          <p className="mt-3 text-[11px] text-gray-500">
            {project.require_approval ? t("work.policyNowOn") : t("work.policyNowOff")}
          </p>
        </section>

        <section className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">{t("work.teamsTitle")}</h2>
            <WorkMeetButton />
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            {projectTeams.length === 0 && (
              <p className="text-xs text-gray-500 sm:col-span-2">{t("work.noLinkedTeam")}</p>
            )}
            {projectTeams.map((team) => (
              <Link
                key={team.id}
                href={`/work/teams/${team.id}`}
                className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold transition hover:opacity-90"
                style={{
                  backgroundColor: teamColor(team.id),
                  color: labelTextColor(teamColor(team.id)),
                }}
              >
                <span className="truncate">{team.name}</span>
                <span className="text-[11px] font-medium opacity-80">{t("work.openTeam")}</span>
              </Link>
            ))}
          </div>
          {canManage && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("work.newTeam")}>
                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={t("work.teamName")}
                  />
                </Field>
                <Button size="sm" loading={saving} onClick={() => void createTeam()}>
                  {t("work.createTeam")}
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
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
              <p className="text-xs font-medium text-ink">{t("work.inviteColleague")}</p>
              <div className="space-y-2">
                <Select value={inviteTeamId} onChange={(e) => setInviteTeamId(e.target.value)}>
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
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">{t("work.labelsTitle")}</h2>
          <p className="mb-2 text-xs text-gray-500">{t("work.labelsHint")}</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {labels.length === 0 && <p className="text-xs text-gray-500">{t("work.labelExample")}</p>}
            {labels.map((label) => (
              <span
                key={label.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  setEditingLabelId((current) => (current === label.id ? null : label.id))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setEditingLabelId((current) => (current === label.id ? null : label.id));
                  }
                }}
                className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
                  editingLabelId === label.id ? "ring-2 ring-navy-900 ring-offset-1" : ""
                }`}
                style={{
                  backgroundColor: label.color,
                  color: labelTextColor(label.color),
                }}
              >
                {label.name}
                {project.can_manage_company && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteLabel(label.id);
                    }}
                    className="rounded-sm px-0.5 text-[11px] leading-none opacity-80 hover:bg-black/15"
                    aria-label={t("work.deleteLabel")}
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
            <CalendarColorGrid
              value={
                editingLabelId
                  ? labels.find((item) => item.id === editingLabelId)?.color ?? newLabelColor
                  : newLabelColor
              }
              onChange={(color) => {
                if (editingLabelId) {
                  void patchLabelColor(editingLabelId, color);
                  return;
                }
                setNewLabelColor(color);
              }}
            />
            <Button size="sm" loading={saving} onClick={() => void createLabel()}>
              {t("work.createLabel")}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">{t("work.columnsTitle")}</h2>
          <p className="mb-3 text-xs text-gray-500">{t("work.columnsHint")}</p>
          <ul className="space-y-3">
            {columns.map((column) => (
              <li key={column.id} className="rounded-xl border border-black/[0.06] p-2.5">
                <div className="flex items-center gap-2">
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
                    <Button size="sm" variant="ghost" onClick={() => void removeColumn(column.id)}>
                      {t("common.delete")}
                    </Button>
                  )}
                </div>
                <div className="mt-2">
                  <CalendarColorGrid
                    value={column.color}
                    onChange={(color) => void patchColumn(column.id, { color })}
                  />
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
            <CalendarColorGrid value={newColumnColor} onChange={setNewColumnColor} />
            <Button size="sm" loading={saving} onClick={() => void addColumn()}>
              {t("work.addColumn")}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-navy-900/10 bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">{t("work.defaultBoards")}</h2>
          <p className="mb-3 text-xs text-gray-500">{t("work.defaultBoardsHint")}</p>
          <ul className="mb-3 space-y-2">
            {templates.length === 0 && (
              <li className="text-xs text-gray-500">{t("work.noTemplate")}</li>
            )}
            {templates.map((template) => (
              <li key={template.id} className="rounded-xl border border-black/[0.06] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{template.name}</p>
                    {template.is_platform && (
                      <span className="text-[11px] font-bold text-brand-700">
                        {t("work.platformBoard")}
                      </span>
                    )}
                    {template.is_default && !template.is_platform && (
                      <span className="text-[11px] font-bold text-brand-700">
                        {t("work.companyDefault")}
                      </span>
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
                            itemIndex === index ? { ...item, name: event.target.value } : item,
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
                  <CalendarColorGrid
                    value={row.color}
                    onChange={(color) =>
                      setTemplateCols((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, color } : item,
                        ),
                      )
                    }
                  />
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
            <p className="text-xs text-gray-500">{t("work.onlyCompanyTemplate")}</p>
          )}
        </section>

        {canManage && (
          <div className="flex justify-between pb-8">
            <Button variant="danger" loading={saving} onClick={() => void removeDesk()}>
              {t("work.deleteDesk")}
            </Button>
          </div>
        )}
      </div>
      <WorkMeetModal />
    </WorkMeetScope>
  );
}
