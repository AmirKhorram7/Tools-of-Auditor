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
  Select,
  Textarea,
} from "@/components/ui";
import { ApiError, apiDownload, apiFetch, apiList } from "@/lib/api";
import {
  PROJECT_MEMBER_ROLE_OPTIONS,
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_OPTIONS,
  canEditProject,
  canManageMembers,
  type Process,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type ProjectStatus,
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

  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "owner">>("viewer");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSaving, setShareSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const changeStatus = async (nextStatus: ProjectStatus) => {
    if (!project || nextStatus === project.status) return;
    setStatusSaving(true);
    setStatusError(null);
    setStatusSuccess(null);
    try {
      const updated = await apiFetch<Project>(`/projects/${projectId}/`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      setProject(updated);
      setStatusSuccess("وضعیت پروژه ذخیره شد.");
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : "تغییر وضعیت ناموفق بود.",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const rootId = project?.parent ?? projectId;

  const loadMembers = async () => {
    setShareError(null);
    try {
      const data = await apiFetch<ProjectMember[]>(`/projects/${rootId}/members/`);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "دریافت اعضا ناموفق بود.");
    }
  };

  const openShare = async () => {
    setShareOpen(true);
    await loadMembers();
  };

  const inviteMember = async () => {
    if (!invitePhone.trim()) {
      setShareError("شماره موبایل الزامی است.");
      return;
    }
    setShareSaving(true);
    setShareError(null);
    try {
      await apiFetch(`/projects/${rootId}/members/`, {
        method: "POST",
        body: { phone_number: invitePhone.trim(), role: inviteRole },
      });
      setInvitePhone("");
      await loadMembers();
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "دعوت ناموفق بود.");
    } finally {
      setShareSaving(false);
    }
  };

  const removeMember = async (memberId: number) => {
    setShareSaving(true);
    setShareError(null);
    try {
      await apiFetch(`/projects/${rootId}/members/${memberId}/`, {
        method: "DELETE",
      });
      await loadMembers();
    } catch (err) {
      setShareError(err instanceof ApiError ? err.message : "حذف عضو ناموفق بود.");
    } finally {
      setShareSaving(false);
    }
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      await apiDownload(
        `/projects/${projectId}/export-pdf/`,
        `project-${projectId}.pdf`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "دانلود PDF ناموفق بود.");
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  if (!project) return <Alert>پروژه پیدا نشد.</Alert>;

  const editable = canEditProject(project.my_role);
  const manageMembers = canManageMembers(project.my_role);
  const canDeleteRoot = project.my_role === "owner";

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">{project.name}</h1>
            <Badge tone="blue">{PROJECT_STATUS_LABELS[project.status]}</Badge>
            {!project.is_root && <Badge>زیرپروژه</Badge>}
            {project.my_role && (
              <Badge tone={project.is_shared_with_me ? "amber" : "green"}>
                {PROJECT_ROLE_LABELS[project.my_role]}
              </Badge>
            )}
            {project.is_shared_with_me && <Badge>اشتراک‌شده با من</Badge>}
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
          <Button variant="secondary" disabled={pdfLoading} onClick={downloadPdf}>
            {pdfLoading ? "در حال ساخت PDF..." : "دانلود PDF"}
          </Button>
          {manageMembers && (
            <Button variant="secondary" onClick={openShare}>
              اشتراک‌گذاری
            </Button>
          )}
          {(canDeleteRoot || (editable && !project.is_root)) && (
            <Button
              variant="secondary"
              className="text-red-600 hover:border-red-300 hover:bg-red-50"
              onClick={() => askDelete({ kind: "self" })}
            >
              {project.is_root ? "حذف پروژه" : "حذف زیرپروژه"}
            </Button>
          )}
          {editable && project.is_root && (
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
          {editable && (
            <Button
              onClick={() => {
                setFormError(null);
                setProcessOpen(true);
              }}
            >
              + فرایند
            </Button>
          )}
        </div>
      </div>

      <Card className="max-w-md">
        <Field
          label="وضعیت پروژه"
          hint={
            editable
              ? "با تغییر وضعیت، بلافاصله ذخیره می‌شود."
              : "فقط مالک و ویرایشگر می‌توانند وضعیت را تغییر دهند."
          }
        >
          <Select
            value={project.status}
            disabled={statusSaving || !editable}
            onChange={(event) =>
              changeStatus(event.target.value as ProjectStatus)
            }
          >
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        {statusSaving && (
          <p className="mt-2 text-xs text-gray-500">در حال ذخیره...</p>
        )}
        {statusError && (
          <div className="mt-3">
            <Alert tone="error">{statusError}</Alert>
          </div>
        )}
        {statusSuccess && (
          <div className="mt-3">
            <Alert tone="success">{statusSuccess}</Alert>
          </div>
        )}
      </Card>

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
                    {editable && (
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
                    )}
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
              editable ? (
                <Button onClick={() => setProcessOpen(true)}>ساخت فرایند</Button>
              ) : undefined
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
                  {editable && (
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
                  )}
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

      <Modal
        open={shareOpen}
        title="اشتراک‌گذاری پروژه"
        onClose={() => setShareOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            با دعوت از طریق شماره موبایل، کل این پروژه (و زیرپروژه‌ها و فرایندها)
            برای همکار یا مدیر شما قابل مشاهده می‌شود.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <Field label="شماره موبایل">
              <Input
                value={invitePhone}
                onChange={(event) => setInvitePhone(event.target.value)}
                placeholder="0912xxxxxxx"
                dir="ltr"
              />
            </Field>
            <Field label="نقش">
              <Select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as Exclude<ProjectRole, "owner">)
                }
              >
                {PROJECT_MEMBER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button loading={shareSaving} onClick={inviteMember}>
                دعوت
              </Button>
            </div>
          </div>
          {shareError && <Alert>{shareError}</Alert>}
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-sm font-medium text-ink">اعضای فعلی</p>
            {members.length === 0 ? (
              <p className="text-sm text-gray-500">هنوز عضوی دعوت نشده است.</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {`${member.first_name} ${member.last_name}`.trim() ||
                        member.phone_number}
                    </p>
                    <p className="text-xs text-gray-500" dir="ltr">
                      {member.phone_number} · {PROJECT_ROLE_LABELS[member.role]}
                    </p>
                  </div>
                  {member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      disabled={shareSaving}
                      onClick={() => removeMember(member.id)}
                    >
                      حذف
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
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
