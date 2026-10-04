"use client";

import { useEffect, useRef, useState } from "react";

import ColorDots from "@/components/daybook/ColorDots";
import { cx } from "@/components/ui";
import { TEXT_COLORS } from "@/lib/daybook";
import { useI18n } from "@/lib/i18n";

const EMOJIS = [
  "✅", "📌", "💡", "🎯", "🔥", "⏰", "📅", "📝", "📊", "💼",
  "🤝", "📞", "✉️", "💰", "🧾", "🚀", "🏁", "⚠️", "❗", "❓",
  "👍", "👏", "🙏", "💪", "😊", "😂", "😍", "🤔", "😎", "😴",
  "🎉", "❤️", "⭐", "🌱", "☕", "🧠", "💬", "🗂️", "🔒", "🏃",
];

const FONTS = [
  { labelKey: "day.fontDefault", value: "inherit" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "B Nazanin", value: "B Nazanin" },
  { label: "Georgia", value: "Georgia" },
  { label: "Segoe UI", value: "Segoe UI" },
  { label: "Courier New", value: "Courier New" },
];

const SIZES = [
  { labelKey: "day.sizeS", value: "13px" },
  { labelKey: "day.sizeM", value: "15px" },
  { labelKey: "day.sizeL", value: "18px" },
  { labelKey: "day.sizeXL", value: "22px" },
  { labelKey: "day.sizeXXL", value: "28px" },
];

const MARKS = [
  { command: "bold", label: "B", className: "font-bold", titleKey: "editor.bold" },
  { command: "italic", label: "I", className: "italic", titleKey: "editor.italic" },
  { command: "underline", label: "U", className: "underline", titleKey: "editor.underline" },
  { command: "strikeThrough", label: "S", className: "line-through", titleKey: "day.strike" },
];

type Popover = "emoji" | "color" | null;

export default function NoteEditor({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
}) {
  const { t, dir } = useI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const [popover, setPopover] = useState<Popover>(null);
  const [textColor, setTextColor] = useState(TEXT_COLORS[0].hex);
  const [marks, setMarks] = useState<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value || "";
  }, [value]);

  useEffect(() => {
    if (!autoFocus) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [autoFocus]);

  useEffect(() => {
    const onSelection = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      if (!editor.contains(selection.anchorNode)) return;
      rangeRef.current = selection.getRangeAt(0).cloneRange();
      try {
        setMarks(
          [...MARKS.map((m) => m.command), "insertUnorderedList", "insertOrderedList"].filter((c) =>
            document.queryCommandState(c),
          ),
        );
      } catch {
        /* queryCommandState can throw in some browsers */
      }
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  const emit = () => onChange(editorRef.current?.innerHTML ?? "");

  const restore = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (rangeRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(rangeRef.current);
    }
  };

  const exec = (command: string, arg?: string) => {
    restore();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, arg);
    emit();
  };

  const applySize = (px: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    exec("fontSize", "7");
    editor.querySelectorAll<HTMLElement>('font[size="7"], span[style*="xxx-large"]').forEach((node) => {
      if (node.tagName === "FONT") {
        const span = document.createElement("span");
        span.innerHTML = node.innerHTML;
        span.style.fontSize = px;
        node.replaceWith(span);
      } else {
        node.style.fontSize = px;
      }
    });
    emit();
  };

  const insertEmoji = (emoji: string) => {
    restore();
    document.execCommand("insertText", false, emoji);
    rangeRef.current = window.getSelection()?.getRangeAt(0).cloneRange() ?? null;
    emit();
  };

  const toolButton = (active: boolean) =>
    cx(
      "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition",
      active ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-white",
    );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
      <div
        className="relative flex flex-wrap items-center gap-1 rounded-t-2xl border-b border-gray-100 bg-surface/70 p-1.5"
        onMouseDown={(event) => {
          if ((event.target as HTMLElement).tagName !== "SELECT") event.preventDefault();
        }}
      >
        <button
          type="button"
          title={t("day.emoji")}
          className={toolButton(popover === "emoji")}
          onClick={() => setPopover(popover === "emoji" ? null : "emoji")}
        >
          😊
        </button>
        <select
          title={t("editor.font")}
          defaultValue="inherit"
          onChange={(event) => exec("fontName", event.target.value)}
          className="h-8 rounded-lg border border-gray-200 bg-white px-1.5 text-xs text-navy-800"
        >
          {FONTS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label ?? t(font.labelKey ?? "")}
            </option>
          ))}
        </select>
        <select
          title={t("editor.fontSize")}
          defaultValue="15px"
          onChange={(event) => applySize(event.target.value)}
          className="h-8 rounded-lg border border-gray-200 bg-white px-1.5 text-xs text-navy-800"
        >
          {SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {t(size.labelKey)}
            </option>
          ))}
        </select>
        <button
          type="button"
          title={t("day.textColor")}
          className={toolButton(popover === "color")}
          onClick={() => setPopover(popover === "color" ? null : "color")}
        >
          <span className="flex flex-col items-center leading-none">
            <span className="text-[13px] font-bold">A</span>
            <span className="mt-0.5 h-1 w-4 rounded-full" style={{ backgroundColor: textColor }} />
          </span>
        </button>
        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        {MARKS.map((mark) => (
          <button
            key={mark.command}
            type="button"
            title={t(mark.titleKey)}
            className={cx(toolButton(marks.includes(mark.command)), mark.className)}
            onClick={() => exec(mark.command)}
          >
            {mark.label}
          </button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-gray-200" />
        <button
          type="button"
          title={t("editor.bulletTitle")}
          className={toolButton(marks.includes("insertUnorderedList"))}
          onClick={() => exec("insertUnorderedList")}
        >
          •≡
        </button>
        <button
          type="button"
          title={t("editor.numberTitle")}
          className={toolButton(marks.includes("insertOrderedList"))}
          onClick={() => exec("insertOrderedList")}
        >
          1≡
        </button>
        <button
          type="button"
          title={t("editor.clearTitle")}
          className={toolButton(false)}
          onClick={() => exec("removeFormat")}
        >
          ⌫
        </button>

        {popover === "emoji" ? (
          <div className="absolute start-1.5 top-full z-20 mt-1 grid w-[19rem] grid-cols-10 gap-0.5 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="flex size-7 items-center justify-center rounded-md text-lg transition hover:bg-surface"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        {popover === "color" ? (
          <div className="absolute start-1.5 top-full z-20 mt-1 w-[15.5rem] rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
            <ColorDots
              colors={TEXT_COLORS}
              value={textColor}
              size="sm"
              onChange={(hex) => {
                setTextColor(hex);
                exec("foreColor", hex);
                setPopover(null);
              }}
            />
          </div>
        ) : null}
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        data-placeholder={t("day.notePlaceholder")}
        onInput={emit}
        onBlur={emit}
        onMouseDown={() => setPopover(null)}
        className="rich-content min-h-[180px] max-h-[46vh] overflow-y-auto px-4 py-3 text-[15px] leading-8 text-ink outline-none"
      />
    </div>
  );
}
