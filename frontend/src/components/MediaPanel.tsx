"use client";

import { useEffect, useState } from "react";

import { Alert, Button, Input, Select, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { MediaKind, MediaSection, StepMedia } from "@/lib/types";

type Props = {
  stepId: number;
  section: MediaSection;
  riskId?: number;
  controlId?: number;
  items: StepMedia[];
  onChanged: () => void;
  /** Viewers can open links/files but not upload or delete. */
  readOnly?: boolean;
  /** When the body is shown/hidden. Used to grow the editor on the step page. */
  onExpandedChange?: (expanded: boolean) => void;
};

export default function MediaPanel({
  stepId,
  section,
  riskId,
  controlId,
  items,
  onChanged,
  readOnly = false,
  onExpandedChange,
}: Props) {
  const { t } = useI18n();
  const [kind, setKind] = useState<MediaKind>("image");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(
    onExpandedChange ? items.length > 0 : true,
  );

  useEffect(() => {
    onExpandedChange?.(expanded);
    // Notify once so the editor can start tall when this box is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setTitle("");
    setUrl("");
    setFile(null);
    setError(null);
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    onExpandedChange?.(next);
    if (!next) {
      setOpen(false);
      setError(null);
    }
  };

  const submit = async () => {
    setError(null);

    if (kind === "link" && !url.trim()) {
      setError(t("media.linkRequired"));
      return;
    }
    if (kind !== "link" && !file && !url.trim()) {
      setError(t("media.fileOrUrl"));
      return;
    }

    setBusy(true);
    try {
      if (file) {
        const payload = new FormData();
        payload.append("step", String(stepId));
        payload.append("section", section);
        payload.append("kind", kind);
        payload.append("title", title);
        if (url.trim()) payload.append("url", url.trim());
        if (riskId) payload.append("risk", String(riskId));
        if (controlId) payload.append("control", String(controlId));
        payload.append("file", file);
        await apiFetch("/media/", { method: "POST", formData: payload });
      } else {
        await apiFetch("/media/", {
          method: "POST",
          body: {
            step: stepId,
            section,
            kind,
            title,
            url: url.trim(),
            risk: riskId ?? null,
            control: controlId ?? null,
          },
        });
      }
      reset();
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("media.addFail"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(t("media.deleteConfirm"))) return;
    try {
      await apiFetch(`/media/${id}/`, { method: "DELETE" });
      onChanged();
    } catch {
      setError(t("media.deleteFail"));
    }
  };

  return (
    <div
      className={cx(
        "rounded-lg border border-gray-200 bg-gray-50/60",
        expanded ? "p-3" : "px-3 py-1.5",
      )}
    >
      <div className={cx("flex items-center justify-between", expanded && "mb-2")}>
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex min-w-0 items-center gap-2 text-start"
          title={expanded ? t("media.collapse") : t("media.expand")}
          aria-expanded={expanded}
        >
          <span
            className={cx(
              "flex size-6 shrink-0 items-center justify-center rounded text-gray-500 transition hover:bg-white hover:text-navy-800",
              !expanded && "rotate-180",
            )}
            aria-hidden
          >
            <ChevronUpIcon />
          </span>
          <p className="text-xs font-semibold text-gray-700">
            {t("media.attachments")}
            {items.length > 0 ? ` (${items.length})` : ""}
          </p>
        </button>
        {expanded && !readOnly && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen((value) => !value);
              setError(null);
            }}
          >
            {open ? t("common.close") : `+ ${t("common.add")}`}
          </Button>
        )}
      </div>

      {expanded && items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((item) => {
            const href = item.file_url || item.url;
            return (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs"
              >
                <span
                  className={cx(
                    "rounded px-1.5 py-0.5 font-medium",
                    item.kind === "link" && "bg-[#e7f3f5] text-link",
                    item.kind === "image" && "bg-green-100 text-green-700",
                    item.kind === "file" && "bg-amber-100 text-amber-700",
                  )}
                >
                  {t(`media.${item.kind}`)}
                </span>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-link hover:text-link-hover hover:underline"
                  >
                    {item.title || href}
                  </a>
                ) : (
                  <span className="truncate text-gray-700">{item.title}</span>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="ms-auto text-red-500 transition hover:text-red-700"
                    title={t("common.delete")}
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {expanded && items.length === 0 && !open && (
        <p className="text-xs text-gray-500">{t("media.empty")}</p>
      )}

      {expanded && !readOnly && open && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-white p-2.5">
          <div className="grid gap-2 sm:grid-cols-3">
            <Select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as MediaKind);
                setFile(null);
              }}
              className="py-2 text-xs"
            >
              <option value="image">{t("media.image")}</option>
              <option value="file">{t("media.file")}</option>
              <option value="link">{t("media.link")}</option>
            </Select>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("media.titleOptional")}
              className="py-2 text-xs sm:col-span-2"
            />
          </div>

          {kind === "link" ? (
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              dir="ltr"
              className="py-2 text-xs"
            />
          ) : (
            <input
              type="file"
              accept={kind === "image" ? "image/*" : undefined}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full text-xs text-gray-600"
            />
          )}

          {error && <Alert>{error}</Alert>}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" loading={busy} onClick={submit}>
              {t("common.add")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
      <path
        d="M5 12.5 10 7.5 15 12.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
