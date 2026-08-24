"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui";
import CompanyDashboard from "@/components/work/CompanyDashboard";
import JalaliDateField from "@/components/work/JalaliDateField";
import WorkBreadcrumb from "@/components/work/WorkBreadcrumb";
import WorkGuide from "@/components/work/WorkGuide";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  workPriorityLabel,
  type WorkBoardTemplate,
  type WorkCompany,
  type WorkProject,
  type WorkTeam,
} from "@/lib/work";

export default function WorkCompanyPage() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params.id);
  const { t } = useI18n();

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
  const [boardTemplateId, setBoardTemplateId] = useState("");
  const [templates, setTemplates] = useState<WorkBoardTemplate[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [policyBusy, setPolicyBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<WorkProject | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState("2");

  const load = useCallback(async () => {
    if (!Number.isFinite(companyId)) return;
    setLoading(true);
    setError(null);
    try {
      const [row, teamRows, projectRows, templateRows] = await Promise.all([
        apiFetch<WorkCompany>(`/work/companies/${companyId}/`),
        apiList<WorkTeam>(`/work/teams/?company=${companyId}`),
        apiList<WorkProject>(`/work/projects/?company=${companyId}`),
        apiList<WorkBoardTemplate>(`/work/board-templates/?company=${companyId}`),
      ]);
      setCompany(row);
      setTeams(teamRows);
      setProjects(projectRows);
      setTemplates(templateRows);
      const platform = templateRows.find((item) => item.is_platform);
      setBoardTemplateId((current) => current || (platform ? String(platform.id) : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.loadCompanyFail"));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const createTeam = async () => {
    if (!teamName.trim()) {
      setFormError(t("work.teamRequired"));
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
      setFormError(err instanceof ApiError ? err.message : t("work.createTeamFail"));
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async (project: WorkProject) => {
    if (!window.confirm(t("work.deleteProjectConfirm"))) return;
    setBusyId(project.id);
    setError(null);
    try {
      await apiFetch(`/work/projects/${project.id}/`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.deleteProjectFail"));
    } finally {
      setBusyId(null);
    }
  };

  const togglePolicy = async () => {
    if (!company || policyBusy) return;
    setPolicyBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<WorkCompany>(`/work/companies/${companyId}/`, {
        method: "PATCH",
        body: {
          require_approval_before_close: !company.require_approval_before_close,
        },
      });
      setCompany(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("work.savePolicyFail"));
    } finally {
      setPolicyBusy(false);
    }
  };

  const openEdit = (project: WorkProject) => {
    setEditProject(project);
    setEditName(project.name);
    setEditDesc(project.description || "");
    setEditDue(project.due_date || "");
    setEditPriority(String(project.priority));
    setFormError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editProject) return;
    if (!editName.trim()) {
      setFormError(t("work.projectRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiFetch<WorkProject>(`/work/projects/${editProject.id}/`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          description: editDesc.trim(),
          due_date: editDue || null,
          priority: Number(editPriority),
        },
      });
      setProjects((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      setEditOpen(false);
      setEditProject(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createProjectFail"));
    } finally {
      setSaving(false);
    }
  };

  const createProject = async () => {
    if (!projectName.trim()) {
      setFormError(t("work.projectRequired"));
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
          board_template_id: boardTemplateId ? Number(boardTemplateId) : undefined,
        },
      });
      setProjectOpen(false);
      setProjectName("");
      setProjectDesc("");
      setProjectDue("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("work.createProjectFail"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!company) {
    return <Alert>{error || t("work.companyMissing")}</Alert>;
  }

  return (
    <div className="flex h-[calc(100dvh-9.25rem)] flex-col gap-3 overflow-hidden pt-1 max-md:h-auto max-md:overflow-visible">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <WorkBreadcrumb
            fallbackHref="/work"
            items={[
              { href: "/work", label: t("work.crumb") },
              { label: company.name },
            ]}
          />
          <h1 className="flex items-center gap-1.5 text-base font-bold text-ink">
            {t("work.title")}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
              {company.name}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkGuide compact icon />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setFormError(null);
              setTeamOpen(true);
            }}
          >
            + {t("work.newTeam")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormError(null);
              setProjectOpen(true);
            }}
          >
            + {t("work.newProject")}
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <CompanyDashboard
        company={company}
        teams={teams}
        projects={projects}
        query={query}
        onQuery={setQuery}
        policyBusy={policyBusy}
        busyId={busyId}
        onTogglePolicy={() => void togglePolicy()}
        onAddTeam={() => {
          setFormError(null);
          setTeamOpen(true);
        }}
        onEditProject={openEdit}
        onDeleteProject={(project) => void removeProject(project)}
      />

      <Modal open={teamOpen} title={t("work.newTeam")} onClose={() => setTeamOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.teamName")}>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={t("work.teamExample")}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTeamOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createTeam}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={projectOpen} title={t("work.newProject")} onClose={() => setProjectOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.projectName")}>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t("work.projectExample")}
            />
          </Field>
          <Field label={t("work.description")}>
            <Textarea
              rows={3}
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
            />
          </Field>
          <Field label={t("work.due")}>
            <JalaliDateField value={projectDue} onChange={setProjectDue} />
          </Field>
          <Field label={t("work.priority")}>
            <Select
              value={projectPriority}
              onChange={(e) => setProjectPriority(e.target.value)}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {workPriorityLabel(t, value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("work.board")}>
            <Select
              value={boardTemplateId}
              onChange={(e) => setBoardTemplateId(e.target.value)}
            >
              <option value="">{t("work.simpleBoard")}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.is_platform ? t("work.platformSuffix") : ""}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setProjectOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={createProject}>
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title={t("work.editProject")} onClose={() => setEditOpen(false)}>
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <Field label={t("work.projectName")}>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </Field>
          <Field label={t("work.description")}>
            <Textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </Field>
          <Field label={t("work.due")}>
            <JalaliDateField value={editDue} onChange={setEditDue} />
          </Field>
          <Field label={t("work.priority")}>
            <Select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {workPriorityLabel(t, value)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={saving} onClick={() => void saveEdit()}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
