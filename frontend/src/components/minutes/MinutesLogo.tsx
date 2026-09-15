"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cx } from "@/components/ui";
import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { defaultMinutesPicture } from "@/lib/minutes";

export function MinutesLogo({
  src,
  name,
  size = 40,
  className,
  kind,
  id,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  kind?: "group" | "company";
  id?: number;
}) {
  const uploaded = mediaUrl(src);
  const fallback =
    !uploaded && kind && id != null ? defaultMinutesPicture(kind, id) : null;
  const resolved = uploaded ?? fallback;
  const initial = name.trim().slice(0, 1) || "؟";

  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cx(
          "shrink-0 rounded-2xl border border-gray-200 bg-white",
          uploaded ? "object-cover" : "object-contain p-1.5",
          className,
        )}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.38) }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-xl bg-navy-900 font-bold text-brand-500",
        className,
      )}
    >
      {initial}
    </span>
  );
}

export function MinutesLogoPicker({
  src,
  name,
  onFile,
  kind,
  id,
}: {
  src?: string | null;
  name: string;
  onFile: (file: File) => void;
  kind?: "group" | "company";
  id?: number;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="flex items-center gap-3">
      <MinutesLogo src={preview ?? src} name={name || "?"} size={72} kind={kind} id={id} />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (!next) return;
            setFile(next);
            onFile(next);
          }}
        />
        <button
          type="button"
          className="text-sm font-medium text-navy-800 hover:text-link"
          onClick={() => inputRef.current?.click()}
        >
          {t("minutes.changeLogo")}
        </button>
      </div>
    </div>
  );
}
