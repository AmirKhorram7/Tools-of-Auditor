"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { isToken, type KmTokenId } from "@/lib/knowledge-colors";
import { docToHtml, editorPlain, editorToDoc } from "@/lib/knowledge-marks";
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
  const labelsRef = useRef(labels);
  const contentRef = useRef(content);
  labelsRef.current = labels;
  contentRef.current = content;

  function emit(dirty = false) {
    const root = host.current;
    if (!root) return;
    const selection = window.getSelection();
    const plain = editorPlain(root, selection?.anchorNode ?? null, selection?.anchorOffset ?? 0);
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
      const root = host.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const fragment = range.extractContents();
      stripMarks(fragment, kind);
      if (token) {
        const span = document.createElement("span");
        if (kind === "color") span.dataset.color = token;
        else span.dataset.highlight = token;
        span.appendChild(fragment);
        range.insertNode(span);
      } else {
        range.insertNode(fragment);
      }
      emit(true);
    },
    clearFormatting: () => {
      const root = host.current;
      const selection = window.getSelection();
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const fragment = range.extractContents();
      stripMarks(fragment, "color");
      stripMarks(fragment, "highlight");
      range.insertNode(fragment);
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
