"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import StepCanvas from "@/components/StepCanvas";
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
} from "@/components/ui";
import { ApiError, apiDownload, apiFetch, apiList } from "@/lib/api";
import {
  SHAPE_LABELS,
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
      setError(err instanceof ApiError ? err.message : "دریافت فرایند ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => {
    load();
  }, [load]);

  const addStep = async () => {
    if (!title.trim()) {
      setFormError("عنوان گام الزامی است.");
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
      setFormError(err instanceof ApiError ? err.message : "افزودن گام ناموفق بود.");
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
      setError(err instanceof ApiError ? err.message : "ایجاد اتصال ناموفق بود.");
    }
  };

  const disconnect = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/connections/${id}/`, { method: "DELETE" });
      setConnections((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حذف اتصال ناموفق بود.");
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
      setDeleteError(err instanceof ApiError ? err.message : "حذف ناموفق بود.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !process) return <Alert>{error}</Alert>;
  if (!process) return <Alert>فرایند پیدا نشد.</Alert>;

  const editable = canEditProject(process.my_role);

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-gray-500">
        <Link href="/explanation" className="hover:text-link">
          تشریح سیستم
        </Link>
        <span>/</span>
        <Link
          href={`/explanation/projects/${process.project}`}
          className="hover:text-link"
        >
          پروژه
        </Link>
        <span>/</span>
        <span className="text-ink">{process.name}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">{process.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {process.department || "بدون واحد"}
            {process.process_owner_name &&
              ` · مالک فرایند: ${process.process_owner_name}`}
          </p>
        </div>
        <div className="flex gap-2">
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
                  err instanceof ApiError ? err.message : "دانلود PDF ناموفق بود.",
                );
              } finally {
                setPdfLoading(false);
              }
            }}
          >
            {pdfLoading ? "در حال ساخت PDF..." : "دانلود PDF"}
          </Button>
          {editable && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteError(null);
                  setPending({ kind: "process" });
                }}
                className="text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                حذف فرایند
              </Button>
              <Button
                onClick={() => {
                  setFormError(null);
                  setOpen(true);
                }}
              >
                + افزودن گام
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="bg-brand-50">
        <p className="text-xs text-brand-800">
          {editable
            ? "شکل‌ها را با کشیدن جابه‌جا کنید و با کلیک روی هر شکل، صفحه مستندسازی آن گام (تشریح، ریسک، کنترل) را باز کنید. برای رسم فلش بین دو گام، دکمه «اتصال گام‌ها» را بزنید و ابتدا گام مبدأ و سپس گام مقصد را انتخاب کنید."
            : "حالت مشاهده: روی هر شکل کلیک کنید تا تشریح، ریسک، کنترل و پیوست‌های آن گام را ببینید. امکان ویرایش یا بارگذاری فایل وجود ندارد."}
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
          <h2 className="mb-2 text-sm font-semibold text-ink">فهرست گام‌ها</h2>
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
                  {SHAPE_LABELS[step.shape_type]}
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
                    حذف
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal open={open} title="افزودن گام" onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            addStep();
          }}
        >
          <Field label="عنوان گام">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="مثال: گام ۱ - درخواست خرید"
              autoFocus
            />
          </Field>
          <Field label="شکل روی نمودار">
            <Select
              value={shape}
              onChange={(event) => setShape(event.target.value as ShapeType)}
            >
              {Object.entries(SHAPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              افزودن
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "process" ? "حذف فرایند" : "حذف گام"}
        description={
          pending?.kind === "process"
            ? `فرایند «${process.name}» به همراه همه گام‌ها، ریسک‌ها و کنترل‌های آن حذف می‌شود. ادامه می‌دهید؟`
            : `گام «${pending?.kind === "step" ? pending.step.title : ""}» و مستندات و اتصال‌های آن حذف می‌شود. ادامه می‌دهید؟`
        }
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
