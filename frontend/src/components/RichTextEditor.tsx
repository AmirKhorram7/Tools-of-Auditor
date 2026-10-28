"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type ToolbarAction = {
  label?: string;
  labelKey?: string;
  titleKey: string;
  command: string;
  value?: string;
};

const ACTIONS: ToolbarAction[] = [
  { label: "B", titleKey: "editor.bold", command: "bold" },
  { label: "I", titleKey: "editor.italic", command: "italic" },
  { label: "U", titleKey: "editor.underline", command: "underline" },
  { label: "H1", titleKey: "editor.h1", command: "formatBlock", value: "h1" },
  { label: "H2", titleKey: "editor.h2", command: "formatBlock", value: "h2" },
  { labelKey: "editor.paragraph", titleKey: "editor.paragraphTitle", command: "formatBlock", value: "p" },
  { labelKey: "editor.bullet", titleKey: "editor.bulletTitle", command: "insertUnorderedList" },
  { labelKey: "editor.number", titleKey: "editor.numberTitle", command: "insertOrderedList" },
  { labelKey: "editor.quote", titleKey: "editor.quote", command: "formatBlock", value: "blockquote" },
  { labelKey: "editor.alignRight", titleKey: "editor.alignRight", command: "justifyRight" },
  { labelKey: "editor.alignCenter", titleKey: "editor.alignCenterTitle", command: "justifyCenter" },
  { labelKey: "editor.alignLeft", titleKey: "editor.alignLeft", command: "justifyLeft" },
  { labelKey: "editor.clear", titleKey: "editor.clearTitle", command: "removeFormat" },
];

type FontOption = {
  label: string;
  /** CSS font-family applied to the selection. */
  value: string;
  /** Unique token used to detect this font from computed style. */
  match: string;
};

const FONT_GROUPS: Array<{ labelKey: string; fonts: FontOption[] }> = [
  {
    labelKey: "editor.fontsFa",
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
    labelKey: "editor.fontsEn",
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

const MIN_FONT = 8;
const MAX_FONT = 72;
const DEFAULT_FONT = "Tahoma, sans-serif";
const DEFAULT_SIZE = "14px";
const DEFAULT_COLOR = "#0F1111";

/** Common px sizes shown in the number field suggestions. Any integer 8–72 still works. */
const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72];

const EDITOR_COLORS: Array<{ hex: string; fa: string; en: string }> = [
  { hex: "#0F1111", fa: "مشکی", en: "Ink" },
  { hex: "#1A2B49", fa: "سرمه‌ای", en: "Navy" },
  { hex: "#4B5563", fa: "خاکستری", en: "Gray" },
  { hex: "#B91C1C", fa: "قرمز", en: "Red" },
  { hex: "#C7511F", fa: "نارنجی", en: "Orange" },
  { hex: "#B45309", fa: "کهربایی", en: "Amber" },
  { hex: "#166534", fa: "سبز", en: "Green" },
  { hex: "#0E7490", fa: "فیروزه‌ای", en: "Teal" },
  { hex: "#1D4ED8", fa: "آبی", en: "Blue" },
  { hex: "#6D28D9", fa: "بنفش", en: "Purple" },
];

const FOLD = "rte-fold";
const FOLD_HEAD = "rte-fold-head";
const FOLD_BODY = "rte-fold-body";
const FOLD_GUTTER = 22;

type InlineStyle = "fontFamily" | "fontSize" | "color";
const MAX_TABLE_COLS = 8;
const MAX_TABLE_ROWS = 20;
const TABLE_EDGE = 8;
const MIN_COL_W = 48;
const MAX_COL_W = 520;
const MIN_ROW_H = 28;
const MAX_ROW_H = 360;

type TableResize = {
  kind: "col" | "row";
  table: HTMLTableElement;
  index: number;
  startPos: number;
  startSize: number;
  rtl: boolean;
};

export type EditorMention = {
  id: number;
  title: string;
  href: string;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  /** Other steps in this process. When set, `/` opens a picker and inserts a link. */
  mentions?: EditorMention[];
  /** Orange save control next to Table. Same action as the page Save button. */
  onSave?: () => void;
  saving?: boolean;
  /** Increment after a successful save to flash the border green for 1s. */
  savedTick?: number;
};

const AUTHOR_BLOCKS = new Set(["P", "H1", "H2", "LI", "BLOCKQUOTE", "TD", "TH", "DIV"]);

function writerLabel(profile: { first_name?: string; last_name?: string; phone_number?: string } | null): string {
  if (!profile) return "";
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  const raw = full || (profile.phone_number ?? "");
  return raw.replace(/[\u0000-\u001F<>"']/g, "").trim().slice(0, 80);
}

function closestAuthorBlock(node: Node | null, editor: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    if (current instanceof HTMLElement) {
      if (
        current.classList.contains(FOLD) ||
        current.classList.contains(FOLD_BODY)
      ) {
        current = current.parentNode;
        continue;
      }
      if (AUTHOR_BLOCKS.has(current.tagName)) return current;
    }
    current = current.parentNode;
  }
  return null;
}

/** Mark the current paragraph/line as written by this user (last writer of the block). */
function stampWriter(editor: HTMLElement | null, label: string) {
  if (!editor || !label) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const anchor = selection.anchorNode;
  if (!anchor || !editor.contains(anchor)) return;

  let block = closestAuthorBlock(anchor, editor);
  if (!block && (anchor === editor || anchor.parentNode === editor)) {
    document.execCommand("formatBlock", false, "p");
    block = closestAuthorBlock(selection.anchorNode, editor);
  }
  if (!block) return;

  const text = (block.textContent || "").replace(/\u200B/g, "").trim();
  if (!text) {
    block.removeAttribute("data-author");
    block.removeAttribute("data-self");
    block.removeAttribute("title");
    return;
  }
  if (block.getAttribute("data-author") !== label) {
    block.setAttribute("data-author", label);
  }
  block.setAttribute("data-self", "");
  block.title = label;
}

function markSelfBlocks(editor: HTMLElement | null, label: string) {
  if (!editor) return;
  editor.querySelectorAll("[data-author]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (label && node.getAttribute("data-author") === label) {
      node.setAttribute("data-self", "");
    } else {
      node.removeAttribute("data-self");
    }
    const who = node.getAttribute("data-author") || "";
    if (who) node.title = who;
    else node.removeAttribute("title");
  });
}

