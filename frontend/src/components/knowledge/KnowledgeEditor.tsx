"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { isToken, type KmTokenId } from "@/lib/knowledge-colors";
import { caretPiece, docToHtml, editorPlain, editorToDoc, visualLines, wrapLoose } from "@/lib/knowledge-marks";
import type { KmDoc } from "@/lib/knowledge";

export type KnowledgeEditorHandle = {
  getDoc: () => KmDoc;
  prefixLine: (prefix: string) => void;
  insert: (snippet: string) => void;
  replaceSlash: (snippet: string) => void;
  wrap: (mark: string, sample: string) => void;
  applyMark: (kind: "color" | "highlight", token: KmTokenId | null) => void;
  clearFormatting: () => void;
  insertCallout: (token: KmTokenId, label: string) => void;
  insertLink: (name: string) => void;
  load: (content: unknown) => void;
  lineColor: () => KmTokenId | null;
};

type Props = {
  pageId: number;
  content: unknown;
  labels: Record<string, string>;
  placeholder: string;
  onEdit: (plain: string, cursor: number, dirty: boolean) => void;
};

const KnowledgeEditor = forwardRef<KnowledgeEditorHandle, Props>(function KnowledgeEditor(
  { pageId, content, labels, placeholder, onEdit },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLElement | null>(null);
  const labelsRef = useRef(labels);
  const contentRef = useRef(content);
  labelsRef.current = labels;
  contentRef.current = content;

  function emit(dirty = false) {
    const root = host.current;
    if (!root) return;
    const selection = window.getSelection();
    const plain = editorPlain(root, selection?.anchorNode ?? null, selection?.anchorOffset ?? 0);
    if (selection?.anchorNode && root.contains(selection.anchorNode)) {
      const line = lineOf(selection.anchorNode, root);
      if (line) lineRef.current = line;
    }
    onEdit(plain.plain, plain.cursor, dirty);
  }

  function load(next: unknown) {
    if (!host.current) return;
    host.current.innerHTML = docToHtml(next, labelsRef.current);
  }

  useLayoutEffect(() => {
    load(contentRef.current);
    // Reload only when the open page changes. Saving must not move the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  function blockAtCaret(): HTMLElement | null {
    const root = host.current;
    const selection = window.getSelection();
    if (!root || !selection?.anchorNode || !root.contains(selection.anchorNode)) return null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== root) {
      if (node instanceof HTMLElement && node.parentElement === root) return node;
      node = node.parentNode;
    }
    return null;
  }

  function insertText(value: string) {
    host.current?.focus();
    document.execCommand("insertText", false, value);
    emit(true);
  }

  useImperativeHandle(ref, () => ({
    getDoc: () => (host.current ? editorToDoc(host.current) : { type: "doc", content: [] }),
    prefixLine: (prefix: string) => {
      const block = blockAtCaret();
      const root = host.current;
      const selection = window.getSelection();
      if (!block || !root || !selection) return;
      const target = block.dataset.callout ? (block.querySelector("div") ?? block) : block;
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      insertText(prefix);
    },
    insert: (snippet) => insertText(snippet),
    replaceSlash: (snippet) => {
      const block = blockAtCaret();
      const selection = window.getSelection();
      if (!block || !selection || selection.rangeCount === 0) return;
      const range = document.createRange();
      const target = block.dataset.callout ? (block.querySelector("div") ?? block) : block;
      range.selectNodeContents(target);
      range.setEnd(selection.anchorNode!, selection.anchorOffset);
      selection.removeAllRanges();
      selection.addRange(range);
      insertText(snippet);
    },
    wrap: (mark, sample) => {
      const selected = window.getSelection()?.toString() || sample;
      insertText(`${mark}${selected}${mark}`);
    },
    applyMark: (kind, token) => {
      const line = lineUnderCaret(host.current, lineRef.current);
      if (!line) return;
      paintLine(line, kind, token);
      lineRef.current = line;
      emit(true);
    },
    clearFormatting: () => {
      const line = lineUnderCaret(host.current, lineRef.current);
      if (!line) return;
      paintLine(line, "color", null);
      paintLine(line, "highlight", null);
      lineRef.current = line;
      emit(true);
    },
    insertLink: (name: string) => {
      const block = blockAtCaret();
      const selection = window.getSelection();
      if (!block || !selection) {
        insertText(`[[${name}]]`);
        return;
      }
      const text = block.innerText ?? "";
      const open = text.lastIndexOf("[[");
      if (open < 0) {
        insertText(`[[${name}]]`);
        return;
      }
      const located = locate(block, open);
      if (!located) {
        insertText(`[[${name}]]`);
        return;
      }
      const range = document.createRange();
      range.setStart(located.node, located.offset);
      range.setEnd(selection.anchorNode!, selection.anchorOffset);
      selection.removeAllRanges();
      selection.addRange(range);
      insertText(`[[${name}]]`);
    },
    insertCallout: (token, label) => {
      const root = host.current;
      if (!root || !isToken(token)) return;
      const callout = document.createElement("div");
      callout.dataset.callout = token;
      const title = document.createElement("span");
      title.dataset.label = "1";
      title.contentEditable = "false";
      title.textContent = label;
      const body = document.createElement("div");
      body.appendChild(document.createElement("br"));
      callout.append(title, body);
      const block = blockAtCaret();
      if (block?.parentElement === root) block.after(callout);
      else root.appendChild(callout);
      emit(true);
    },
    load,
    lineColor: () => {
      const root = host.current;
      if (!root) return null;
      const selection = window.getSelection();
      const fromCaret =
        selection?.anchorNode && root.contains(selection.anchorNode) ? lineOf(selection.anchorNode, root) : null;
      const line = fromCaret ?? (lineRef.current && root.contains(lineRef.current) ? lineRef.current : null);
      const token = line?.dataset.color;
      return isToken(token) ? token : null;
    },
  }));

  return (
    <div
      ref={host}
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      data-placeholder={placeholder}
      contentEditable
      suppressContentEditableWarning
      className="km-editor mt-2"
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        const root = host.current;
        if (!root) return;
        wrapLoose(root);
        const selection = window.getSelection();
        if (!selection?.anchorNode || !root.contains(selection.anchorNode)) return;
        const line = lineOf(selection.anchorNode, root);
        if (!line || line.dataset.callout) return;
        event.preventDefault();
        splitLine(line);
        emit(true);
      }}
      onInput={() => emit(true)}
      onKeyUp={() => emit(false)}
      onMouseUp={() => emit(false)}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
        emit(true);
      }}
    />
  );
});

