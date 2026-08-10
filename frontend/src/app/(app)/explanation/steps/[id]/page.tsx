"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
import type { ProcessStepDetail, StepItem } from "@/lib/types";

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
      await apiFetch(`/steps/${stepId}/`, {
        method: "PATCH",
        body: { explanation },
      });
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
      await apiFetch(path, {
        method: "POST",
        body: {
          step: stepId,
          title: itemTitle.trim(),
          content: "",
          order: count + 1,
        },
      });
      setItemModal(null);
      setItemTitle("");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "ثبت ناموفق بود.");
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !step) return <Alert>{error}</Alert>;
  if (!step) return <Alert>گام پیدا نشد.</Alert>;

  return (
    <div className="space-y-5">
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

      <div>
        <h1 className="text-lg font-bold text-ink">{step.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          این گام را در سه بخش تشریح، ریسک و کنترل مستند کنید.
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
          />

          <MediaPanel
            stepId={step.id}
            section="explanation"
            items={step.explanation_media}
            onChanged={load}
          />

          {savedNote && <Alert tone="success">{savedNote}</Alert>}

          <div className="flex justify-end">
            <Button loading={savingExplanation} onClick={saveExplanation}>
              ذخیره تشریح
            </Button>
          </div>
        </Card>
      )}

      {tab === "risk" && (
        <ItemSection
          kind="risk"
          items={step.risks}
          stepId={step.id}
          onAdd={() => {
            setFormError(null);
            setItemModal("risk");
          }}
          onChanged={load}
        />
      )}

      {tab === "control" && (
        <ItemSection
          kind="control"
          items={step.controls}
          stepId={step.id}
          onAdd={() => {
            setFormError(null);
            setItemModal("control");
          }}
          onChanged={load}
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
  onAdd,
  onChanged,
}: {
  kind: "risk" | "control";
  items: StepItem[];
  stepId: number;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const labels =
    kind === "risk"
      ? { title: "ریسک‌ها", add: "+ افزودن ریسک", empty: "ریسکی ثبت نشده است" }
      : { title: "کنترل‌ها", add: "+ افزودن کنترل", empty: "کنترلی ثبت نشده است" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">{labels.title}</h2>
        <Button size="sm" onClick={onAdd}>
          {labels.add}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={labels.empty}
          description="برای این گام موارد شناسایی‌شده را ثبت کنید."
          action={<Button size="sm" onClick={onAdd}>{labels.add}</Button>}
        />
      ) : (
        items.map((item) => (
          <ItemEditor
            key={item.id}
            kind={kind}
            item={item}
            stepId={stepId}
            onChanged={onChanged}
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
  onChanged,
}: {
  kind: "risk" | "control";
  item: StepItem;
  stepId: number;
  onChanged: () => void;
}) {
  const [content, setContent] = useState(item.content ?? "");
  const [title, setTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basePath = kind === "risk" ? "/risks" : "/controls";

  const save = async () => {
    setSaving(true);
    setNote(null);
    setError(null);
    try {
      await apiFetch(`${basePath}/${item.id}/`, {
        method: "PATCH",
        body: { title, content },
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
      onChanged();
    } catch {
      setError("حذف ناموفق بود.");
    }
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="font-medium"
        />
        <Button variant="ghost" size="sm" onClick={remove} className="text-red-600">
          حذف
        </Button>
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
      />

      <MediaPanel
        stepId={stepId}
        section={kind}
        riskId={kind === "risk" ? item.id : undefined}
        controlId={kind === "control" ? item.id : undefined}
        items={item.media_items}
        onChanged={onChanged}
      />

      {note && <Alert tone="success">{note}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="flex justify-end">
        <Button size="sm" loading={saving} onClick={save}>
          ذخیره
        </Button>
      </div>
    </Card>
  );
}
