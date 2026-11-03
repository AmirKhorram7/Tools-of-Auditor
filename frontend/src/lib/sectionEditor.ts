/**
 * SectionEditor — "Section" block for a contenteditable editor.
 * Port of section-editor.js (DESIGN.md §§3–4). Framework-agnostic, RTL-safe.
 */

const BLOCK_MEDIA = "img,table,hr,iframe,video,pre";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

function el(tag: string, cls?: string, attrs?: Record<string, string>) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

const newP = () => {
  const p = document.createElement("p");
  p.appendChild(document.createElement("br"));
  return p;
};

const isEmpty = (n: Element) =>
  n.textContent?.trim() === "" && !n.querySelector(BLOCK_MEDIA);

const asEl = (n: Node | null): Element | null =>
  n && n.nodeType === 3 ? (n as Text).parentElement : (n as Element | null);

const closestIn = (n: Node | null, sel: string, root: HTMLElement) => {
  const c = asEl(n)?.closest(sel);
  return c && root.contains(c) ? c : null;
};

const directChild = (node: Node | null, container: Element): Node | null => {
  while (node && node.parentNode !== container) node = node.parentNode;
  return node || null;
};

const head = (s: Element) => s.querySelector(":scope > .ed-section-head");
const titleOf = (s: Element) =>
  s.querySelector(":scope > .ed-section-head > .ed-section-title") as HTMLElement | null;
const bodyOf = (s: Element) =>
  s.querySelector(":scope > .ed-section-body") as HTMLElement | null;
const isOpen = (s: HTMLElement) => s.dataset.open !== "false";

function applyRange(r: Range) {
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}

function caretAt(node: Node, atEnd: boolean) {
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(!atEnd);
  applyRange(r);
}

