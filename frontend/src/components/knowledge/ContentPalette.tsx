"use client";

import { useState } from "react";

import { KM_TOKENS, type KmTokenId } from "@/lib/knowledge-colors";
import { useI18n } from "@/lib/i18n";

export default function ContentPalette({
  onText,
  onHighlight,
  onClear,
}: {
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
          <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: "var(--km-accent)" }} />
        </span>
      </button>
      {open ? (
        <div
          className="absolute start-0 top-10 z-30 w-[19rem] rounded-xl border p-3 shadow-lg"
          style={{ background: "var(--km-elevated)", borderColor: "var(--km-border)" }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <div className="mb-2 flex gap-1">
            <Tab label={t("km.colorText")} active={tab === "text"} onClick={() => setTab("text")} />
            <Tab label={t("km.colorHighlight")} active={tab === "highlight"} onClick={() => setTab("highlight")} />
          </div>
          <div className="flex gap-1">
            <Swatch label={t("km.textColorDefault")} token={null} onPick={() => { pick(null); setOpen(false); }} />
            {KM_TOKENS.map((token) => (
              <Swatch
                key={token.id}
                label={t(`km.token.${token.id}`)}
                token={token.id}
                onPick={() => { pick(token.id); setOpen(false); }}
              />
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-xs font-semibold"
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

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-2 py-1 text-xs font-semibold"
      style={{
        background: active ? "var(--km-accent)" : "transparent",
        color: active ? "var(--km-accent-ink)" : "var(--km-muted)",
      }}
    >
      {label}
    </button>
  );
}

function Swatch({ label, token, onPick }: { label: string; token: KmTokenId | null; onPick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onPick}
      className="size-6 shrink-0 rounded-full"
      style={{
        background: token ? `var(--k-${token})` : "var(--km-text)",
        boxShadow: token ? undefined : "inset 0 0 0 1px var(--km-border)",
      }}
    />
  );
}
