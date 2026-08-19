"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import StepCanvas from "@/components/StepCanvas";
import ColorPicker from "@/components/explanation/ColorPicker";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  PageLoader,
  Select,
  Textarea,
} from "@/components/ui";
import { ApiError, apiDownload, apiFetch, apiList } from "@/lib/api";
import { cardPalette, type CardColor } from "@/lib/explanation";
import { useI18n } from "@/lib/i18n";
import {
  canEditProject,
  type Process,
  type ProcessStep,
  type ShapeType,
  type StepConnection,
} from "@/lib/types";

type Pending =
  | { kind: "step"; step: ProcessStep }
  | { kind: "process" }
  | null;

export default function ProcessCanvasPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, n } = useI18n();
  const processId = Number(params.id);

  const [process, setProcess] = useState<Process | null>(null);
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [connections, setConnections] = useState<StepConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [shape, setShape] = useState<ShapeType>("square");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [colorBusy, setColorBusy] = useState(false);

  const changeColor = async (color: CardColor) => {
    if (!process) return;
    const previous = process.color;
    setColorBusy(true);
    setError(null);
    setProcess({ ...process, color });
    try {
      await apiFetch(`/processes/${process.id}/`, {
        method: "PATCH",
        body: { color },
      });
    } catch {
      setProcess({ ...process, color: previous });
      setError(t("exp.colorProcessFail"));
    } finally {
      setColorBusy(false);
    }
  };

  const load = useCallback(async () => {
    if (!Number.isFinite(processId)) return;
    setLoading(true);
    setError(null);
    try {
      const [processData, stepList, connectionList] = await Promise.all([
        apiFetch<Process>(`/processes/${processId}/`),
        apiList<ProcessStep>(`/steps/?process=${processId}`),
        apiList<StepConnection>(`/connections/?process=${processId}`),
      ]);
      setProcess(processData);
      setSteps(stepList);
      setConnections(connectionList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.loadProcessFail"));
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    load();
  }, [load]);

  const addStep = async () => {
    if (!title.trim()) {
      setFormError(t("exp.stepTitleRequired"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      // Lay new shapes out in a simple grid so they never overlap.
      const index = steps.length;
      const created = await apiFetch<ProcessStep>("/steps/", {
        method: "POST",
        body: {
          process: processId,
          title: title.trim(),
          shape_type: shape,
          position_x: 40 + (index % 4) * 210,
          position_y: 40 + Math.floor(index / 4) * 180,
          order: index + 1,
        },
      });
      setSteps((current) => [...current, created]);
      setOpen(false);
      setTitle("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t("exp.addStepFail"));
    } finally {
      setSaving(false);
    }
  };

  const handleMoved = (moved: ProcessStep) =>
    setSteps((current) =>
      current.map((step) => (step.id === moved.id ? moved : step)),
    );

  const connect = async (fromStep: number, toStep: number) => {
    setError(null);
    try {
      const created = await apiFetch<StepConnection>("/connections/", {
        method: "POST",
        body: { from_step: fromStep, to_step: toStep },
      });
      setConnections((current) => [...current, created]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.connectFail"));
    }
  };

  const disconnect = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/connections/${id}/`, { method: "DELETE" });
      setConnections((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.disconnectFail"));
    }
  };

  const openEdit = () => {
    if (!process) return;
    setEditError(null);
    setEditName(process.name);
    setEditDepartment(process.department ?? "");
    setEditOwnerName(process.process_owner_name ?? "");
    setEditDescription(process.description ?? "");
    setEditOpen(true);
  };

  const saveProcessEdit = async () => {
    if (!editName.trim()) {
      setEditError(t("exp.processNameRequired"));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await apiFetch<Process>(`/processes/${processId}/`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          department: editDepartment.trim(),
          process_owner_name: editOwnerName.trim(),
          description: editDescription.trim(),
        },
      });
      setProcess(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : t("exp.saveFail"));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pending.kind === "step") {
        const stepId = pending.step.id;
        await apiFetch(`/steps/${stepId}/`, { method: "DELETE" });
        setSteps((current) => current.filter((item) => item.id !== stepId));
        // Arrows touching a deleted step are cascaded away on the server.
        setConnections((current) =>
          current.filter(
            (item) => item.from_step !== stepId && item.to_step !== stepId,
          ),
        );
        setPending(null);
      } else {
        await apiFetch(`/processes/${processId}/`, { method: "DELETE" });
        router.replace(`/explanation/projects/${process?.project ?? ""}`);
      }
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("exp.deleteFail"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !process) return <Alert>{error}</Alert>;
  if (!process) return <Alert>{t("exp.processNotFound")}</Alert>;

  const editable = canEditProject(process.my_role);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton fallbackHref={`/explanation/projects/${process.project}`} />
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <Link href="/explanation" className="hover:text-link">
            {t("exp.title")}
          </Link>
          <span>/</span>
          <Link
            href={`/explanation/projects/${process.project}`}
            className="hover:text-link"
          >
            {process.project_name || t("common.folder")}
          </Link>
          <span>/</span>
          <span className="font-medium text-ink">{process.name}</span>
        </nav>
      </div>

      <div
        className="relative rounded-2xl border p-5 ps-6"
        style={{
          backgroundColor: cardPalette(process.color).bg,
          borderColor: cardPalette(process.color).border,
        }}
      >
        <span
          className="absolute inset-y-0 w-1.5 rounded-s-2xl"
          style={{
            backgroundColor: cardPalette(process.color).accent,
            insetInlineStart: 0,
          }}
          aria-hidden
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold tracking-wide opacity-70"
              style={{ color: cardPalette(process.color).text }}
            >
              {t("common.process")}
            </p>
            <h1
              className="mt-0.5 text-xl font-bold"
              style={{ color: cardPalette(process.color).text }}
            >
              {process.name}
            </h1>
            <p className="mt-1 text-sm" style={{ color: cardPalette(process.color).muted }}>
              {process.department || t("exp.noDept")}
              {process.process_owner_name &&
                ` · ${t("exp.processOwnerLine", { name: process.process_owner_name })}`}
              {` · ${t("exp.stepsCount", { count: n(steps.length) })}`}
            </p>
          </div>
          {editable && (
            <ColorPicker
              value={process.color}
              busy={colorBusy}
              onSelect={changeColor}
              title={t("exp.colorThisProcess")}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button
            onClick={() => {
              setFormError(null);
              setOpen(true);
            }}
          >
            + {t("exp.addStep")}
          </Button>
        )}
        <Link href="/explanation/tree">
          <Button variant="secondary">{t("exp.treeView")}</Button>
        </Link>
        <Button
          variant="secondary"
          disabled={pdfLoading}
          onClick={async () => {
            setPdfLoading(true);
            try {
              await apiDownload(
                `/processes/${processId}/export-pdf/`,
                `process-${processId}.pdf`,
              );
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : t("exp.pdfFail"),
              );
            } finally {
              setPdfLoading(false);
            }
          }}
        >
          {pdfLoading ? t("exp.buildingPdf") : t("exp.downloadPdf")}
        </Button>
        {editable && (
          <>
            <Button variant="secondary" onClick={openEdit}>
              {t("common.edit")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteError(null);
                setPending({ kind: "process" });
              }}
              className="text-red-600 hover:border-red-300 hover:bg-red-50"
            >
              {t("exp.deleteProcess")}
            </Button>
          </>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="bg-brand-50">
        <p className="text-xs text-brand-800">
          {editable ? t("exp.canvasHintEdit") : t("exp.canvasHintView")}
        </p>
      </Card>

      <StepCanvas
        steps={steps}
        connections={connections}
        readOnly={!editable}
        onMoved={handleMoved}
        onConnect={connect}
        onDeleteConnection={disconnect}
        onDeleteStep={(step) => {
          setDeleteError(null);
          setPending({ kind: "step", step });
        }}
      />

      {steps.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("exp.stepList")}</h2>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-navy-800 text-xs font-medium text-white">
                  {index + 1}
                </span>
                <Link
                  href={`/explanation/steps/${step.id}`}
                  className="text-sm text-link hover:text-link-hover hover:underline"
                >
                  {step.title}
                </Link>
                <span className="ms-auto text-xs text-gray-400">
                  {t(`shape.${step.shape_type}`)}
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setDeleteError(null);
                      setPending({ kind: "step", step });
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal open={open} title={t("exp.addStep")} onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addStep();
          }}
        >
          <Field label={t("exp.stepTitle")}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("exp.stepTitlePlaceholder")}
              autoFocus
            />
          </Field>
          <Field label={t("exp.shapeOnCanvas")}>
            <Select
              value={shape}
              onChange={(event) => setShape(event.target.value as ShapeType)}
            >
              {(["square", "rectangle", "circle", "diamond", "oval"] as ShapeType[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {t(`shape.${value}`)}
                  </option>
                ),
              )}
            </Select>
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {t("common.add")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        title={t("exp.editProcess")}
        onClose={() => setEditOpen(false)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveProcessEdit();
          }}
        >
          <Field label={t("exp.processName")}>
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("exp.department")}>
              <Input
                value={editDepartment}
                onChange={(event) => setEditDepartment(event.target.value)}
              />
            </Field>
            <Field label={t("exp.processOwner")}>
              <Input
                value={editOwnerName}
                onChange={(event) => setEditOwnerName(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t("exp.description")}>
            <Textarea
              rows={3}
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
            />
          </Field>
          {editError && <Alert>{editError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={editSaving}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "process" ? t("exp.deleteProcess") : t("exp.deleteStep")}
        description={
          pending?.kind === "process"
            ? t("exp.deleteProcessDeepConfirm", { name: process.name })
            : t("exp.deleteStepConfirm", {
                name: pending?.kind === "step" ? pending.step.title : "",
              })
        }
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
