"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BackButton from "@/components/BackButton";
import ExplanationGuide from "@/components/explanation/ExplanationGuide";
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
import { ApiError, apiDownload, apiFetch, apiList } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  canEditProject,
  type ProcessStep,
  type ProcessStepDetail,
  type StepItem,
} from "@/lib/types";
import type { EditorMention } from "@/components/RichTextEditor";

type Tab = "explanation" | "risk" | "control";

export default function StepDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useI18n();
  const stepId = Number(params.id);

  const [step, setStep] = useState<ProcessStepDetail | null>(null);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("explanation");
  const [pdfLoading, setPdfLoading] = useState(false);

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
      try {
        const rows = await apiList<ProcessStep>(`/steps/?process=${data.process}`);
        setProcessSteps(rows);
      } catch {
        setProcessSteps([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.loadStepFail"));
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
      setSavedNote(t("exp.explanationSaved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.saveExplanationFail"));
    } finally {
      setSavingExplanation(false);
    }
  };

  const createItem = async () => {
    if (!itemModal || !itemTitle.trim()) {
      setFormError(t("exp.titleRequired"));
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
      setFormError(err instanceof ApiError ? err.message : t("exp.createItemFail"));
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error && !step) return <Alert>{error}</Alert>;
  if (!step) return <Alert>{t("exp.stepNotFound")}</Alert>;

  // Missing my_role (older API) keeps the editor open; API still enforces writes.
  const editable = step.my_role == null || canEditProject(step.my_role);
  const stepMentions: EditorMention[] = processSteps
    .filter((item) => item.id !== step.id)
    .sort((a, b) => a.order - b.order || a.id - b.id)
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: `/explanation/steps/${item.id}`,
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton fallbackHref={`/explanation/processes/${step.process}`} />
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          <Link href="/explanation" className="hover:text-link">
            {t("exp.title")}
          </Link>
          {step.project && (
            <>
              <span>/</span>
              <Link
                href={`/explanation/projects/${step.project}`}
                className="hover:text-link"
              >
                {step.project_name || t("common.folder")}
              </Link>
            </>
          )}
          <span>/</span>
          <Link
            href={`/explanation/processes/${step.process}`}
            className="hover:text-link"
          >
            {step.process_name || t("common.process")}
          </Link>
          <span>/</span>
          <span className="font-medium text-ink">{step.title}</span>
        </nav>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">{step.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {editable ? t("exp.stepHintEdit") : t("exp.stepHintView")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              setError(null);
              try {
                await apiDownload(`/steps/${stepId}/export-pdf/`, `step-${stepId}.pdf`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : t("exp.pdfFail"));
              } finally {
                setPdfLoading(false);
              }
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-navy-800 shadow-sm transition hover:bg-surface disabled:opacity-60"
            aria-label={pdfLoading ? t("exp.buildingPdf") : t("exp.downloadPdf")}
            title={pdfLoading ? t("exp.buildingPdf") : t("exp.downloadPdf")}
          >
            <PdfDownloadIcon />
          </button>
          <ExplanationGuide compact />
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
        {(
          [
            { key: "explanation" as const, label: t("exp.tabExplanation") },
            { key: "risk" as const, label: t("exp.tabRisks") },
            { key: "control" as const, label: t("exp.tabControls") },
          ]
        ).map((item) => (
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
            placeholder={t("exp.explanationPlaceholder")}
            minHeight={240}
            readOnly={!editable}
            mentions={stepMentions}
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
                {t("exp.saveExplanation")}
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
          mentions={stepMentions}
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
          mentions={stepMentions}
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
        title={itemModal === "risk" ? t("exp.newRisk") : t("exp.newControl")}
        onClose={() => setItemModal(null)}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            createItem();
          }}
        >
          <Field label={t("exp.itemTitle")}>
            <Input
              value={itemTitle}
              onChange={(event) => setItemTitle(event.target.value)}
              placeholder={
                itemModal === "risk"
                  ? t("exp.riskTitlePlaceholder")
                  : t("exp.controlTitlePlaceholder")
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
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={savingItem}>
              {t("common.add")}
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
  mentions,
}: {
  kind: "risk" | "control";
  items: StepItem[];
  stepId: number;
  mentions?: EditorMention[];
  editable: boolean;
  onAdd: () => void;
  onChanged: () => void;
  onItemUpdated: (item: StepItem) => void;
  onItemRemoved: (id: number) => void;
}) {
  const { t } = useI18n();
  const labels =
    kind === "risk"
      ? { title: t("exp.tabRisks"), add: t("exp.addRisk"), empty: t("exp.noRisks") }
      : { title: t("exp.tabControls"), add: t("exp.addControl"), empty: t("exp.noControls") };

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
              ? t("exp.itemsHintEdit")
              : t("exp.itemsHintView")
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
            mentions={mentions}
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
  mentions,
  onChanged,
  onUpdated,
  onRemoved,
}: {
  kind: "risk" | "control";
  mentions?: EditorMention[];
  item: StepItem;
  stepId: number;
  editable: boolean;
  onChanged: () => void;
  onUpdated: (item: StepItem) => void;
  onRemoved: (id: number) => void;
}) {
  const { t } = useI18n();
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
      setNote(t("exp.saved"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("exp.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("exp.confirmDeleteItem"))) return;
    try {
      await apiFetch(`${basePath}/${item.id}/`, { method: "DELETE" });
      onRemoved(item.id);
    } catch {
      setError(t("exp.deleteFail"));
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
            {t("common.delete")}
          </Button>
        )}
      </div>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder={
          kind === "risk"
            ? t("exp.riskContentPlaceholder")
            : t("exp.controlContentPlaceholder")
        }
        minHeight={150}
        readOnly={!editable}
        mentions={mentions}
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
            {t("common.save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function PdfDownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path
        d="M7 3.5h7l4 4V20.5H7V3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.5V8h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M12 11.5v6M9.5 15 12 17.5 14.5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
