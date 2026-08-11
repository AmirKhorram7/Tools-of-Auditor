"use client";

import { useEffect, useRef } from "react";

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

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
};

/**
 * Lightweight RTL-first HTML editor built on contenteditable.
 * Keeps the MVP dependency-free; swap for TipTap later if needed.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "متن خود را وارد کنید...",
  minHeight = 180,
  readOnly = false,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Only sync from props when the DOM differs, so typing keeps the caret stable.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) {
      editor.innerHTML = value || "";
    }
  }, [value]);

  const run = (action: ToolbarAction) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand(action.command, false, action.value);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const addLink = () => {
    if (readOnly) return;
    const url = window.prompt("آدرس لینک را وارد کنید:", "https://");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url);
    onChange(editorRef.current?.innerHTML ?? "");
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
        <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 p-1.5">
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
            title="افزودن لینک"
            onMouseDown={(event) => event.preventDefault()}
            onClick={addLink}
            className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
          >
            🔗 لینک
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
        onInput={(event) => {
          if (!readOnly) onChange(event.currentTarget.innerHTML);
        }}
        onBlur={(event) => {
          if (!readOnly) onChange(event.currentTarget.innerHTML);
        }}
        className={cx(
          "rich-content max-h-[520px] overflow-y-auto px-3 py-2.5 text-sm outline-none",
          readOnly && "bg-gray-50 text-gray-800",
        )}
      />
    </div>
  );
}
