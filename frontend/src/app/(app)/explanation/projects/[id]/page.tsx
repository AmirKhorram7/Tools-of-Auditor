"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  PROJECT_STATUS_LABELS,
  type Process,
  type Project,
} from "@/lib/types";

type Pending =
  | { kind: "sub-project"; id: number; name: string }
  | { kind: "process"; id: number; name: string }
  | { kind: "self" }
  | null;

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [subProjects, setSubProjects] = useState<Project[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [processOpen, setProcessOpen] = useState(false);
  const [processName, setProcessName] = useState("");
  const [processDepartment, setProcessDepartment] = useState("");
  const [processOwnerName, setProcessOwnerName] = useState("");
  const [processDescription, setProcessDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, children, projectProcesses] = await Promise.all([
        apiFetch<Project>(`/projects/${projectId}/`),
        apiList<Project>(`/projects/?parent=${projectId}`),
        apiList<Process>(`/processes/?project=${projectId}`),
      ]);
      setProject(detail);
      setSubProjects(children);
      setProcesses(projectProcesses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "دریافت اطلاعات ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const createSubProject = async () => {
    if (!subName.trim()) {
      setFormError("نام زیرپروژه الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/projects/", {
        method: "POST",
        body: { name: subName.trim(), parent: projectId },
      });
      setSubOpen(false);
      setSubName("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت زیرپروژه ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const createProcess = async () => {
    if (!processName.trim()) {
      setFormError("نام فرایند الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/processes/", {
        method: "POST",
        body: {
          project: projectId,
          name: processName.trim(),
          department: processDepartment.trim(),
          process_owner_name: processOwnerName.trim(),
          description: processDescription.trim(),
          order: processes.length + 1,
        },
      });
      setProcessOpen(false);
      setProcessName("");
      setProcessDepartment("");
      setProcessOwnerName("");
      setProcessDescription("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ساخت فرایند ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pending.kind === "sub-project") {
        await apiFetch(`/projects/${pending.id}/`, { method: "DELETE" });
        setSubProjects((current) =>
          current.filter((item) => item.id !== pending.id),
        );
        setPending(null);
      } else if (pending.kind === "process") {
        await apiFetch(`/processes/${pending.id}/`, { method: "DELETE" });
        setProcesses((current) => current.filter((item) => item.id !== pending.id));
        setPending(null);
      } else {
        await apiFetch(`/projects/${projectId}/`, { method: "DELETE" });
        router.replace(
          project?.parent
            ? `/explanation/projects/${project.parent}`
            : "/explanation",
        );
      }
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "حذف ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  };

  const askDelete = (next: Pending) => {
    setDeleteError(null);
    setPending(next);
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  if (!project) return <Alert>پروژه پیدا نشد.</Alert>;

  const confirmCopy =
    pending?.kind === "self"
      ? {
          title: project.is_root ? "حذف پروژه" : "حذف زیرپروژه",
          description: `«${project.name}» به همراه همه زیرپروژه‌ها و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟`,
        }
      : pending?.kind === "sub-project"
        ? {
            title: "حذف زیرپروژه",
            description: `زیرپروژه «${pending.name}» و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟`,
          }
        : {
            title: "حذف فرایند",
            description: `فرایند «${pending?.kind === "process" ? pending.name : ""}» و همه گام‌های آن حذف می‌شود. ادامه می‌دهید؟`,
          };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/explanation" className="hover:text-link">
          تشریح سیستم
        </Link>
        {project.parent && (
          <>
            <span>/</span>
            <Link
              href={`/explanation/projects/${project.parent}`}
              className="hover:text-link"
            >
              پروژه اصلی
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-ink">{project.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-ink">{project.name}</h1>
            <Badge tone="blue">{PROJECT_STATUS_LABELS[project.status]}</Badge>
            {!project.is_root && <Badge>زیرپروژه</Badge>}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {project.company_name || "بدون نام شرکت"}
          </p>
          {project.description && (
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="text-red-600 hover:border-red-300 hover:bg-red-50"
            onClick={() => askDelete({ kind: "self" })}
          >
            {project.is_root ? "حذف پروژه" : "حذف زیرپروژه"}
          </Button>
          {project.is_root && (
            <Button
              variant="secondary"
              onClick={() => {
                setFormError(null);
                setSubOpen(true);
              }}
            >
              + زیرپروژه
            </Button>
          )}
          <Button
            onClick={() => {
              setFormError(null);
              setProcessOpen(true);
            }}
          >
            + فرایند
          </Button>
        </div>
      </div>

      {project.is_root && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">زیرپروژه‌ها</h2>
          {subProjects.length === 0 ? (
            <EmptyState
              title="زیرپروژه‌ای ثبت نشده است"
              description="برای گروه‌بندی فرایندها می‌توانید زیرپروژه بسازید (اختیاری)."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subProjects.map((sub) => (
                <Card
                  key={sub.id}
                  className="flex h-full flex-col transition hover:border-brand-500 hover:shadow-md"
                >
                  <Link
                    href={`/explanation/projects/${sub.id}`}
                    className="font-medium text-link hover:text-link-hover hover:underline"
                  >
                    {sub.name}
                  </Link>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span>{sub.process_count ?? 0} فرایند</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ms-auto text-red-600 hover:bg-red-50"
                      onClick={() =>
                        askDelete({
                          kind: "sub-project",
                          id: sub.id,
                          name: sub.name,
                        })
                      }
                    >
                      حذف
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">فرایندها</h2>
        {processes.length === 0 ? (
          <EmptyState
            title="فرایندی ثبت نشده است"
            description="مثال: فرایند تدارکات، فرایند فروش، فرایند درآمد"
            action={
              <Button onClick={() => setProcessOpen(true)}>ساخت فرایند</Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {processes.map((process) => (
              <Card
                key={process.id}
                className="flex h-full flex-col transition hover:border-brand-500 hover:shadow-md"
              >
                <Link
                  href={`/explanation/processes/${process.id}`}
                  className="font-medium text-link hover:text-link-hover hover:underline"
                >
                  {process.name}
                </Link>
                <p className="mt-1 text-xs text-gray-500">
                  {process.department || "بدون واحد سازمانی"}
                </p>
                <div className="mt-3 flex items-center border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>{process.step_count ?? 0} گام مستندشده</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ms-auto text-red-600 hover:bg-red-50"
                    onClick={() =>
                      askDelete({
                        kind: "process",
                        id: process.id,
                        name: process.name,
                      })
                    }
                  >
                    حذف
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal open={subOpen} title="زیرپروژه جدید" onClose={() => setSubOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createSubProject();
          }}
        >
          <Field label="نام زیرپروژه">
            <Input
              value={subName}
              onChange={(event) => setSubName(event.target.value)}
              placeholder="مثال: حوزه مالی"
              autoFocus
            />
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSubOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ساخت
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={processOpen}
        title="فرایند جدید"
        onClose={() => setProcessOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createProcess();
          }}
        >
          <Field label="نام فرایند">
            <Input
              value={processName}
              onChange={(event) => setProcessName(event.target.value)}
              placeholder="مثال: فرایند تدارکات"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="واحد سازمانی">
              <Input
                value={processDepartment}
                onChange={(event) => setProcessDepartment(event.target.value)}
                placeholder="مثال: بازرگانی"
              />
            </Field>
            <Field label="مالک فرایند">
              <Input
                value={processOwnerName}
                onChange={(event) => setProcessOwnerName(event.target.value)}
                placeholder="نام مسئول فرایند"
              />
            </Field>
          </div>
          <Field label="توضیحات">
            <Textarea
              rows={3}
              value={processDescription}
              onChange={(event) => setProcessDescription(event.target.value)}
            />
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProcessOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ساخت
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={confirmCopy.title}
        description={confirmCopy.description}
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