export default KnowledgeEditor;

function lineUnderCaret(root: HTMLElement | null, remembered: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  wrapLoose(root);
  const selection = window.getSelection();
  const anchor = selection?.anchorNode && root.contains(selection.anchorNode) ? selection.anchorNode : null;
  const line = anchor ? lineOf(anchor, root) : remembered && root.contains(remembered) ? remembered : null;
  if (!line) return null;
  const piece = caretPiece(line, anchor, selection?.anchorOffset ?? 0);
  const parts = visualLines(line);
  return parts[Math.min(piece, parts.length - 1)] ?? parts[0] ?? null;
}

function lineOf(node: Node, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current instanceof HTMLElement && current.parentElement === root) return current;
    current = current.parentNode;
  }
  return null;
}

function paintLine(line: HTMLElement, kind: "color" | "highlight", token: KmTokenId | null) {
  const target = line.dataset.callout ? (line.querySelector("div") ?? line) : line;
  stripMarks(target, kind);
  const key = kind === "color" ? "color" : "highlight";
  if (token) target.dataset[key] = token;
  else delete target.dataset[key];
}

function splitLine(line: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  const after = range.cloneRange();
  after.selectNodeContents(line);
  after.setStart(range.endContainer, range.endOffset);
  const fragment = after.extractContents();
  const next = document.createElement("div");
  if (isToken(line.dataset.color)) next.dataset.color = line.dataset.color;
  if (isToken(line.dataset.highlight)) next.dataset.highlight = line.dataset.highlight;
  if (!fragment.textContent) next.appendChild(document.createElement("br"));
  else next.appendChild(fragment);
  if (!line.textContent) line.replaceChildren(document.createElement("br"));
  line.after(next);
  const caret = document.createRange();
  caret.selectNodeContents(next);
  caret.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caret);
}

function locate(root: HTMLElement, index: number): { node: Text; offset: number } | null {
  let left = index;
  const walk = (node: Node): { node: Text; offset: number } | null => {
    if (node instanceof HTMLElement && node.dataset.label) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const length = text.data.length;
      if (left <= length) return { node: text, offset: left };
      left -= length;
      return null;
    }
    if (node instanceof HTMLElement) {
      for (const child of node.childNodes) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(root);
}

function stripMarks(root: Node, kind: "color" | "highlight") {
  const spans = root instanceof HTMLElement || root instanceof DocumentFragment
    ? [...root.querySelectorAll("span")]
    : [];
  if (root instanceof HTMLElement && root.tagName === "SPAN") spans.unshift(root);
  for (const span of spans) {
    if (kind === "color") delete span.dataset.color;
    else delete span.dataset.highlight;
    if (!span.dataset.color && !span.dataset.highlight && !span.dataset.label) {
      const parent = span.parentNode;
      while (span.firstChild) parent?.insertBefore(span.firstChild, span);
      span.remove();
    }
  }
}