function textOffset(node: Node, r: Range) {
  const pre = document.createRange();
  pre.selectNodeContents(node);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

function setTextOffset(node: Node, n: number) {
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let t: Node | null;
  while ((t = w.nextNode())) {
    const text = t as Text;
    if (n <= text.length) {
      const r = document.createRange();
      r.setStart(text, n);
      r.collapse(true);
      return applyRange(r);
    }
    n -= text.length;
  }
  caretAt(node, true);
}

const atStart = (node: Element, r: Range) =>
  textOffset(node, r) === 0 && !node.querySelector(":scope > :not(br)");

export type SectionEditorOptions = {
  maxDepth?: number;
  outline?: HTMLElement | null;
  titlePlaceholder?: string;
  onChange?: ((editor: SectionEditor) => void) | null;
};

export class SectionEditor {
  root: HTMLElement;
  opts: Required<SectionEditorOptions>;
  private _raf = 0;

  constructor(root: HTMLElement, opts?: SectionEditorOptions) {
    this.root = root;
    this.opts = {
      maxDepth: 2,
      outline: null,
      titlePlaceholder: "Section title",
      onChange: null,
      ...opts,
    };
    root.contentEditable = "true";
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* ignore */
    }
    if (!root.children.length) root.appendChild(newP());

    root.addEventListener("beforeinput", (e) => this._beforeInput(e as InputEvent));
    root.addEventListener("keydown", (e) => this._keyDown(e));
    root.addEventListener("paste", (e) => this._paste(e));
    root.addEventListener("mousedown", (e) => {
      const t = e.target as Element | null;
      if (t?.closest?.(".ed-toggle")) e.preventDefault();
    });
    root.addEventListener("click", (e) => {
      const t = e.target as Element | null;
      const b = t?.closest?.(".ed-toggle");
      if (b && root.contains(b)) {
        this.toggle(b.closest(".ed-section") as HTMLElement);
        return;
      }
      if (e.target === root) this._focusTail();
    });
    new MutationObserver(() => this._schedule()).observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    this._refresh();
  }

  insertSection() {
    this.root.focus({ preventScroll: true });
    const node = this._selNode();
    const cur = closestIn(node, ".ed-section", this.root) as HTMLElement | null;
    if (cur) return this.addSiblingSection(cur);

    let block = directChild(node, this.root) as HTMLElement | null;
    if (!block || block === this.root) {
      block = newP();
      this.root.appendChild(block);
    }
    const t = block.innerHTML.replace(/<br\s*\/?>$/i, "");
    const sec = this._make(isEmpty(block) ? "" : t);
    block.replaceWith(sec);
    this._afterStructural();
    const title = titleOf(sec);
    if (title) caretAt(title, true);
    return sec;
  }

  addSiblingSection(after: HTMLElement) {
    const sec = this._make("");
    after.after(sec);
    const title = titleOf(sec);
    if (title) caretAt(title, false);
    return sec;
  }

  toggle(sec: HTMLElement | null, open?: boolean) {
    if (!sec) return;
    const next = open === undefined ? !isOpen(sec) : !!open;
    sec.dataset.open = String(next);
    if (!next) {
      const n = this._selNode();
      const body = bodyOf(sec);
      const title = titleOf(sec);
      if (n && body?.contains(n) && title) caretAt(title, true);
    }
    this._refresh();
  }

  collapseAll() {
    this.sections().forEach((s) => this.toggle(s, false));
  }

  expandAll() {
    this.sections().forEach((s) => this.toggle(s, true));
  }

  sections() {
    return Array.from(this.root.querySelectorAll(".ed-section")) as HTMLElement[];
  }

  focusSection(sec: HTMLElement) {
    sec.scrollIntoView({ block: "center", behavior: "smooth" });
    this.root.focus({ preventScroll: true });
    const title = titleOf(sec);
    if (title) caretAt(title, true);
  }

  getHTML() {
    const out: string[] = [];
    for (const n of Array.from(this.root.children)) {
      out.push(this._ser(n as HTMLElement, 0));
    }
    return out.join("\n");
  }

  toJSON(): Array<{
    id: string | undefined;
    title: string;
    open: boolean;
    html: string;
    children: ReturnType<SectionEditor["toJSON"]>;
  }> {
    type SectionJSON = {
      id: string | undefined;
      title: string;
      open: boolean;
      html: string;
      children: SectionJSON[];
    };
    const walk = (s: HTMLElement): SectionJSON => ({
      id: s.dataset.sectionId,
      title: titleOf(s)?.textContent?.trim() ?? "",
      open: isOpen(s),
      html: Array.from(bodyOf(s)?.children ?? [])
        .filter((c) => !c.classList.contains("ed-section"))
        .map((c) => (c as HTMLElement).outerHTML)
        .join(""),
      children: Array.from(bodyOf(s)?.children ?? [])
        .filter((c) => c.classList.contains("ed-section"))
        .map((c) => walk(c as HTMLElement)),
    });
    return Array.from(this.root.children)
      .filter((c) => c.classList.contains("ed-section"))
      .map((c) => walk(c as HTMLElement));
  }

  load(html: string) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html || "";
    const build = (node: ChildNode): Node | null => {
      if (node.nodeType === 1 && (node as Element).matches("[data-section]")) {
        const eln = node as HTMLElement;
        const t = eln.querySelector(":scope > [data-section-title]");
        const b = eln.querySelector(":scope > [data-section-body]");
        const kids = b
          ? Array.from(b.childNodes).map(build).filter(Boolean)
          : [];
        const sec = this._make(
          t ? t.innerHTML : "",
          kids as Node[],
          eln.dataset.open !== "false",
        );
        if (eln.dataset.sectionId) sec.dataset.sectionId = eln.dataset.sectionId;
        return sec;
      }
      if (node.nodeType === 3) {
        return node.textContent?.trim()
          ? Object.assign(document.createElement("p"), { textContent: node.textContent })
          : null;
      }
      return node.nodeType === 1 ? (node as Element).cloneNode(true) : null;
    };
    this.root.replaceChildren(
      ...Array.from(tpl.content.childNodes).map(build).filter(Boolean) as Node[],
    );
    if (!this.root.children.length) this.root.appendChild(newP());
    this._refresh();
  }

  private _make(titleHTML: string, bodyNodes?: Node[], open?: boolean) {
    const s = el("div", "ed-section") as HTMLElement;
    s.dataset.open = String(open !== false);
    s.dataset.sectionId = uid();
    const hd = el("div", "ed-section-head");
    const btn = el("button", "ed-toggle", {
      type: "button",
      tabindex: "-1",
      "aria-label": "Toggle section",
      contenteditable: "false",
    });
    const tt = el("div", "ed-section-title", {
      role: "heading",
      "data-placeholder": this.opts.titlePlaceholder,
    });
    tt.innerHTML = titleHTML || "<br>";
    hd.append(btn, tt);
    const bd = el("div", "ed-section-body");
    if (bodyNodes && bodyNodes.length) bd.append(...bodyNodes);
    if (!bd.children.length) bd.appendChild(newP());
    s.append(hd, bd);
    return s;
  }

  private _ser(n: HTMLElement, depth: number): string {
    if (!n.classList?.contains("ed-section")) return n.outerHTML || "";
    const lvl = Math.min(depth + 2, 6);
    const title = (titleOf(n)?.innerHTML ?? "").replace(/<br\s*\/?>$/i, "");
    const body = Array.from(bodyOf(n)?.children ?? [])
      .map((c) => this._ser(c as HTMLElement, depth + 1))
      .join("\n");
    return (
      `<section data-section data-section-id="${n.dataset.sectionId}" data-open="${isOpen(n)}">` +
      `<h${lvl} data-section-title>${title}</h${lvl}>` +
      `<div data-section-body>\n${body}\n</div></section>`
    );
  }

  private _selNode() {
    const s = getSelection();
    return s && s.rangeCount ? s.getRangeAt(0).startContainer : null;
  }

  private _ctx() {
    const sel = getSelection();
    if (!sel?.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const title = closestIn(r.startContainer, ".ed-section-title", this.root) as HTMLElement | null;
    const sec = closestIn(r.startContainer, ".ed-section", this.root) as HTMLElement | null;
    return { r, title, sec };
  }

  private _beforeInput(e: InputEvent) {
    const c = this._ctx();
    if (!c || !c.sec) return;
    const { r, title, sec } = c;
    const type = e.inputType;

    if (type === "insertLineBreak" && title) {
      e.preventDefault();
      return;
    }

    if (type === "insertParagraph") {
      if (title) {
        e.preventDefault();
        this._enterBody(sec);
        return;
      }
      const body = bodyOf(sec);
      if (!body) return;
      const block = directChild(r.startContainer, body);
      if (
        block &&
        block.nodeType === 1 &&
        /^(P|DIV)$/.test((block as Element).tagName) &&
        isEmpty(block as Element) &&
        !(block as Element).nextElementSibling
      ) {
        e.preventDefault();
        this._exit(sec, block as HTMLElement);
      }
      return;
    }

    if (type === "deleteContentBackward" && r.collapsed) {
      if (title && atStart(title, r)) {
        e.preventDefault();
        this._unwrap(sec);
        return;
      }
      const body = bodyOf(sec);
      const block = !title && body ? directChild(r.startContainer, body) : null;
      if (
        block &&
        block.nodeType === 1 &&
        !(block as Element).previousElementSibling &&
        atStart(block as Element, r) &&
        !/^(UL|OL|LI)$/.test((block as Element).tagName)
      ) {
        e.preventDefault();
        if (isEmpty(block as Element) && body && body.children.length > 1) {
          (block as Element).remove();
        }
        const t = titleOf(sec);
        if (t) caretAt(t, true);
      }
    }
  }

  private _keyDown(e: KeyboardEvent) {
    const c = this._ctx();
    if (!c) return;
    const { r, title, sec } = c;

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (sec) this.addSiblingSection(sec);
      else this.insertSection();
      return;
    }
    if (e.key !== "Tab" || !sec) return;

    if (title) {
      e.preventDefault();
      const off = textOffset(title, r);
      if (e.shiftKey) {
        const parent = closestIn(sec.parentElement, ".ed-section", this.root);
        if (parent) parent.after(sec);
      } else {
        const prev = sec.previousElementSibling;
        if (
          prev &&
          prev.classList.contains("ed-section") &&
          this._depth(sec) < this.opts.maxDepth
        ) {
          (prev as HTMLElement).dataset.open = "true";
          bodyOf(prev as HTMLElement)?.appendChild(sec);
        }
      }
      this.root.focus({ preventScroll: true });
      const t = titleOf(sec);
      if (t) setTextOffset(t, off);
    } else if (e.shiftKey) {
      const body = bodyOf(sec);
      if (!body) return;
      const block = directChild(r.startContainer, body) as HTMLElement | null;
      if (!block) return;
      e.preventDefault();
      const moving: HTMLElement[] = [block];
      for (let n = block.nextElementSibling; n; n = n.nextElementSibling) {
        moving.push(n as HTMLElement);
      }
      sec.after(...moving);
      if (!body.children.length) body.appendChild(newP());
      caretAt(block, false);
    }
  }

  private _paste(e: ClipboardEvent) {
    const c = this._ctx();
    if (!c || !c.title) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData("text/plain") || "").replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, text);
  }

  private _enterBody(sec: HTMLElement) {
    sec.dataset.open = "true";
    const body = bodyOf(sec);
    if (!body) return;
    let first = body.firstElementChild;
    if (!first || first.classList.contains("ed-section")) {
      first = newP();
      body.prepend(first);
    }
    this._refresh();
    caretAt(first, false);
  }

  private _exit(sec: HTMLElement, block: HTMLElement) {
    const body = bodyOf(sec);
    block.remove();
    if (body && !body.children.length) body.appendChild(newP());
    const p = newP();
    sec.after(p);
    caretAt(p, false);
  }

  private _unwrap(sec: HTMLElement) {
    const t = titleOf(sec);
    const frag = document.createDocumentFragment();
    let focus: Node | null = null;
    if (t && !isEmpty(t)) {
      const p = document.createElement("p");
      p.innerHTML = t.innerHTML;
      frag.appendChild(p);
      focus = p;
    }
    const kids = Array.from(bodyOf(sec)?.children ?? []);
    const onlyBlank = kids.length === 1 && isEmpty(kids[0]);
    if (!onlyBlank || !focus) kids.forEach((k) => frag.appendChild(k));
    if (!frag.firstChild) frag.appendChild(newP());
    focus = focus || frag.firstChild;
    sec.replaceWith(frag);
    if (focus) caretAt(focus, false);
  }

  private _focusTail() {
    let last = this.root.lastElementChild;
    if (!last || last.classList.contains("ed-section")) {
      last = newP();
      this.root.appendChild(last);
    }
    this.root.focus({ preventScroll: true });
    caretAt(last, true);
  }

  private _afterStructural() {
    this._refresh();
  }

  private _depth(sec: HTMLElement) {
    let d = 1;
    for (let p = sec.parentElement; p && p !== this.root; p = p.parentElement) {
      if (p.classList.contains("ed-section")) d++;
    }
    return d;
  }

  private _schedule() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._refresh();
      if (this.opts.onChange) this.opts.onChange(this);
    });
  }

  private _refresh() {
    this.sections().forEach((s) => {
      if (!head(s) || !titleOf(s) || !head(s)?.querySelector(".ed-toggle")) {
        const fresh = this._make(titleOf(s) ? titleOf(s)!.innerHTML : "");
        const old = head(s);
        const freshHead = head(fresh);
        if (old && freshHead) old.replaceWith(freshHead);
        else if (freshHead) s.prepend(freshHead);
      }
      if (!bodyOf(s)) s.appendChild(el("div", "ed-section-body"));
      const bd = bodyOf(s)!;
      if (!bd.children.length) bd.appendChild(newP());
      Array.from(s.children).forEach((ch) => {
        if (ch !== head(s) && ch !== bd) bd.appendChild(ch);
      });
      const t = titleOf(s)!;
      t.classList.toggle("is-empty", isEmpty(t));
      t.setAttribute("aria-level", String(this._depth(s) + 1));
      s.dataset.depth = String(this._depth(s));
      head(s)?.querySelector(".ed-toggle")?.setAttribute("aria-expanded", String(isOpen(s)));
    });
    this._renderOutline();
  }

  private _renderOutline() {
    const box = this.opts.outline;
    if (!box) return;
    const items = this.sections();
    box.replaceChildren();
    items.forEach((s) => {
      const b = el("button", "ed-outline-item", { type: "button" }) as HTMLButtonElement;
      b.style.setProperty("--d", String(this._depth(s) - 1));
      b.textContent = titleOf(s)?.textContent?.trim() || "(untitled)";
      b.addEventListener("click", () => this.focusSection(s));
      box.appendChild(b);
    });
    box.dataset.count = String(items.length);
  }
}

