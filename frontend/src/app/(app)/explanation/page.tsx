"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import ExplanationGuide from "@/components/explanation/ExplanationGuide";
import FolderCard from "@/components/explanation/FolderCard";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  Textarea,
} from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { faNum, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";
import { canEditProject, type Project } from "@/lib/types";

export default function ExplanationServicePage() {
  const { t, n, locale } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [pending, setPending] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [colorBusy, setColorBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await apiList<Project>("/projects/?roots_only=true"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.loadFoldersFail"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createProject = async () => {
    if (!name.trim()) {
      setFormError(t("exp.nameRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch<Project>("/projects/", {
        method: "POST",
        body: {
          name: name.trim(),
          company_name: company.trim(),
          description: description.trim(),
        },
      });
      setModalOpen(false);
      setName("");
      setCompany("");
      setDescription("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("exp.createFail"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (project: Project) => {
    setFormError(null);
    setEditProject(project);
    setEditName(project.name);
    setEditCompany(project.company_name ?? "");
    setEditDescription(project.description ?? "");
  };

  const saveEdit = async () => {
    if (!editProject) return;
    if (!editName.trim()) {
      setFormError(t("exp.nameRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiFetch<Project>(`/projects/${editProject.id}/`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          company_name: editCompany.trim(),
          description: editDescription.trim(),
        },
      });
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setEditProject(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("exp.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const changeColor = async (project: Project, color: CardColor) => {
    const previous = project.color;
    setColorBusy(project.id);
    setProjects((current) =>
      current.map((item) => (item.id === project.id ? { ...item, color } : item)),
    );
    try {
      await apiFetch(`/projects/${project.id}/`, {
        method: "PATCH",
        body: { color },
      });
    } catch {
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? { ...item, color: previous } : item,
        ),
      );
      setError(t("exp.colorFail"));
    } finally {
      setColorBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/projects/${pending.id}/`, { method: "DELETE" });
      setProjects((current) => current.filter((item) => item.id !== pending.id));
      setPending(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("exp.deleteFail"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">{t("exp.title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("exp.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExplanationGuide compact />
          <Link href="/explanation/tree">
            <Button variant="secondary">{t("exp.treeView")}</Button>
          </Link>
          <Button onClick={() => setModalOpen(true)}>+ {t("exp.newFolder")}</Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <EmptyState
          title={t("exp.emptyTitle")}
          description={t("exp.emptyDesc")}
          action={<Button onClick={() => setModalOpen(true)}>{t("exp.createFolder")}</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <FolderCard
              key={project.id}
              name={project.name}
              href={`/explanation/projects/${project.id}`}
              color={project.color}
              kindLabel={t("common.folder")}
              subtitle={project.company_name || null}
              description={project.description || null}
              editable={canEditProject(project.my_role)}
              busy={colorBusy === project.id}
              onColor={(color) => changeColor(project, color)}
              onEdit={() => openEdit(project)}
              onDelete={
                project.my_role === "owner"
                  ? () => {
                      setDeleteError(null);
                      setPending(project);
                    }
                  : undefined
              }
              badge={
                <>
                  <Badge tone="blue">{t(`status.${project.status}`)}</Badge>
                  {project.is_shared_with_me && project.my_role && (
                    <Badge tone="amber">{t(`role.${project.my_role}`)}</Badge>
                  )}
                </>
              }
              meta={
                <>
                  {(project.sub_project_count ?? 0) > 0 && (
                    <span>
                      {t("dash.subfolders", {
                        count: locale === "fa" ? faNum(project.sub_project_count ?? 0) : n(project.sub_project_count ?? 0),
                      })}
                    </span>
                  )}
                  <span>
                    {t("dash.processes", {
                      count: locale === "fa" ? faNum(project.process_count ?? 0) : n(project.process_count ?? 0),
                    })}
                  </span>
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal open={modalOpen} title={t("exp.newFolder")} onClose={() => setModalOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createProject();
          }}
        >
          <Field label={t("exp.folderName")} hint={t("exp.folderHint")}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("exp.folderPlaceholder")}
              autoFocus
            />
          </Field>
          <Field label={t("exp.companyOptional")}>
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder={t("exp.companyPlaceholder")}
            />
          </Field>
          <Field label={t("exp.description")}>
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("exp.folderGoal")}
            />
          </Field>

          {formError && <Alert>{formError}</Alert>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("exp.createFolder")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editProject !== null}
        title={t("exp.editFolder")}
        onClose={() => setEditProject(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveEdit();
          }}
        >
          <Field label={t("exp.folderName")}>
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t("exp.companyOptional")}>
            <Input
              value={editCompany}
              onChange={(event) => setEditCompany(event.target.value)}
            />
          </Field>
          <Field label={t("exp.description")}>
            <Textarea
              rows={3}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditProject(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={t("exp.deleteFolder")}
        description={t("exp.deleteFolderConfirm", { name: pending?.name ?? "" })}
        confirmLabel={t("common.delete")}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
