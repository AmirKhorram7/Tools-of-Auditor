"use client";

import { useState } from "react";

import { KM_TOKENS, type KmTokenId } from "@/lib/knowledge-colors";
import { useI18n } from "@/lib/i18n";

export default function ContentPalette({
  active,
  onText,
  onHighlight,
  onClear,
}: {
  active: KmTokenId | null;
  onText: (token: KmTokenId | null) => void;
  onHighlight: (token: KmTokenId | null) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"text" | "highlight">("text");
  const pick = tab === "text" ? onText : onHighlight;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={t("km.textColor")}
        aria-label={t("km.textColor")}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((value) => !value)}
        className="flex size-9 items-center justify-center rounded-lg"
        style={{
          background: open ? "var(--km-accent)" : "var(--km-selection)",
          color: open ? "var(--km-accent-ink)" : "var(--km-text)",
        }}
      >
        <span className="flex flex-col items-center leading-none">
          <span className="text-[13px] font-bold">A</span>
          <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: active ? `var(--k-${active})` : "var(--km-accent)" }} />
        </span>
      </button>
      {open ? (
        <div
          className="absolute start-0 top-10 z-30 rounded-xl border p-2.5 shadow-lg"
          style={{ background: "var(--km-elevated)", borderColor: "var(--km-border)" }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="mb-2 flex gap-1">
            <Mode label={t("km.colorText")} mark="A" active={tab === "text"} onClick={() => setTab("text")} />
            <Mode label={t("km.colorHighlight")} mark="▬" active={tab === "highlight"} onClick={() => setTab("highlight")} />
          </div>
          <div className="flex items-center gap-1.5">
            <Swatch label={t("km.textColorDefault")} token={null} active={tab === "text" && active === null} onPick={() => { pick(null); setOpen(false); }} />
            {KM_TOKENS.map((token) => (
              <Swatch
                key={token.id}
                label={token.id}
                token={token.id}
                active={tab === "text" && active === token.id}
                onPick={() => { pick(token.id); setOpen(false); }}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label={t("km.clearFormat")}
            title={t("km.clearFormat")}
            className="mt-2 text-[11px] font-semibold"
            style={{ color: "var(--km-muted)" }}
            onClick={() => { onClear(); setOpen(false); }}
          >
            {t("km.clearFormat")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Mode({ label, mark, active, onClick }: { label: string; mark: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-bold"
      style={{
        background: active ? "var(--km-accent)" : "transparent",
        color: active ? "var(--km-accent-ink)" : "var(--km-muted)",
      }}
    >
      {mark}
    </button>
  );
}

function Swatch({
  label,
  token,
  active,
  onPick,
}: {
  label: string;
  token: KmTokenId | null;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onPick}
      className="size-6 rounded-full"
      style={{
        background: token
          ? `var(--k-${token})`
          : "linear-gradient(135deg, transparent 42%, var(--km-danger) 42%, var(--km-danger) 58%, transparent 58%), var(--km-panel)",
        boxShadow: active
          ? "0 0 0 2px var(--km-elevated), 0 0 0 4px var(--km-accent)"
          : "inset 0 0 0 1px color-mix(in srgb, var(--km-text) 25%, transparent)",
      }}
    />
  );
}
