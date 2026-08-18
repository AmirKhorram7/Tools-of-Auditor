"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "@/components/ui";

type ToolbarAction = {
  label: string;
  title: string;
  command: string;
  value?: string;
};

const ACTIONS: ToolbarAction[] = [
  { label: "B", title: "درشت", command: "bold" },
  { label: "I", title: "کج", command: "italic" },
  { label: "U", title: "زیرخط", command: "underline" },
  { label: "H1", title: "تیتر ۱", command: "formatBlock", value: "h1" },
  { label: "H2", title: "تیتر ۲", command: "formatBlock", value: "h2" },
  { label: "متن", title: "متن ساده", command: "formatBlock", value: "p" },
  { label: "• لیست", title: "لیست نقطه‌ای", command: "insertUnorderedList" },
  { label: "۱. لیست", title: "لیست عددی", command: "insertOrderedList" },
  { label: "نقل‌قول", title: "نقل‌قول", command: "formatBlock", value: "blockquote" },
  { label: "راست‌چین", title: "راست‌چین", command: "justifyRight" },
  { label: "وسط", title: "وسط‌چین", command: "justifyCenter" },
  { label: "چپ‌چین", title: "چپ‌چین", command: "justifyLeft" },
  { label: "پاک‌کردن", title: "حذف قالب‌بندی", command: "removeFormat" },
];

type FontOption = {
  label: string;
  /** CSS font-family applied to the selection. */
  value: string;
  /** Unique token used to detect this font from computed style. */
  match: string;
};

const FONT_GROUPS: Array<{ label: string; fonts: FontOption[] }> = [
  {
    label: "فارسی",
    fonts: [
      {
        label: "B Nazanin",
        value: '"B Nazanin", BNazanin, Tahoma, sans-serif',
        match: "nazanin",
      },
      {
        label: "B Lotus",
        value: '"B Lotus", BLotus, Tahoma, sans-serif',
        match: "lotus",
      },
      {
        label: "B Titr",
        value: '"B Titr", BTitr, Tahoma, sans-serif',
        match: "titr",
      },
      {
        label: "B Zar",
        value: '"B Zar", BZar, Tahoma, sans-serif',
        match: "zar",
      },
      {
        label: "B Traffic",
        value: '"B Traffic", BTraffic, Tahoma, sans-serif',
        match: "traffic",
      },
      {
        label: "B Koodak",
        value: '"B Koodak", BKoodak, Tahoma, sans-serif',
        match: "koodak",
      },
      { label: "Tahoma", value: "Tahoma, sans-serif", match: "tahoma" },
    ],
  },
  {
    label: "English",
    fonts: [
      { label: "Arial", value: "Arial, Helvetica, sans-serif", match: "arial" },
      { label: "Georgia", value: "Georgia, serif", match: "georgia" },
      {
        label: "Times New Roman",
        value: '"Times New Roman", Times, serif',
        match: "times",
      },
      { label: "Verdana", value: "Verdana, Geneva, sans-serif", match: "verdana" },
      {
        label: "Trebuchet MS",
        value: '"Trebuchet MS", sans-serif',
        match: "trebuchet",
      },
      { label: "Segoe UI", value: '"Segoe UI", Tahoma, sans-serif', match: "segoe" },
      {
        label: "Courier New",
        value: '"Courier New", Courier, monospace',
        match: "courier",
      },
    ],
  },
];

const ALL_FONTS = FONT_GROUPS.flatMap((group) => group.fonts);

const FONT_SIZES = [
  { label: "کوچک", value: "12px" },
  { label: "عادی", value: "14px" },
  { label: "متوسط", value: "16px" },
  { label: "بزرگ", value: "18px" },
  { label: "خیلی بزرگ", value: "22px" },
];

const DEFAULT_FONT = "Tahoma, sans-serif";
const DEFAULT_SIZE = "14px";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
};

function selectedText(): string {
  return window.getSelection()?.toString().trim() ?? "";
}

function normalizeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("mailto:")) return url;
  if (url.startsWith("www.")) return `https://${url}`;
  return `https://${url}`;
}

