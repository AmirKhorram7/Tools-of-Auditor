"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import MediaPanel from "@/components/MediaPanel";
import RichTextEditor from "@/components/RichTextEditor";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageLoader,
  cx,
} from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import {
  canEditProject,
  type ProcessStepDetail,
  type StepItem,
} from "@/lib/types";

type Tab = "explanation" | "risk" | "control";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "explanation", label: "تشریح سیستم" },
  { key: "risk", label: "ریسک‌ها" },
  { key: "control", label: "کنترل‌ها" },
];

export default function StepDetailPage() {
  const params = useParams<{ id: string }>();
  const stepId = Number(params.id);

  const [step, setStep] = useState<ProcessStepDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("explanation");

  const [explanation, setExplanation] = useState("");
  const [savingExplanation, setSavingExplanation] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const [itemModal, setItemModal] = useState<Tab | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(stepId)) return;
    setError(null);
    try {
      const data = await apiFetch<ProcessStepDetail>(`/steps/${stepId}/`);
      setStep(data);
      setExplanation(data.explanation ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "دریافت گام ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [stepId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveExplanation = async () => {
    setSavingExplanation(true);
    setSavedNote(null);
    try {
      const updated = await apiFetch<ProcessStepDetail>(`/steps/${stepId}/`, {
        method: "PATCH",
        body: { explanation },
      });
      setStep((current) =>
        current
          ? { ...current, explanation: updated.explanation ?? explanation }
          : current,
      );
      setSavedNote("تشریح ذخیره شد.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ذخیره تشریح ناموفق بود.");
    } finally {
      setSavingExplanation(false);
    }
  };

  const createItem = async () => {
    if (!itemModal || !itemTitle.trim()) {
      setFormError("عنوان الزامی است.");
      return;
    }
    setSavingItem(true);
    setFormError(null);
    try {
      const path = itemModal === "risk" ? "/risks/" : "/controls/";
      const count =
        itemModal === "risk"
          ? (step?.risks.length ?? 0)
          : (step?.controls.length ?? 0);
      const created = await apiFetch<StepItem>(path, {
        method: "POST",
        body: {
          step: stepId,
          title: itemTitle.trim(),
          content: "",
          order: count + 1,
        },
      });
      setStep((current) => {
        if (!current) return current;
        if (itemModal === "risk") {
          return { ...current, risks: [...current.risks, created] };
        }
        return { ...current, controls: [...current.controls, created] };
      });
      setItemModal(null);
      setItemTitle("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ثبت ناموفق بود.");
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !step) return <Alert>{error}</Alert>;
  if (!step) return <Alert>گام پیدا نشد.</Alert>;

  // Missing my_role (older API) keeps the editor open; API still enforces writes.
  const editable = step.my_role == null || canEditProject(step.my_role);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton fallbackHref={`/explanation/processes/${step.process}`} />
        <nav className="flex items-center gap-1.5 text-xs text-gray-500">
          <Link href="/explanation" className="hover:text-link">
            تشریح سیستم
          </Link>
          <span>/</span>
          <Link
            href={`/explanation/processes/${step.process}`}
            className="hover:text-link"
          >
            فرایند
          </Link>
          <span>/</span>
          <span className="text-ink">{step.title}</span>
        </nav>
      </div>

      <div>
        <h1 className="text-lg font-bold text-ink">{step.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {editable
            ? "این گام را در سه بخش تشریح، ریسک و کنترل مستند کنید."
            : "حالت مشاهده: می‌توانید محتوا و پیوست‌ها را ببینید، اما ویرایش غیرفعال است."}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cx(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === item.key
                ? "bg-brand-500 text-ink"
                : "text-navy-800 hover:bg-surface",
            )}
          >
            {item.label}
            {item.key === "risk" && ` (${step.risks.length})`}
            {item.key === "control" && ` (${step.controls.length})`}
          </button>
        ))}
      </div>

      {tab === "explanation" && (
        <Card className="space-y-3">
          <RichTextEditor
            value={explanation}
            onChange={setExplanation}
            placeholder="شرح کامل این گام از فرایند را بنویسید..."
            minHeight={240}
            readOnly={!editable}
          />

          <MediaPanel
            stepId={step.id}
            section="explanation"
            items={step.explanation_media}
            onChanged={load}
            readOnly={!editable}
          />

          {savedNote && <Alert tone="success">{savedNote}</Alert>}

          {editable && (
            <div className="flex justify-end">
              <Button loading={savingExplanation} onClick={saveExplanation}>
                ذخیره تشریح
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === "risk" && (
        <ItemSection
          kind="risk"
          items={step.risks}
          stepId={step.id}
          editable={editable}
          onAdd={() => {
            setFormError(null);
            setItemModal("risk");
          }}
          onChanged={load}
          onItemUpdated={(updated) =>
            setStep((current) =>
              current
                ? {
                    ...current,
                    risks: current.risks.map((item) =>
                      item.id === updated.id ? { ...item, ...updated } : item,
                    ),
                  }
                : current,
            )
          }
          onItemRemoved={(id) =>
            setStep((current) =>
              current
                ? { ...current, risks: current.risks.filter((item) => item.id !== id) }
                : current,
            )
          }
        />
      )}

      {tab === "control" && (
        <ItemSection
          kind="control"
          items={step.controls}
          stepId={step.id}
          editable={editable}
          onAdd={() => {
            setFormError(null);
            setItemModal("control");
          }}
          onChanged={load}
          onItemUpdated={(updated) =>
            setStep((current) =>
              current
                ? {
                    ...current,
                    controls: current.controls.map((item) =>
                      item.id === updated.id ? { ...item, ...updated } : item,
                    ),
                  }
                : current,
            )
          }
          onItemRemoved={(id) =>
            setStep((current) =>
              current
                ? {
                    ...current,
                    controls: current.controls.filter((item) => item.id !== id),
                  }
                : current,
            )
          }
        />
      )}

      <Modal
        open={itemModal !== null}
        title={itemModal === "risk" ? "ریسک جدید" : "کنترل جدید"}
        onClose={() => setItemModal(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createItem();
          }}
        >
          <Field label="عنوان">
            <Input
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder={
                itemModal === "risk"
                  ? "مثال: خرید بدون تاییدیه مدیر"
                  : "مثال: تایید دو مرحله‌ای درخواست خرید"
              }
              autoFocus
            />
          </Field>
          {formError && <Alert>{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setItemModal(null)}
            >
              انصراف
            </Button>
            <Button type="submit" loading={savingItem}>
              افزودن
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ItemSection({
  kind,
  items,
  stepId,
  editable,
  onAdd,
  onChanged,
  onItemUpdated,
  onItemRemoved,
}: {
  kind: "risk" | "control";
  items: StepItem[];
  stepId: number;
  editable: boolean;
  onAdd: () => void;
  onChanged: () => void;
  onItemUpdated: (item: StepItem) => void;
  onItemRemoved: (id: number) => void;
}) {
  const labels =
    kind === "risk"
      ? { title: "ریسک‌ها", add: "+ افزودن ریسک", empty: "ریسکی ثبت نشده است" }
      : { title: "کنترل‌ها", add: "+ افزودن کنترل", empty: "کنترلی ثبت نشده است" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">{labels.title}</h2>
        {editable && (
          <Button size="sm" onClick={onAdd}>
            {labels.add}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={labels.empty}
          description={
            editable
              ? "برای این گام موارد شناسایی‌شده را ثبت کنید."
              : "برای این گام موردی ثبت نشده است."
          }
          action={
            editable ? (
              <Button size="sm" onClick={onAdd}>
                {labels.add}
              </Button>
            ) : undefined
          }
        />
      ) : (
        items.map((item) => (
          <ItemEditor
            key={item.id}
            kind={kind}
            item={item}
            stepId={stepId}
            editable={editable}
            onChanged={onChanged}
            onUpdated={onItemUpdated}
            onRemoved={onItemRemoved}
          />
        ))
      )}
    </div>
  );
}

function ItemEditor({
  kind,
  item,
  stepId,
  editable,
  onChanged,
  onUpdated,
  onRemoved,
}: {
  kind: "risk" | "control";
  item: StepItem;
  stepId: number;
  editable: boolean;
  onChanged: () => void;
  onUpdated: (item: StepItem) => void;
  onRemoved: (id: number) => void;
}) {
  const [content, setContent] = useState(item.content ?? "");
  const [title, setTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basePath = kind === "risk" ? "/risks" : "/controls";

  // Keep local fields in sync when parent reloads (e.g. after media upload).
  useEffect(() => {
    setContent(item.content ?? "");
    setTitle(item.title);
  }, [item.id, item.content, item.title]);

  const save = async () => {
    setSaving(true);
    setNote(null);
    setError(null);
    try {
      const updated = await apiFetch<StepItem>(`${basePath}/${item.id}/`, {
        method: "PATCH",
        body: { title, content },
      });
      onUpdated({
        ...item,
        ...updated,
        title,
        content,
        media_items: updated.media_items ?? item.media_items,
      });
      setNote("ذخیره شد.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("این مورد حذف شود؟")) return;
    try {
      await apiFetch(`${basePath}/${item.id}/`, { method: "DELETE" });
      onRemoved(item.id);
    } catch {
      setError("حذف ناموفق بود.");
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        {editable ? (
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="font-medium"
          />
        ) : (
          <h3 className="flex-1 text-sm font-semibold text-ink">{item.title}</h3>
        )}
        {editable && (
          <Button variant="ghost" size="sm" onClick={remove} className="text-red-600">
            حذف
          </Button>
        )}
      </div>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder={
          kind === "risk"
            ? "توضیح ریسک، اثر و احتمال وقوع..."
            : "توضیح کنترل، نوع و دوره اجرا..."
        }
        minHeight={150}
        readOnly={!editable}
      />

      <MediaPanel
        stepId={stepId}
        section={kind}
        riskId={kind === "risk" ? item.id : undefined}
        controlId={kind === "control" ? item.id : undefined}
        items={item.media_items}
        onChanged={onChanged}
        readOnly={!editable}
      />

      {note && <Alert tone="success">{note}</Alert>}
      {error && <Alert>{error}</Alert>}

      {editable && (
        <div className="flex justify-end">
          <Button size="sm" loading={saving} onClick={save}>
            ذخیره
          </Button>
        </div>
      )}
    </Card>
  );
}