/** Convert legacy rte-fold HTML into DESIGN.md storage format before load(). */
export function migrateLegacyFolds(html: string): string {
  if (!html || !html.includes("rte-fold")) return html || "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (root: ParentNode) => {
    root.querySelectorAll(".rte-fold").forEach((fold) => {
      const headEl =
        fold.querySelector(":scope > .rte-fold-head") ||
        Array.from(fold.children).find(
          (c) =>
            c instanceof HTMLElement &&
            !c.classList.contains("rte-fold-body") &&
            !c.classList.contains("rte-fold-toggle"),
        );
      const bodyEl = fold.querySelector(":scope > .rte-fold-body");
      const open = fold.getAttribute("data-collapsed") !== "true";
      const section = document.createElement("section");
      section.setAttribute("data-section", "");
      section.setAttribute("data-open", String(open));
      const title = document.createElement("h2");
      title.setAttribute("data-section-title", "");
      title.innerHTML = headEl instanceof HTMLElement ? headEl.innerHTML : "<br>";
      const body = document.createElement("div");
      body.setAttribute("data-section-body", "");
      if (bodyEl) {
        while (bodyEl.firstChild) body.appendChild(bodyEl.firstChild);
      }
      if (!body.children.length) {
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        body.appendChild(p);
      }
      section.append(title, body);
      fold.replaceWith(section);
      walk(body);
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}
