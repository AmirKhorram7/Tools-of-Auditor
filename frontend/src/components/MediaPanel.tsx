"use client";

import { useState } from "react";

import { Alert, Button, Input, Select, cx } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { MediaKind, MediaSection, StepMedia } from "@/lib/types";

const KIND_LABELS: Record<MediaKind, string> = {
  image: "تصویر",
  file: "فایل",
  link: "لینک",
};

type Props = {
  stepId: number;
  section: MediaSection;
  riskId?: number;
  controlId?: number;
  items: StepMedia[];
  onChanged: () => void;
  /** Viewers can open links/files but not upload or delete. */
  readOnly?: boolean;
};

export default function MediaPanel({
  stepId,
  section,
  riskId,
  controlId,
  items,
  onChanged,
  readOnly = false,
}: Props) {
  const [kind, setKind] = useState<MediaKind>("image");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reset = () => {
    setTitle("");
    setUrl("");
    setFile(null);
    setError(null);
  };

  const submit = async () => {
    setError(null);

    if (kind === "link" && !url.trim()) {
      setError("برای نوع لینک، آدرس الزامی است.");
      return;
    }
    if (kind !== "link" && !file && !url.trim()) {
      setError("یک فایل انتخاب کنید یا آدرس وارد کنید.");
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
      setError(err instanceof ApiError ? err.message : "افزودن پیوست ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm("این پیوست حذف شود؟")) return;
    try {
      await apiFetch(`/media/${id}/`, { method: "DELETE" });
      onChanged();
    } catch {
      setError("حذف پیوست ناموفق بود.");
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">
          پیوست‌ها (لینک، تصویر، فایل)
        </p>
        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOpen((value) => !value);
              setError(null);
            }}
          >
            {open ? "بستن" : "+ افزودن"}
          </Button>
        )}
      </div>

      {items.length > 0 && (
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
                  {KIND_LABELS[item.kind]}
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
                    title="حذف"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {items.length === 0 && !open && (
        <p className="text-xs text-gray-500">پیوستی ثبت نشده است.</p>
      )}

      {!readOnly && open && (
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
              <option value="image">تصویر</option>
              <option value="file">فایل</option>
              <option value="link">لینک</option>
            </Select>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="عنوان (اختیاری)"
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
              انصراف
            </Button>
            <Button size="sm" loading={busy} onClick={submit}>
              افزودن
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
