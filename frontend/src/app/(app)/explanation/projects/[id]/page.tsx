"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import ColorPicker from "@/components/explanation/ColorPicker";
import FolderCard from "@/components/explanation/FolderCard";
import ProcessCard from "@/components/explanation/ProcessCard";
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
  Select,
  Textarea,
} from "@/components/ui";
import { ApiError, apiDownload, apiFetch, apiList, mediaUrl } from "@/lib/api";
import { cardPalette, faNum, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";
import {
  PROJECT_MEMBER_ROLE_OPTIONS,
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_OPTIONS,
  canEditProject,
  canManageMembers,
  type Process,
  type Project,
  type ProjectMember,
  type ProjectRole,
  type ProjectStatus,
  type UserLookupResult,
} from "@/lib/types";

type Pending =
  | { kind: "sub-project"; id: number; name: string }
  | { kind: "process"; id: number; name: string }
  | { kind: "self" }
  | null;

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
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

  const [editTarget, setEditTarget] = useState<
    | { kind: "project"; item: Project }
    | { kind: "sub-project"; item: Project }
    | { kind: "process"; item: Process }
    | null
  >(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");

  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);
  /** Non-fatal errors (colour changes) — shown inline, page stays usable. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [colorBusy, setColorBusy] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProjectRole, "owner">>("viewer");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSaving, setShareSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [lookupHits, setLookupHits] = useState<UserLookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

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
      setFormError("نام زیرپوشه الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "ساخت زیرپوشه ناموفق بود.");
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

  const openEdit = (
    target:
      | { kind: "project"; item: Project }
      | { kind: "sub-project"; item: Project }
      | { kind: "process"; item: Process },
  ) => {
    setFormError(null);
    setEditTarget(target);
    if (target.kind === "process") {
      setEditName(target.item.name);
      setEditDepartment(target.item.department ?? "");
      setEditOwnerName(target.item.process_owner_name ?? "");
      setEditDescription(target.item.description ?? "");
      return;
    }
    setEditName(target.item.name);
    setEditCompany(target.item.company_name ?? "");
    setEditDescription(target.item.description ?? "");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) {
      setFormError("نام الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget.kind === "process") {
        const updated = await apiFetch<Process>(
          `/processes/${editTarget.item.id}/`,
          {
            method: "PATCH",
            body: {
              name: editName.trim(),
              department: editDepartment.trim(),
              process_owner_name: editOwnerName.trim(),
              description: editDescription.trim(),
            },
          },
        );
        setProcesses((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          ),
        );
      } else if (editTarget.kind === "sub-project") {
        const updated = await apiFetch<Project>(
          `/projects/${editTarget.item.id}/`,
          {
            method: "PATCH",
            body: { name: editName.trim() },
          },
        );
        setSubProjects((current) =>
          current.map((item) =>
            item.id === updated.id ? { ...item, ...updated } : item,
          ),
        );
      } else {
        const updated = await apiFetch<Project>(
          `/projects/${editTarget.item.id}/`,
          {
            method: "PATCH",
            body: {
              name: editName.trim(),
              company_name: editCompany.trim(),
              description: editDescription.trim(),
            },
          },
        );
        setProject(updated);
      }
      setEditTarget(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
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
      setStatusSuccess("وضعیت پوشه ذخیره شد.");
    } catch (err) {
      setStatusError(
        err instanceof ApiError ? err.message : "تغییر وضعیت ناموفق بود.",
      );
    } finally {
      setStatusSaving(false);
    }
  };

  const changeSelfColor = async (color: CardColor) => {
    if (!project) return;
    const previous = project.color;
    setColorBusy("self");
    setActionError(null);
    setProject({ ...project, color });
    try {
      await apiFetch(`/projects/${project.id}/`, {
        method: "PATCH",
        body: { color },
      });
    } catch {
      setProject({ ...project, color: previous });
      setActionError("تغییر رنگ پوشه ناموفق بود.");
    } finally {
      setColorBusy(null);
    }
  };

  const changeSubColor = async (sub: Project, color: CardColor) => {
    const previous = sub.color;
    setColorBusy(`sub-${sub.id}`);
    setActionError(null);
    setSubProjects((current) =>
      current.map((item) => (item.id === sub.id ? { ...item, color } : item)),
    );
    try {
      await apiFetch(`/projects/${sub.id}/`, {
        method: "PATCH",
        body: { color },
      });
    } catch {
      setSubProjects((current) =>
        current.map((item) =>
          item.id === sub.id ? { ...item, color: previous } : item,
        ),
      );
      setActionError("تغییر رنگ زیرپوشه ناموفق بود.");
    } finally {
      setColorBusy(null);
    }
  };

  const changeProcessColor = async (target: Process, color: CardColor) => {
    const previous = target.color;
    setColorBusy(`process-${target.id}`);
    setActionError(null);
    setProcesses((current) =>
      current.map((item) => (item.id === target.id ? { ...item, color } : item)),
    );
    try {
      await apiFetch(`/processes/${target.id}/`, {
        method: "PATCH",
        body: { color },
      });
    } catch {
      setProcesses((current) =>
        current.map((item) =>
          item.id === target.id ? { ...item, color: previous } : item,
        ),
      );
      setActionError("تغییر رنگ فرایند ناموفق بود.");
    } finally {
      setColorBusy(null);
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
    setLookupHits([]);
    setInvitePhone("");
    await loadMembers();
  };

  const searchInviteUser = async (phone: string) => {
    setInvitePhone(phone);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) {
      setLookupHits([]);
      return;
    }
    setLookupLoading(true);
    try {
      const hits = await apiFetch<UserLookupResult[]>(
        `/users/lookup/?phone=${encodeURIComponent(digits)}`,
      );
      setLookupHits(Array.isArray(hits) ? hits : []);
    } catch {
      setLookupHits([]);
    } finally {
      setLookupLoading(false);
    }
  };

  const pickLookupUser = (user: UserLookupResult) => {
    setInvitePhone(user.phone_number);
    setLookupHits([]);
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
      setLookupHits([]);
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
  if (!project) return <Alert>پوشه پیدا نشد.</Alert>;

  const editable = canEditProject(project.my_role);
  const manageMembers = canManageMembers(project.my_role);
  const canDeleteRoot = project.my_role === "owner";

  const palette = cardPalette(project.color);
  const kindLabel = project.is_root ? t("common.folder") : t("common.subfolder");

  const confirmCopy =
    pending?.kind === "self"
      ? {
          title: project.is_root ? "حذف پوشه" : "حذف زیرپوشه",
          description: `«${project.name}» به همراه همه زیرپوشه‌ها و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟`,
        }
      : pending?.kind === "sub-project"
        ? {
            title: "حذف زیرپوشه",
            description: `زیرپوشه «${pending.name}» و فرایندهای آن حذف می‌شود. ادامه می‌دهید؟`,
          }
        : {
            title: "حذف فرایند",
            description: `فرایند «${pending?.kind === "process" ? pending.name : ""}» و همه گام‌های آن حذف می‌شود. ادامه می‌دهید؟`,
          };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton
          fallbackHref={
            project.parent
              ? `/explanation/projects/${project.parent}`
              : "/explanation"
          }
        />
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
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
                {project.parent_name || "پوشه اصلی"}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="font-medium text-ink">{project.name}</span>
        </nav>
      </div>

      <div
        className="rounded-2xl border p-5"
        style={{ backgroundColor: palette.bg, borderColor: palette.border }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ backgroundColor: palette.accent }}
            >
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                <path
                  fill="currentColor"
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3h3.2c.7 0 1.35.33 1.76.9l.72 1.02c.15.2.38.33.63.33h4.69A2.5 2.5 0 0 1 20 7.75v9.75A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold tracking-wide opacity-70"
                style={{ color: palette.text }}
              >
                {kindLabel}
              </p>
              <h1
                className="mt-0.5 text-xl font-bold"
                style={{ color: palette.text }}
              >
                {project.name}
              </h1>
              <p className="mt-1 text-sm" style={{ color: palette.muted }}>
                {project.company_name || t("dash.noCompany")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="blue">{t(`status.${project.status}`)}</Badge>
                {project.my_role && (
                  <Badge tone={project.is_shared_with_me ? "amber" : "green"}>
                    {t(`role.${project.my_role}`)}
                  </Badge>
                )}
                {project.is_shared_with_me && <Badge>{t("exp.sharedWithMe")}</Badge>}
                <span
                  className="text-xs opacity-80"
                  style={{ color: palette.text }}
                >
                  {faNum(processes.length)} فرایند
                </span>
              </div>
              {project.description && (
                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          {editable && (
            <ColorPicker
              value={project.color}
              busy={colorBusy === "self"}
              onSelect={changeSelfColor}
              title="رنگ این پوشه"
            />
          )}
        </div>

        {!project.is_root && (
          <p className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-xs text-gray-600">
            دسترسی اعضا در پوشه اصلی تنظیم می‌شود.{" "}
            {project.parent && (
              <Link
                href={`/explanation/projects/${project.parent}`}
                className="font-medium text-link hover:text-link-hover"
              >
                رفتن به پوشه اصلی
              </Link>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
        {editable && project.is_root && (
          <Button
            variant="secondary"
            onClick={() => {
              setFormError(null);
              setSubOpen(true);
            }}
          >
            + زیرپوشه
          </Button>
        )}
        <Link href={`/explanation/tree?root=${rootId}`}>
          <Button variant="secondary">نمای درختی</Button>
        </Link>
        {editable && (
          <Button
            variant="secondary"
            onClick={() => openEdit({ kind: "project", item: project })}
          >
            ویرایش
          </Button>
        )}
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
            {project.is_root ? "حذف پوشه" : "حذف زیرپوشه"}
          </Button>
        )}

        <div className="ms-auto flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500">{t("common.status")}</span>
          <select
            value={project.status}
            disabled={statusSaving || !editable}
            title={
              editable
                ? "با تغییر وضعیت، بلافاصله ذخیره می‌شود."
                : "فقط مالک و ویرایشگر می‌توانند وضعیت را تغییر دهند."
            }
            className="h-8 w-[7.25rem] rounded-md border border-gray-300 bg-white px-2 text-xs text-ink outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            onChange={(event) =>
              changeStatus(event.target.value as ProjectStatus)
            }
          >
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`status.${option.value}`)}
              </option>
            ))}
          </select>
          {statusSaving && (
            <span className="text-[11px] text-gray-500">ذخیره...</span>
          )}
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {statusError && <Alert tone="error">{statusError}</Alert>}
      {statusSuccess && <Alert tone="success">{statusSuccess}</Alert>}

      {/* Sub-folders are optional, so the section only appears once one exists. */}
      {project.is_root && subProjects.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">زیرپوشه‌ها</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subProjects.map((sub) => (
              <FolderCard
                key={sub.id}
                name={sub.name}
                href={`/explanation/projects/${sub.id}`}
                color={sub.color}
                kindLabel={t("common.subfolder")}
                editable={editable}
                busy={colorBusy === `sub-${sub.id}`}
                onColor={(color) => changeSubColor(sub, color)}
                onEdit={() => openEdit({ kind: "sub-project", item: sub })}
                onDelete={() =>
                  askDelete({
                    kind: "sub-project",
                    id: sub.id,
                    name: sub.name,
                  })
                }
                meta={<span>{faNum(sub.process_count ?? 0)} فرایند</span>}
              />
            ))}
          </div>
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
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {processes.map((process) => (
              <ProcessCard
                key={process.id}
                name={process.name}
                href={`/explanation/processes/${process.id}`}
                color={process.color}
                department={process.department}
                stepCount={process.step_count ?? 0}
                editable={editable}
                busy={colorBusy === `process-${process.id}`}
                onColor={(color) => changeProcessColor(process, color)}
                onEdit={() => openEdit({ kind: "process", item: process })}
                onDelete={() =>
                  askDelete({
                    kind: "process",
                    id: process.id,
                    name: process.name,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <Modal open={subOpen} title="زیرپوشه جدید" onClose={() => setSubOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createSubProject();
          }}
        >
          <Field label="نام زیرپوشه">
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
        title="اشتراک‌گذاری پوشه"
        onClose={() => setShareOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            با دعوت از طریق شماره موبایل، کل این پوشه (و زیرپوشه‌ها و فرایندها)
            برای همکار یا مدیر شما قابل مشاهده می‌شود.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <Field
              label="شماره موبایل"
              hint="با تایپ شماره، کاربران ثبت‌شده پیشنهاد می‌شوند."
            >
              <div className="relative">
                <Input
                  value={invitePhone}
                  onChange={(event) => searchInviteUser(event.target.value)}
                  placeholder="0912xxxxxxx"
                  dir="ltr"
                  autoComplete="off"
                />
                {(lookupLoading || lookupHits.length > 0) && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
                    {lookupLoading && lookupHits.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-500">در حال جستجو...</p>
                    )}
                    {lookupHits.map((user) => {
                      const name =
                        `${user.first_name} ${user.last_name}`.trim() || "کاربر تی‌ادیتور";
                      const avatar = mediaUrl(user.profile_image);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => pickLookupUser(user)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-surface"
                        >
                          {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={avatar}
                              alt=""
                              className="size-8 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex size-8 items-center justify-center rounded-full bg-navy-800 text-xs font-medium text-white">
                              {(user.first_name || user.phone_number).slice(0, 1)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {name}
                            </span>
                            <span className="block text-xs text-gray-500" dir="ltr">
                              {user.phone_number}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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
              members.map((member) => {
                const name =
                  `${member.first_name} ${member.last_name}`.trim() ||
                  member.phone_number;
                const avatar = mediaUrl(member.profile_image);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          className="size-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-medium text-white">
                          {name.slice(0, 1)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{name}</p>
                        <p className="text-xs text-gray-500" dir="ltr">
                          {member.phone_number} · {PROJECT_ROLE_LABELS[member.role]}
                        </p>
                      </div>
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
                );
              })
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={editTarget !== null}
        title={
          editTarget?.kind === "process"
            ? "ویرایش فرایند"
            : editTarget?.kind === "sub-project"
              ? "ویرایش زیرپوشه"
              : "ویرایش پوشه"
        }
        onClose={() => setEditTarget(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveEdit();
          }}
        >
          <Field
            label={
              editTarget?.kind === "process"
                ? "نام فرایند"
                : editTarget?.kind === "sub-project"
                  ? "نام زیرپوشه"
                  : "نام پوشه"
            }
          >
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              autoFocus
            />
          </Field>

          {editTarget?.kind === "project" && (
            <>
              <Field label="نام شرکت">
                <Input
                  value={editCompany}
                  onChange={(event) => setEditCompany(event.target.value)}
                />
              </Field>
              <Field label="توضیحات">
                <Textarea
                  rows={3}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </Field>
            </>
          )}

          {editTarget?.kind === "process" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="واحد سازمانی">
                  <Input
                    value={editDepartment}
                    onChange={(event) => setEditDepartment(event.target.value)}
                  />
                </Field>
                <Field label="مالک فرایند">
                  <Input
                    value={editOwnerName}
                    onChange={(event) => setEditOwnerName(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="توضیحات">
                <Textarea
                  rows={3}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </Field>
            </>
          )}

          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditTarget(null)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ذخیره
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
