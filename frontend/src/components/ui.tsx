"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

import { mediaUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
  };
  const variants = {
    // Amazon CTA: orange fill with dark ink text, brown-red on hover.
    primary: "bg-brand-500 text-ink hover:bg-brand-700 hover:text-white",
    secondary:
      "bg-white text-navy-800 border border-gray-300 hover:bg-surface hover:border-navy-700",
    ghost: "text-navy-800 hover:bg-surface",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        className ?? "size-5",
      )}
      aria-hidden
    />
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

const controlClasses =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export function Input({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlClasses, className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlClasses, className)} {...rest} />;
}

export function Select({
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(controlClasses, className)} {...rest} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "gray",
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "blue" | "amber" | "red";
}) {
  const tones = {
    gray: "bg-surface text-navy-800",
    green: "bg-green-100 text-green-800",
    blue: "bg-[#e7f3f5] text-link",
    amber: "bg-brand-100 text-brand-800",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "bg-red-50 text-red-700 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
    info: "bg-brand-50 text-brand-800 border-brand-200",
  };
  return (
    <div className={cx("rounded-lg border px-3 py-2 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-navy-900/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cx(
          "relative z-10 w-full overflow-visible rounded-xl bg-white p-5 shadow-xl",
          className ?? "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition hover:bg-surface hover:text-navy-800"
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Destructive-action confirmation, used for deleting projects/processes/steps. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="space-y-4">
        {description && <p className="text-sm text-gray-600">{description}</p>}
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("common.delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Profile picture with an initial-letter fallback. */
export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const resolved = mediaUrl(src);
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
          "shrink-0 rounded-full border border-gray-200 bg-white object-cover",
          className,
        )}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-500 font-semibold text-ink",
        className,
      )}
    >
      {initial}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20 text-navy-700">
      <Spinner className="size-7" />
    </div>
  );
}
