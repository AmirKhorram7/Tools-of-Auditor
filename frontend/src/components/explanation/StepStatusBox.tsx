"use client";

import { useEffect, useRef, useState } from "react";

import { Button, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  STEP_STATUS_DOT,
  STEP_STATUS_OPTIONS,
  type ProcessStep,
  type StepStatus,
} from "@/lib/types";

function normalizeStatus(value?: string | null): StepStatus {
  if (value === "written" || value === "completed") return value;
  return "default";
}

type Props = {
  stepId: number;
  status?: string | null;
  editable: boolean;
  onChanged: (status: StepStatus) => void;
  onError: (message: string) => void;
};

/** Mini picker next to Guide: default / written / completed. */
export default function StepStatusBox({
  stepId,
  status,
  editable,
  onChanged,
  onError,
}: Props) {
  const { t } = useI18n();
  const current = normalizeStatus(status);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const setStatus = async (next: StepStatus) => {
    if (!editable || next === current || busy) {
      if (!editable) setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const updated = await apiFetch<ProcessStep>(`/steps/${stepId}/`, {
        method: "PATCH",
        body: { status: next },
      });
      onChanged(normalizeStatus(updated.status ?? next));
      setOpen(false);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t("exp.stepStatusFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t("exp.stepStatus")}
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: STEP_STATUS_DOT[current] }}
          aria-hidden
        />
        {t(`exp.stepStatus.${current}`)}
      </Button>
      {open && (
        <div
          role="listbox"
          className="absolute end-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {STEP_STATUS_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={value === current}
              disabled={busy || !editable}
              onClick={() => setStatus(value)}
              className={cx(
                "flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
                value === current
                  ? "bg-surface font-medium text-ink"
                  : "text-navy-800 hover:bg-surface",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STEP_STATUS_DOT[value] }}
                aria-hidden
              />
              {t(`exp.stepStatus.${value}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
