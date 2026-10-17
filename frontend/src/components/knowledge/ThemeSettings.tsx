"use client";

import { type CSSProperties } from "react";

import { cx } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { editorTypeStyle, type EditorType } from "@/lib/knowledge-colors";
import { KNOWLEDGE_THEMES, type KnowledgeTheme, type KnowledgeThemeId } from "@/lib/knowledge-theme";

export default function ThemeSettings({
  active,
  typing,
  onType,
  onPick,
}: {
  active: KnowledgeThemeId;
  typing: EditorType;
  onType: (value: EditorType) => void;
  onPick: (id: KnowledgeThemeId) => void;
}) {
  const { t } = useI18n();
  const dark = KNOWLEDGE_THEMES.filter((item) => item.mode === "dark");
  const light = KNOWLEDGE_THEMES.filter((item) => item.mode === "light");

  return (
    <div className="w-full max-w-3xl px-3 py-6 pb-16">
      <h1 className="text-2xl font-bold">{t("km.settings")}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6" style={{ color: "var(--km-muted)" }}>
        {t("km.themeLead")}
      </p>
      <p className="mt-6 text-sm font-bold">{t("km.type")}</p>
      <p
        className="mt-2 max-w-xl rounded-xl border px-3 py-3 text-base"
        style={{ borderColor: "var(--km-border)", ...(editorTypeStyle(typing) as CSSProperties) }}
      >
        <span style={{ fontFamily: "var(--km-editor-font)", fontSize: "var(--km-editor-size)", lineHeight: "var(--km-editor-leading)" }}>
          {t("km.typeSample")}
        </span>
      </p>
      <Choice
        label={t("km.font")}
        value={typing.font}
        options={[["vazir", "km.font.vazir"], ["inter", "km.font.inter"], ["system", "km.font.system"]]}
        onPick={(font) => onType({ ...typing, font })}
      />
      <Choice
        label={t("km.size")}
        value={typing.size}
        options={[["sm", "km.size.sm"], ["md", "km.size.md"], ["lg", "km.size.lg"]]}
        onPick={(size) => onType({ ...typing, size })}
      />
      <Choice
        label={t("km.leading")}
        value={typing.leading}
        options={[["compact", "km.leading.compact"], ["normal", "km.leading.normal"], ["relaxed", "km.leading.relaxed"]]}
        onPick={(leading) => onType({ ...typing, leading })}
      />
      <Group title={t("km.darkThemes")} themes={dark} active={active} onPick={onPick} />
      <Group title={t("km.lightThemes")} themes={light} active={active} onPick={onPick} />
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onPick: (value: T) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold" style={{ color: "var(--km-muted)" }}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {options.map(([id, key]) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="rounded-lg px-3 py-1.5 text-sm"
            style={{
              background: value === id ? "var(--km-accent)" : "var(--km-selection)",
              color: value === id ? "var(--km-accent-ink)" : "var(--km-text)",
            }}
          >
            {t(key)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Group({
  title,
  themes,
  active,
  onPick,
}: {
  title: string;
  themes: KnowledgeTheme[];
  active: KnowledgeThemeId;
  onPick: (id: KnowledgeThemeId) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--km-faint)" }}>
        {title}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {themes.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id)}
              aria-pressed={selected}
              className={cx(
                "overflow-hidden rounded-2xl border text-start transition",
                selected ? "ring-2" : "hover:brightness-110",
              )}
              style={{
                borderColor: selected ? "var(--km-accent)" : "var(--km-border)",
                boxShadow: selected ? "0 0 0 1px var(--km-accent)" : undefined,
              }}
            >
              <span className="flex h-16">
                <span className="w-10" style={{ background: item.vars["--km-sidebar"] }} />
                <span className="relative flex-1" style={{ background: item.vars["--km-panel"] }}>
                  <span
                    className="absolute start-3 top-4 h-1.5 w-16 rounded-full"
                    style={{ background: item.vars["--km-text"], opacity: 0.85 }}
                  />
                  <span
                    className="absolute start-3 top-8 h-1.5 w-10 rounded-full"
                    style={{ background: item.vars["--km-muted"], opacity: 0.7 }}
                  />
                </span>
                <span className="w-2" style={{ background: item.vars["--km-accent"] }} />
              </span>
              <span
                className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold"
                style={{ background: item.vars["--km-bg"], color: item.vars["--km-text"] }}
              >
                {t(item.nameKey)}
                {selected ? <span style={{ color: item.vars["--km-accent"] }}>●</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
