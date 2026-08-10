"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  Textarea,
} from "@/components/ui";
import { ApiError, apiFetch, apiList } from "@/lib/api";
import { PROJECT_STATUS_LABELS, type Project } from "@/lib/types";

export default function ExplanationServicePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, setPending] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await apiList<Project>("/projects/?roots_only=true"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "دریافت پروژه‌ها ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createProject = async () => {
    if (!name.trim()) {
      setFormError("نام پروژه الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "ساخت پروژه ناموفق بود.");
    } finally {
      setSaving(false);
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
      setDeleteError(err instanceof ApiError ? err.message : "حذف پروژه ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">تشریح سیستم</h1>
          <p className="mt-1 text-sm text-gray-500">
            پروژه اصلی شرکت را بسازید، زیرپروژه‌ها و فرایندها را در آن مستند کنید.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ پروژه جدید</Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <EmptyState
          title="هنوز پروژه‌ای ندارید"
          description="برای شروع، یک پروژه اصلی مثل «سیستم دوشه» بسازید."
          action={<Button onClick={() => setModalOpen(true)}>ساخت پروژه</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="flex h-full flex-col transition hover:border-brand-500 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/explanation/projects/${project.id}`}
                  className="font-semibold text-link hover:text-link-hover hover:underline"
                >
                  {project.name}
                </Link>
                <Badge tone="blue">
                  {PROJECT_STATUS_LABELS[project.status]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {project.company_name || "بدون نام شرکت"}
              </p>
              {project.description && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span>{project.sub_project_count ?? 0} زیرپروژه</span>
                <span>{project.process_count ?? 0} فرایند</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setDeleteError(null);
                    setPending(project);
                  }}
                >
                  حذف
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="پروژه جدید"
        onClose={() => setModalOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createProject();
          }}
        >
          <Field label="نام پروژه">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="مثال: سیستم دوشه"
              autoFocus
            />
          </Field>
          <Field label="نام شرکت">
            <Input
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="مثال: شرکت دوشه"
            />
          </Field>
          <Field label="توضیحات">
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="هدف و دامنه این پروژه"
            />
          </Field>

          {formError && <Alert>{formError}</Alert>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ساخت پروژه
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title="حذف پروژه"
        description={`پروژه «${pending?.name ?? ""}» به همراه زیرپروژه‌ها و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟`}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