function markWritingBlock(editor: HTMLElement | null) {
  if (!editor) return;
  editor.querySelectorAll("[data-writing]").forEach((node) => {
    node.removeAttribute("data-writing");
  });
  const selection = window.getSelection();
  if (!selection || !selection.anchorNode || !editor.contains(selection.anchorNode)) return;
  const block = closestAuthorBlock(selection.anchorNode, editor);
  if (block) block.setAttribute("data-writing", "");
}

function serializeEditorHtml(html: string): string {
  return html
    .replace(/\sdata-self(?:="[^"]*")?/gi, "")
    .replace(/\sdata-writing(?:="[^"]*")?/gi, "");
}

function findSlashTrigger(editor: HTMLElement): { node: Text; start: number; query: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;
  const node = range.startContainer;
  if (!(node instanceof Text)) return null;
  if (node.parentElement?.closest("a")) return null;
  const before = node.data.slice(0, range.startOffset);
  if (!/(?:^|[\s\u200c\u200B(\u060c،])\/[^\s/<]*$/.test(before)) return null;
  const start = before.lastIndexOf("/");
  if (start < 0) return null;
  return { node, start, query: before.slice(start + 1) };
}

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

function currentTableCell(editor: HTMLElement | null): HTMLTableCellElement | null {
  if (!editor) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const node = selection.anchorNode;
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  if (!element || !editor.contains(element)) return null;
  return element.closest("td, th");
}

function tableRowCount(table: HTMLTableElement): number {
  return table.rows.length;
}

function tableColCount(table: HTMLTableElement): number {
  const first = table.rows[0];
  return first ? first.cells.length : 0;
}

function emptyTableCell(tag: "th" | "td"): HTMLTableCellElement {
  const cell = document.createElement(tag);
  cell.innerHTML = "<br>";
  return cell;
}

function closestTableCell(target: EventTarget | null, editor: HTMLElement | null) {
  if (!(target instanceof Element) || !editor || !editor.contains(target)) return null;
  const cell = target.closest("td, th");
  return cell instanceof HTMLTableCellElement ? cell : null;
}

function tableEdge(
  cell: HTMLTableCellElement,
  clientX: number,
  clientY: number,
  rtl: boolean,
): "col" | "row" | null {
  const rect = cell.getBoundingClientRect();
  const nearCol = rtl ? clientX - rect.left <= TABLE_EDGE : rect.right - clientX <= TABLE_EDGE;
  const nearRow = rect.bottom - clientY <= TABLE_EDGE;
  if (nearCol) return "col";
  if (nearRow) return "row";
  return null;
}

function clampSize(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function setColumnWidth(table: HTMLTableElement, index: number, width: number) {
  const px = `${clampSize(width, MIN_COL_W, MAX_COL_W)}px`;
  table.style.tableLayout = "fixed";
  table.style.width = "auto";
  Array.from(table.rows).forEach((row) => {
    const cell = row.cells[index];
    if (!cell) return;
    cell.style.width = px;
    cell.style.minWidth = px;
    cell.style.maxWidth = px;
  });
}

function setRowHeight(table: HTMLTableElement, index: number, height: number) {
  const row = table.rows[index];
  if (!row) return;
  const px = `${clampSize(height, MIN_ROW_H, MAX_ROW_H)}px`;
  row.style.height = px;
  Array.from(row.cells).forEach((cell) => {
    cell.style.height = px;
  });
}

function parseSizePx(computed: string): number {
  const px = Math.round(Number.parseFloat(computed));
  if (!Number.isFinite(px)) return 14;
  return Math.min(MAX_FONT, Math.max(MIN_FONT, px));
}

function toHexColor(value: string): string {
  const raw = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toUpperCase();
    }
    return raw.toUpperCase();
  }
  const nums = raw.match(/\d+/g);
  if (!nums || nums.length < 3) return DEFAULT_COLOR;
  return `#${nums
    .slice(0, 3)
    .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/** Remove previous font/size/color so a new choice actually replaces it. */
function clearStyle(node: Node, property: InlineStyle) {
  if (node instanceof HTMLElement) {
    node.style[property] = "";
    if (property === "fontSize") node.removeAttribute("size");
    if (property === "fontFamily") node.removeAttribute("face");
    if (property === "color") node.removeAttribute("color");
    if (node.tagName === "FONT") {
      node.removeAttribute("size");
      node.removeAttribute("face");
      node.removeAttribute("color");
    }
  }
  Array.from(node.childNodes).forEach((child) => clearStyle(child, property));
}

const INLINE_TAGS = new Set(["SPAN", "FONT", "A", "B", "I", "U", "STRONG", "EM", "BR"]);

function editorBlock(node: Node | null, editor: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== editor) {
    const parent = current.parentElement;
    if (
      current instanceof HTMLElement &&
      parent &&
      (parent === editor || parent.classList.contains(FOLD_BODY))
    ) {
      if (current.classList.contains(FOLD_BODY) || INLINE_TAGS.has(current.tagName)) {
        current = parent;
        continue;
      }
      return current;
    }
    current = parent;
  }
  return null;
}

function unwrapFold(fold: HTMLElement) {
  const parent = fold.parentNode;
  if (!parent) return;
  const head = fold.querySelector(`:scope > .${FOLD_HEAD}`);
  const body = fold.querySelector(`:scope > .${FOLD_BODY}`);
  if (head instanceof HTMLElement) head.classList.remove(FOLD_HEAD);
  const nodes: Node[] = [];
  if (head) nodes.push(head);
  if (body) nodes.push(...Array.from(body.childNodes));
  for (const node of nodes) parent.insertBefore(node, fold);
  fold.remove();
}

function wrapFold(head: HTMLElement, following: HTMLElement[]) {
  const fold = document.createElement("div");
  fold.className = FOLD;
  const body = document.createElement("div");
  body.className = FOLD_BODY;
  head.classList.add(FOLD_HEAD);
  head.replaceWith(fold);
  fold.append(head, body);
  for (const node of following) body.appendChild(node);
  if (!body.childNodes.length) {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";
    body.appendChild(paragraph);
  }
  return fold;
}

function foldFromHead(block: HTMLElement): HTMLElement | null {
  if (block.classList.contains(FOLD)) return block;
  if (block.classList.contains(FOLD_HEAD)) {
    const fold = block.closest(`.${FOLD}`);
    return fold instanceof HTMLElement ? fold : null;
  }
  return null;
}

function isFoldGutterClick(
  event: { clientX: number },
  head: HTMLElement,
  rtl: boolean,
) {
  const rect = head.getBoundingClientRect();
  return rtl ? rect.right - event.clientX <= FOLD_GUTTER : event.clientX - rect.left <= FOLD_GUTTER;
}

function repairFolds(editor: HTMLElement | null) {
  if (!editor) return;
  editor.querySelectorAll(`.${FOLD}`).forEach((fold) => {
    if (!(fold instanceof HTMLElement)) return;
    if (fold.querySelector(`:scope > .${FOLD_HEAD}`)) return;
    const first = Array.from(fold.children).find((el) => !el.classList.contains(FOLD_BODY));
    if (first) first.classList.add(FOLD_HEAD);
    else unwrapFold(fold);
  });
}

/**
 * Lightweight RTL-first HTML editor built on contenteditable.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 180,
  maxHeight = 520,
  readOnly = false,
  mentions,
  onSave,
  saving = false,
  savedTick = 0,
}: Props) {
  const { t, dir, locale } = useI18n();
  const { profile } = useAuth();
  const resolvedPlaceholder = placeholder ?? t("editor.placeholder");
  const editorRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const sizeInputRef = useRef<HTMLInputElement>(null);
  const sizeListId = useId();
  const authorLabel = writerLabel(profile);
  const authorLabelRef = useRef(authorLabel);
  authorLabelRef.current = authorLabel;
  const savedRange = useRef<Range | null>(null);
  const resizeRef = useRef<TableResize | null>(null);
  const [tableCursor, setTableCursor] = useState<"col-resize" | "row-resize" | "">("");
  const [currentFont, setCurrentFont] = useState(DEFAULT_FONT);
  const [currentSize, setCurrentSize] = useState(DEFAULT_SIZE);
  const [sizeDraft, setSizeDraft] = useState("14");
  const [currentColor, setCurrentColor] = useState(DEFAULT_COLOR);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [inFold, setInFold] = useState(false);
  const [activeMarks, setActiveMarks] = useState<string[]>([]);
  const [inTable, setInTable] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [savedFlash, setSavedFlash] = useState(false);
  const mentionItems = mentions || [];
  const mentionEnabled = mentions != null && !readOnly;
  const mentionMatches = mentionItems
    .filter((item) => item.title.toLowerCase().includes(mentionQuery.toLowerCase()))
    .slice(0, 8);

  // Only sync from props when the saved HTML differs, so typing keeps the caret.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (serializeEditorHtml(editor.innerHTML) !== value) {
      editor.innerHTML = value || "";
      repairFolds(editor);
      markSelfBlocks(editor, authorLabelRef.current);
    }
  }, [value]);

  useEffect(() => {
    if (!savedTick) return;
    setSavedFlash(true);
    const timer = window.setTimeout(() => setSavedFlash(false), 1000);
    return () => window.clearTimeout(timer);
  }, [savedTick]);

  const emit = () => {
    onChange(serializeEditorHtml(editorRef.current?.innerHTML ?? ""));
  };

  const refreshMention = () => {
    if (!mentionEnabled) {
      if (mentionOpen) setMentionOpen(false);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const found = findSlashTrigger(editor);
    if (!found) {
      setMentionOpen(false);
      return;
    }
    const range = document.createRange();
    range.setStart(found.node, found.start);
    range.setEnd(found.node, found.start + 1 + found.query.length);
    const rect = range.getBoundingClientRect();
    setMentionQuery(found.query);
    setMentionIndex(0);
    setMentionPos({
      top: Math.min(rect.bottom + 6, window.innerHeight - 220),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
    });
    setMentionOpen(true);
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
    const nextSize = `${parseSizePx(style.fontSize)}px`;
    setCurrentFont(matchFont(style.fontFamily));
    setCurrentSize(nextSize);
    if (document.activeElement !== sizeInputRef.current) {
      setSizeDraft(String(parseSizePx(style.fontSize)));
    }
    setCurrentColor(toHexColor(style.color));
    setInTable(Boolean(element.closest("table")));
    setInFold(Boolean(element.closest(`.${FOLD_HEAD}`)));

    const marks: string[] = [];
    try {
      if (document.queryCommandState("bold")) marks.push("bold");
      if (document.queryCommandState("italic")) marks.push("italic");
      if (document.queryCommandState("underline")) marks.push("underline");
      if (document.queryCommandState("insertUnorderedList")) marks.push("insertUnorderedList");
      if (document.queryCommandState("insertOrderedList")) marks.push("insertOrderedList");
      if (document.queryCommandState("justifyRight")) marks.push("justifyRight");
      if (document.queryCommandState("justifyCenter")) marks.push("justifyCenter");
      if (document.queryCommandState("justifyLeft")) marks.push("justifyLeft");
      const block = (document.queryCommandValue("formatBlock") || "")
        .replace(/[<>]/g, "")
        .toLowerCase();
      if (block === "h1") marks.push("h1");
      else if (block === "h2") marks.push("h2");
      else if (block === "blockquote") marks.push("blockquote");
      else marks.push("p");
      if (element.closest("a")) marks.push("createLink");
    } catch {
      /* some browsers throw on queryCommandState */
    }
    setActiveMarks(marks);
  };

  useEffect(() => {
    const onSelectionChange = () => {
      readCurrentStyle();
      markWritingBlock(editorRef.current);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [readOnly]);

  useEffect(() => {
    if (readOnly) return;
    const onMove = (event: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      event.preventDefault();
      if (resize.kind === "col") {
        const delta = resize.rtl
          ? resize.startPos - event.clientX
          : event.clientX - resize.startPos;
        setColumnWidth(resize.table, resize.index, resize.startSize + delta);
      } else {
        setRowHeight(resize.table, resize.index, resize.startSize + (event.clientY - resize.startPos));
      }
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      emit();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [readOnly]);

  useEffect(() => {
    if (!paletteOpen) return;
    const close = (event: MouseEvent) => {
      if (paletteRef.current?.contains(event.target as Node)) return;
      setPaletteOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [paletteOpen]);

  const run = (action: ToolbarAction) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand(action.command, false, action.value);
    stampWriter(editorRef.current, authorLabelRef.current);
    emit();
    readCurrentStyle();
  };

  const applyInlineStyle = (
    property: InlineStyle,
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
    else if (property === "fontSize") {
      setCurrentSize(cssValue);
      setSizeDraft(String(parseSizePx(cssValue)));
    } else setCurrentColor(toHexColor(cssValue));
    emit();
  };

  const applyFontSize = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      setSizeDraft(String(parseSizePx(currentSize)));
      return;
    }
    const next = Math.min(MAX_FONT, Math.max(MIN_FONT, parsed));
    applyInlineStyle("fontSize", `${next}px`);
  };

  const toggleFold = (fold: HTMLElement | null) => {
    if (!fold) return;
    const collapsing = fold.getAttribute("data-collapsed") !== "true";
    if (collapsing) {
      fold.setAttribute("data-collapsed", "true");
      const selection = window.getSelection();
      const head = fold.querySelector(`:scope > .${FOLD_HEAD}`);
      const body = fold.querySelector(`:scope > .${FOLD_BODY}`);
      if (
        selection &&
        head &&
        body &&
        selection.anchorNode &&
        body.contains(selection.anchorNode)
      ) {
        const range = document.createRange();
        range.selectNodeContents(head);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      fold.removeAttribute("data-collapsed");
    }
    if (!readOnly) emit();
  };

  const applyFold = () => {
    if (readOnly) return;
    const editor = editorRef.current;
    if (!editor) return;
    restoreSelection();
    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    let block = editorBlock(selection.anchorNode, editor);
    if (!block) {
      document.execCommand("formatBlock", false, "p");
      block = editorBlock(selection.anchorNode, editor);
    }
    if (!block || block.tagName === "TABLE") return;

    const existing = foldFromHead(block);
    if (existing) {
      unwrapFold(existing);
      emit();
      readCurrentStyle();
      return;
    }

    const following: HTMLElement[] = [];
    if (!selection.isCollapsed) {
      const end = editorBlock(selection.getRangeAt(0).endContainer, editor);
      let sibling = block.nextElementSibling;
      while (
        sibling instanceof HTMLElement &&
        sibling.parentElement === block.parentElement &&
        sibling !== end?.nextElementSibling
      ) {
        following.push(sibling);
        sibling = sibling.nextElementSibling;
      }
    } else {
      let sibling = block.nextElementSibling;
      while (sibling instanceof HTMLElement) {
        if (sibling.classList.contains(FOLD) || sibling.classList.contains(FOLD_HEAD)) break;
        following.push(sibling);
        sibling = sibling.nextElementSibling;
      }
    }
    wrapFold(block, following);
    emit();
    readCurrentStyle();
  };

  const addLink = () => {
    if (readOnly) return;
    const editor = editorRef.current;
    if (!editor) return;

    const selected = selectedText();
    const urlRaw = window.prompt(t("editor.linkUrl"), "https://");
    if (urlRaw === null) return;
    const href = normalizeUrl(urlRaw);
    if (!href) return;

    const defaultLabel = selected || t("editor.linkDefault");
    const labelRaw = window.prompt(t("editor.linkLabel"), defaultLabel);
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

  const insertTable = () => {
    if (readOnly) return;
    const editor = editorRef.current;
    if (!editor) return;

    const colsRaw = window.prompt(t("editor.tableCols"), "3");
    if (colsRaw === null) return;
    const rowsRaw = window.prompt(t("editor.tableRows"), "4");
    if (rowsRaw === null) return;

    const cols = Math.min(MAX_TABLE_COLS, Math.max(1, Number.parseInt(colsRaw, 10) || 3));
    const rows = Math.min(MAX_TABLE_ROWS, Math.max(1, Number.parseInt(rowsRaw, 10) || 4));

    restoreSelection();
    editor.focus();

    const header = Array.from(
      { length: cols },
      (_, index) => `<th>${t("editor.tableHeader")} ${index + 1}</th>`,
    ).join("");
    const body = Array.from({ length: Math.max(rows - 1, 0) }, () => {
      const cells = Array.from({ length: cols }, () => "<td><br></td>").join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    const html =
      rows === 1
        ? `<table><tbody><tr>${header}</tr></tbody></table><p><br></p>`
        : `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table><p><br></p>`;

    document.execCommand("insertHTML", false, html);
    emit();
    setInTable(true);
  };

  const withTableCell = (fn: (cell: HTMLTableCellElement, table: HTMLTableElement) => void) => {
    if (readOnly) return;
    restoreSelection();
    const editor = editorRef.current;
    const cell = currentTableCell(editor);
    const table = cell?.closest("table");
    if (!editor || !cell || !table) return;
    fn(cell, table);
    editor.focus();
    emit();
    setInTable(true);
  };

  const addTableRow = () => {
    withTableCell((cell, table) => {
      if (tableRowCount(table) >= MAX_TABLE_ROWS) return;
      const row = cell.parentElement;
      if (!(row instanceof HTMLTableRowElement)) return;
      const next = document.createElement("tr");
      const tag = row.closest("thead") ? "th" : "td";
      Array.from(row.cells).forEach(() => next.appendChild(emptyTableCell(tag)));
      row.after(next);
    });
  };

  const removeTableRow = () => {
    withTableCell((cell, table) => {
      if (tableRowCount(table) <= 1) return;
      cell.parentElement?.remove();
    });
  };

  const addTableCol = () => {
    withTableCell((cell, table) => {
      if (tableColCount(table) >= MAX_TABLE_COLS) return;
      const index = cell.cellIndex;
      Array.from(table.rows).forEach((row) => {
        const tag = row.closest("thead") || row.cells[index]?.tagName === "TH" ? "th" : "td";
        const next = emptyTableCell(tag);
        const after = row.cells[index];
        if (after) after.after(next);
        else row.appendChild(next);
      });
    });
  };

  const removeTableCol = () => {
    withTableCell((cell, table) => {
      if (tableColCount(table) <= 1) return;
      const index = cell.cellIndex;
      Array.from(table.rows).forEach((row) => {
        row.cells[index]?.remove();
      });
    });
  };

  const insertMention = (item: EditorMention) => {
    const editor = editorRef.current;
    if (!editor) return;
    const found = findSlashTrigger(editor);
    editor.focus();
    const selection = window.getSelection();
    if (found && selection) {
      const range = document.createRange();
      range.setStart(found.node, found.start);
      range.setEnd(found.node, found.start + 1 + found.query.length);
      range.deleteContents();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const safeHref = item.href.replace(/"/g, "&quot;");
    const safeTitle = item.title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    document.execCommand(
      "insertHTML",
      false,
      `<a class="step-mention" href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>&nbsp;`,
    );
    setMentionOpen(false);
    stampWriter(editor, authorLabelRef.current);
    emit();
  };

  const handleEditorClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const head = (event.target as HTMLElement | null)?.closest(`.${FOLD_HEAD}`);
    if (head instanceof HTMLElement && isFoldGutterClick(event, head, dir === "rtl")) {
      return;
    }
    const target = (event.target as HTMLElement | null)?.closest("a");
    if (!target || !(target instanceof HTMLAnchorElement)) return;

    const isStepLink = target.classList.contains("step-mention");
    if (readOnly || isStepLink || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      if (target.href) {
        window.open(target.href, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !mentionOpen) {
      const editor = editorRef.current;
      const selection = window.getSelection();
      const block = editor ? editorBlock(selection?.anchorNode ?? null, editor) : null;
      if (block?.classList.contains(FOLD_HEAD)) {
        event.preventDefault();
        const fold = block.closest(`.${FOLD}`);
        const body = fold?.querySelector(`:scope > .${FOLD_BODY}`);
        if (fold instanceof HTMLElement && fold.getAttribute("data-collapsed") === "true") {
          fold.removeAttribute("data-collapsed");
        }
        const paragraph = document.createElement("p");
        paragraph.innerHTML = "<br>";
        body?.insertBefore(paragraph, body.firstChild);
        const caret = document.createRange();
        caret.setStart(paragraph, 0);
        caret.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(caret);
        stampWriter(editor, authorLabelRef.current);
        emit();
        return;
      }
    }
    if (!mentionOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMentionOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMentionIndex((current) =>
        mentionMatches.length === 0 ? 0 : (current + 1) % mentionMatches.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMentionIndex((current) =>
        mentionMatches.length === 0
          ? 0
          : (current - 1 + mentionMatches.length) % mentionMatches.length,
      );
      return;
    }
    if ((event.key === "Enter" || event.key === "Tab") && mentionMatches[mentionIndex]) {
      event.preventDefault();
      insertMention(mentionMatches[mentionIndex]);
    }
  };

  const handleTablePointerMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || resizeRef.current) return;
    const cell = closestTableCell(event.target, editorRef.current);
    if (!cell) {
      if (tableCursor) setTableCursor("");
      return;
    }
    const edge = tableEdge(cell, event.clientX, event.clientY, dir === "rtl");
    const next = edge === "col" ? "col-resize" : edge === "row" ? "row-resize" : "";
    if (next !== tableCursor) setTableCursor(next);
  };

  const handleEditorMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const head = (event.target as HTMLElement | null)?.closest(`.${FOLD_HEAD}`);
    if (
      head instanceof HTMLElement &&
      editorRef.current?.contains(head) &&
      isFoldGutterClick(event, head, dir === "rtl")
    ) {
      event.preventDefault();
      const fold = head.closest(`.${FOLD}`);
      toggleFold(fold instanceof HTMLElement ? fold : null);
      return;
    }
    handleTableResizeStart(event);
  };

  const handleTableResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || event.button !== 0) return;
    const cell = closestTableCell(event.target, editorRef.current);
    const table = cell?.closest("table");
    if (!cell || !table) return;
    const rtl = dir === "rtl";
    const edge = tableEdge(cell, event.clientX, event.clientY, rtl);
    if (!edge) return;
    event.preventDefault();
    const rect = cell.getBoundingClientRect();
    resizeRef.current = {
      kind: edge,
      table,
      index: edge === "col" ? cell.cellIndex : cell.parentElement instanceof HTMLTableRowElement
        ? cell.parentElement.rowIndex
        : 0,
      startPos: edge === "col" ? event.clientX : event.clientY,
      startSize: edge === "col" ? rect.width : rect.height,
      rtl,
    };
    document.body.style.cursor = edge === "col" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    setInTable(true);
  };

  return (
    <div
      className={cx(
        "overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow] duration-200",
        savedFlash
          ? "border-emerald-700 ring-2 ring-emerald-700/50"
          : "border-gray-300",
        !readOnly &&
          !savedFlash &&
          "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200",
      )}
    >
      {!readOnly && (
        <div className="relative flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-1.5 max-md:flex-nowrap max-md:overflow-x-auto">
          <select
            className="h-7 max-w-[168px] rounded border border-gray-300 bg-white px-1.5 text-xs text-navy-800"
            value={currentFont}
            title={t("editor.font")}
            onMouseDown={saveSelection}
            onChange={(event) => applyInlineStyle("fontFamily", event.target.value)}
          >
            {FONT_GROUPS.map((group) => (
              <optgroup key={group.labelKey} label={t(group.labelKey)}>
                {group.fonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <input
            ref={sizeInputRef}
            type="number"
            min={MIN_FONT}
            max={MAX_FONT}
            step={1}
            list={sizeListId}
            value={sizeDraft}
            title={t("editor.fontSize")}
            aria-label={t("editor.fontSize")}
            className="h-7 w-[3.4rem] rounded border border-gray-300 bg-white px-1 text-center text-xs text-navy-800"
            onMouseDown={saveSelection}
            onChange={(event) => {
              const raw = event.target.value;
              setSizeDraft(raw);
              const parsed = Number.parseInt(raw, 10);
              if (Number.isFinite(parsed) && parsed >= MIN_FONT && parsed <= MAX_FONT) {
                applyInlineStyle("fontSize", `${parsed}px`);
              }
            }}
            onBlur={() => applyFontSize(sizeDraft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFontSize(sizeDraft);
                editorRef.current?.focus();
              }
            }}
          />
          <datalist id={sizeListId}>
            {FONT_SIZE_PRESETS.map((size) => (
              <option key={size} value={size} />
            ))}
          </datalist>

          <div className="relative" ref={paletteRef}>
            <button
              type="button"
              title={t("editor.colorTitle")}
              aria-label={t("editor.colorTitle")}
              aria-expanded={paletteOpen}
              onMouseDown={(event) => {
                event.preventDefault();
                saveSelection();
              }}
              onClick={() => setPaletteOpen((open) => !open)}
              className="flex h-7 min-w-7 flex-col items-center justify-center rounded px-1.5 text-navy-800 transition hover:bg-white hover:text-brand-700"
            >
              <span className="text-[13px] font-bold leading-none">A</span>
              <span
                className="mt-0.5 h-[3px] w-4 rounded-full"
                style={{ backgroundColor: currentColor }}
              />
            </button>
            {paletteOpen && (
              <div className="absolute top-full z-30 mt-1 w-[11.5rem] rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                <div className="grid grid-cols-5 gap-1.5">
                  {EDITOR_COLORS.map((color) => {
                    const active = color.hex === currentColor;
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        title={locale === "fa" ? color.fa : color.en}
                        aria-label={locale === "fa" ? color.fa : color.en}
                        aria-pressed={active}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          applyInlineStyle("color", color.hex);
                          setPaletteOpen(false);
                        }}
                        className={cx(
                          "size-5 rounded-full transition hover:scale-110",
                          active ? "ring-2 ring-offset-1 ring-navy-800" : "ring-1 ring-black/10",
                        )}
                        style={{ backgroundColor: color.hex }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <span className="mx-0.5 h-4 w-px bg-gray-300" />

          {ACTIONS.map((action) => {
            const mark =
              action.command === "formatBlock" ? action.value ?? "" : action.command;
            const selected = activeMarks.includes(mark);
            return (
              <button
                key={action.titleKey}
                type="button"
                title={t(action.titleKey)}
                aria-pressed={selected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => run(action)}
                className={cx(
                  "rounded px-2 py-1 text-xs transition",
                  selected
                    ? "bg-navy-900 text-white"
                    : "text-navy-800 hover:bg-white hover:text-brand-700",
                  action.command === "bold" && "font-bold",
                  action.command === "italic" && "italic",
                  action.command === "underline" && "underline",
                )}
              >
                {action.label ?? t(action.labelKey ?? action.titleKey)}
              </button>
            );
          })}

          <button
            type="button"
            title={inFold ? t("editor.unfoldTitle") : t("editor.foldTitle")}
            aria-pressed={inFold}
            onMouseDown={(event) => event.preventDefault()}
            onClick={applyFold}
            className={cx(
              "rounded px-2 py-1 text-xs transition",
              inFold
                ? "bg-navy-900 text-white"
                : "text-navy-800 hover:bg-white hover:text-brand-700",
            )}
          >
            {t("editor.fold")}
          </button>

          <button
            type="button"
            title={t("editor.addLinkTitle")}
            aria-pressed={activeMarks.includes("createLink")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={addLink}
            className={cx(
              "rounded px-2 py-1 text-xs transition",
              activeMarks.includes("createLink")
                ? "bg-navy-900 text-white"
                : "text-navy-800 hover:bg-white hover:text-brand-700",
            )}
          >
            {t("editor.addLink")}
          </button>
          <button
            type="button"
            title={t("editor.removeLinkTitle")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeLink}
            className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
          >
            {t("editor.removeLink")}
          </button>
          <button
            type="button"
            title={t("editor.tableTitle")}
            onMouseDown={(event) => {
              event.preventDefault();
              saveSelection();
            }}
            onClick={insertTable}
            className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
          >
            {t("editor.table")}
          </button>
          {onSave && (
            <button
              type="button"
              title={t("editor.save")}
              disabled={saving}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onSave}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              <SaveDiskIcon />
            </button>
          )}
          {inTable && (
            <>
              <span className="mx-0.5 h-4 w-px bg-gray-300" />
              {(
                [
                  ["editor.tableAddRow", addTableRow],
                  ["editor.tableDelRow", removeTableRow],
                  ["editor.tableAddCol", addTableCol],
                  ["editor.tableDelCol", removeTableCol],
                ] as const
              ).map(([key, action]) => (
                <button
                  key={key}
                  type="button"
                  title={t(key)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    saveSelection();
                  }}
                  onClick={action}
                  className="rounded px-2 py-1 text-xs text-navy-800 transition hover:bg-white hover:text-brand-700"
                >
                  {t(key)}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!readOnly}
        dir={dir}
        suppressContentEditableWarning
        data-placeholder={resolvedPlaceholder}
        onInput={() => {
          if (!readOnly) {
            repairFolds(editorRef.current);
            stampWriter(editorRef.current, authorLabelRef.current);
            markWritingBlock(editorRef.current);
            emit();
            refreshMention();
          }
        }}
        onBlur={() => {
          if (!readOnly) emit();
        }}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={() => {
          readCurrentStyle();
          if (!readOnly) refreshMention();
        }}
        onClick={handleEditorClick}
        onMouseUp={readCurrentStyle}
        onMouseMove={handleTablePointerMove}
        onMouseDown={handleEditorMouseDown}
        onMouseLeave={() => {
          if (!resizeRef.current) setTableCursor("");
        }}
        style={{ minHeight, maxHeight, cursor: tableCursor || undefined }}
        className={cx(
          "rich-content overflow-y-auto px-3 py-2.5 text-sm outline-none",
          readOnly && "bg-gray-50 text-gray-800",
        )}
      />

      {!readOnly && mentionOpen && (
        <div
          className="fixed z-50 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{ top: mentionPos.top, left: mentionPos.left }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <p className="border-b border-gray-100 px-2.5 py-1.5 text-[11px] font-medium text-gray-500">
            {t("editor.mentionTitle")}
          </p>
          {mentionMatches.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-gray-500">{t("editor.mentionEmpty")}</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {mentionMatches.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => insertMention(item)}
                    className={cx(
                      "flex w-full px-2.5 py-1.5 text-right text-sm",
                      index === mentionIndex
                        ? "bg-navy-900 text-white"
                        : "text-navy-900 hover:bg-surface",
                    )}
                  >
                    <span className="line-clamp-2">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!readOnly && (
        <p className="border-t border-gray-100 bg-gray-50 px-3 py-1 text-[11px] text-gray-500">
          {t("editor.hint")}
          {mentionEnabled ? ` ${t("editor.mentionHint")}` : ""}
        </p>
      )}
    </div>
  );
}

function SaveDiskIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path
        d="M5.5 4.5h10.2L19.5 8.3V19.5H5.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 4.5h7v4.2H8V4.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 13.2h8v6.3H8v-6.3Z" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