function matchFont(computed: string): string {
  const lower = computed.toLowerCase().replace(/['"]/g, "");
  const found = [...ALL_FONTS]
    .sort((a, b) => b.match.length - a.match.length)
    .find((font) => lower.includes(font.match));
  return found?.value ?? DEFAULT_FONT;
}

function matchSize(computed: string): string {
  const px = Number.parseFloat(computed);
  if (!Number.isFinite(px)) return DEFAULT_SIZE;
  let closest = FONT_SIZES[0].value;
  let best = Infinity;
  for (const size of FONT_SIZES) {
    const diff = Math.abs(Number.parseFloat(size.value) - px);
    if (diff < best) {
      best = diff;
      closest = size.value;
    }
  }
  return closest;
}

/** Remove previous font/size so a new choice actually replaces it. */
function clearStyle(node: Node, property: "fontSize" | "fontFamily") {
  if (node instanceof HTMLElement) {
    node.style[property] = "";
    if (property === "fontSize") node.removeAttribute("size");
    if (property === "fontFamily") node.removeAttribute("face");
    if (node.tagName === "FONT") {
      node.removeAttribute("size");
      node.removeAttribute("face");
    }
  }
  Array.from(node.childNodes).forEach((child) => clearStyle(child, property));
}

/**
 * Lightweight RTL-first HTML editor built on contenteditable.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "متن خود را وارد کنید...",
  minHeight = 180,
  readOnly = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [currentFont, setCurrentFont] = useState(DEFAULT_FONT);
  const [currentSize, setCurrentSize] = useState(DEFAULT_SIZE);

  // Only sync from props when the DOM differs, so typing keeps the caret stable.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  const emit = () => {
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;
    savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || !savedRange.current) return;
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(savedRange.current);
  };

  const readCurrentStyle = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;

    const node = selection.anchorNode;
    const element =
      node instanceof HTMLElement ? node : node?.parentElement;
    if (!element || !editor.contains(element)) return;

    const style = window.getComputedStyle(element);
    setCurrentFont(matchFont(style.fontFamily));
    setCurrentSize(matchSize(style.fontSize));
  };

  useEffect(() => {
    if (readOnly) return;
    const onSelectionChange = () => readCurrentStyle();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [readOnly]);

  const run = (action: ToolbarAction) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand(action.command, false, action.value);
    emit();
    readCurrentStyle();
  };

  const applyInlineStyle = (
    property: "fontFamily" | "fontSize",
    cssValue: string,
  ) => {
    if (readOnly || !cssValue) return;
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();
    editor.focus();

    const selection = window.getSelection();
    if (!selection) return;

    if (selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      savedRange.current = null;
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed) {
      const span = document.createElement("span");
      span.style[property] = cssValue;
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);
      const caret = document.createRange();
      caret.setStart(span.firstChild ?? span, 1);
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);
      savedRange.current = caret.cloneRange();
    } else {
      const fragment = range.extractContents();
      clearStyle(fragment, property);
      const span = document.createElement("span");
      span.style[property] = cssValue;
      span.appendChild(fragment);
      range.insertNode(span);
      const next = document.createRange();
      next.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(next);
      savedRange.current = next.cloneRange();
    }

    if (property === "fontFamily") setCurrentFont(cssValue);
    else setCurrentSize(cssValue);
    emit();
  };

  const addLink = () => {
    if (readOnly) return;
    const editor = editorRef.current;
    if (!editor) return;

    const selected = selectedText();
    const urlRaw = window.prompt("آدرس لینک را وارد کنید:", "https://");
    if (urlRaw === null) return;
    const href = normalizeUrl(urlRaw);
    if (!href) return;

    const defaultLabel = selected || "لینک";
    const labelRaw = window.prompt("نام نمایشی لینک (متن کوتاه):", defaultLabel);
    if (labelRaw === null) return;
    const label = labelRaw.trim() || defaultLabel;

    editor.focus();

    const safeHref = href.replace(/"/g, "&quot;");
    const safeLabel = label
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>&nbsp;`;
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const removeLink = () => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand("unlink");
    emit();
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest("a");
    if (!target || !(target instanceof HTMLAnchorElement)) return;

    if (readOnly || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      if (target.href) {
        window.open(target.href, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <div
      className={cx(
        "overflow-hidden rounded-lg border border-gray-300 bg-white",
        !readOnly &&
          "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200",
      )}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-1.5">
          <select
            className="h-7 max-w-[168px] rounded border border-gray-300 bg-white px-1.5 text-xs text-navy-800"
            value={currentFont}
            title="قلم"
            onMouseDown={saveSelection}
            onChange={(event) => applyInlineStyle("fontFamily", event.target.value)}
          >
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.fonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            className="h-7 max-w-[110px] rounded border border-gray-300 bg-white px-1.5 text-xs text-navy-800"
            value={currentSize}
            title="اندازه قلم"
            onMouseDown={saveSelection}
            onChange={(event) => applyInlineStyle("fontSize", event.target.value)}
          >
            {FONT_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>

          <span className="mx-0.5 h-4 w-px bg-gray-300" />

          {ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              title={action.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => run(action)}
              className={cx(
                "rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700",
                action.command === "bold" && "font-bold",
                action.command === "italic" && "italic",
                action.command === "underline" && "underline",
              )}
            >
              {action.label}
            </button>
          ))}

          <button
            type="button"
            title="افزودن لینک با نام نمایشی"
            onMouseDown={(event) => event.preventDefault()}
            onClick={addLink}
            className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
          >
            🔗 لینک
          </button>
          <button
            type="button"
            title="حذف لینک"
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeLink}
            className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
          >
            برداشتن لینک
          </button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        dir="rtl"
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={() => {
          if (!readOnly) emit();
        }}
        onBlur={() => {
          if (!readOnly) emit();
        }}
        onClick={handleEditorClick}
        onKeyUp={readCurrentStyle}
        onMouseUp={readCurrentStyle}
        className={cx(
          "rich-content max-h-[520px] overflow-y-auto px-3 py-2.5 text-sm outline-none",
          readOnly && "bg-gray-50 text-gray-800",
        )}
      />

      {!readOnly && (
        <p className="border-t border-gray-100 bg-gray-50 px-3 py-1 text-[11px] text-gray-500">
          متن را انتخاب کنید، سپس قلم یا اندازه را عوض کنید. برای باز کردن لینک هنگام ویرایش: Ctrl+کلیک.
        </p>
      )}
    </div>
  );
}
