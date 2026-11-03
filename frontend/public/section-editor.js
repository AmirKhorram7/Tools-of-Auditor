/*!
 * SectionEditor — "Section" block for a contenteditable editor.
 * Framework-agnostic, no dependencies, RTL-safe.
 *
 * DOM model (inside the contenteditable root):
 *
 *   .ed-section[data-open][data-section-id]
 *     .ed-section-head
 *       button.ed-toggle            (contenteditable=false)
 *       .ed-section-title           (single line)
 *     .ed-section-body              (paragraphs, lists, ... and nested .ed-section, max depth 2)
 *
 * Keyboard contract
 *   Enter   in title            -> jump into body (opens it if collapsed)
 *   Enter   on empty last line  -> EXIT section (new paragraph after it)   <-- fixes "can't leave section"
 *   Ctrl+Enter anywhere         -> new sibling section after current
 *   Backspace at start of title -> unwrap section (title becomes a paragraph)
 *   Backspace at start of body  -> caret back to title (no merge)
 *   Tab / Shift+Tab in title    -> nest into previous section / un-nest
 *   Shift+Tab in body           -> end the section at this line (block + following blocks move out)
 */
(function (global) {
  'use strict';

  const BLOCK_MEDIA = 'img,table,hr,iframe,video,pre';
  const uid = () =>
    global.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

  function el(tag, cls, attrs) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  const newP = () => {
    const p = document.createElement('p');
    p.appendChild(document.createElement('br'));
    return p;
  };
  const isEmpty = (n) => n.textContent.trim() === '' && !n.querySelector(BLOCK_MEDIA);
  const asEl = (n) => (n && n.nodeType === 3 ? n.parentElement : n);
  const closestIn = (n, sel, root) => {
    const c = asEl(n) && asEl(n).closest(sel);
    return c && root.contains(c) ? c : null;
  };
  const directChild = (node, container) => {
    while (node && node.parentNode !== container) node = node.parentNode;
    return node || null;
  };
  const head = (s) => s.querySelector(':scope > .ed-section-head');
  const titleOf = (s) => s.querySelector(':scope > .ed-section-head > .ed-section-title');
  const bodyOf = (s) => s.querySelector(':scope > .ed-section-body');
  const isOpen = (s) => s.dataset.open !== 'false';

  function applyRange(r) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function caretAt(node, atEnd) {
    const r = document.createRange();
    r.selectNodeContents(node);
    r.collapse(!atEnd);
    applyRange(r);
  }
  function textOffset(node, r) {
    const pre = document.createRange();
    pre.selectNodeContents(node);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }
  function setTextOffset(node, n) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) {
      if (n <= t.length) {
        const r = document.createRange();
        r.setStart(t, n);
        r.collapse(true);
        return applyRange(r);
      }
      n -= t.length;
    }
    caretAt(node, true);
  }
  const atStart = (node, r) => textOffset(node, r) === 0 && !node.querySelector(':scope > :not(br)');

  class SectionEditor {
    /**
     * @param {HTMLElement} root  element that becomes contenteditable
     * @param {object} [opts]
     *   maxDepth   (default 2)  nesting limit
     *   outline    (HTMLElement) optional <ul>/<div> rendered as section outline
     *   titlePlaceholder (string)
     *   onChange   (editor) => void   debounced to one call per frame
     */
    constructor(root, opts) {
      this.root = root;
      this.opts = Object.assign({ maxDepth: 2, outline: null, titlePlaceholder: 'Section title', onChange: null }, opts);
      root.contentEditable = 'true';
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
      if (!root.children.length) root.appendChild(newP());

      root.addEventListener('beforeinput', (e) => this._beforeInput(e));
      root.addEventListener('keydown', (e) => this._keyDown(e));
      root.addEventListener('paste', (e) => this._paste(e));
      root.addEventListener('mousedown', (e) => {
        if (e.target.closest && e.target.closest('.ed-toggle')) e.preventDefault(); // keep caret
      });
      root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.ed-toggle');
        if (b && root.contains(b)) return this.toggle(b.closest('.ed-section'));
        if (e.target === root) this._focusTail(); // click in empty area below last section
      });
      this._raf = 0;
      new MutationObserver(() => this._schedule()).observe(root, { childList: true, subtree: true, characterData: true });
      this._refresh();
    }

    /* ---------------------------------------------------------------- public API */

    /** Toolbar action. Outside a section: current top-level block becomes the section title.
     *  Inside a section: add a sibling section after the current one. */
    insertSection() {
      this.root.focus({ preventScroll: true });
      const node = this._selNode();
      const cur = closestIn(node, '.ed-section', this.root);
      if (cur) return this.addSiblingSection(cur);

      let block = directChild(node, this.root);
      if (!block || block === this.root) {
        block = newP();
        this.root.appendChild(block);
      }
      const t = block.innerHTML.replace(/<br\s*\/?>$/i, '');
      const sec = this._make(isEmpty(block) ? '' : t);
      block.replaceWith(sec);
      this._afterStructural(sec);
      caretAt(titleOf(sec), true);
      return sec;
    }

    addSiblingSection(after) {
      const sec = this._make('');
      after.after(sec);
      caretAt(titleOf(sec), false);
      return sec;
    }

    toggle(sec, open) {
      if (!sec) return;
      const next = open === undefined ? !isOpen(sec) : !!open;
      sec.dataset.open = String(next);
      if (!next) {
        const n = this._selNode();
        if (n && bodyOf(sec).contains(n)) caretAt(titleOf(sec), true);
      }
      this._refresh();
    }
    collapseAll() { this.sections().forEach((s) => this.toggle(s, false)); }
    expandAll() { this.sections().forEach((s) => this.toggle(s, true)); }
    sections() { return Array.from(this.root.querySelectorAll('.ed-section')); }

    focusSection(sec) {
      sec.scrollIntoView({ block: 'center', behavior: 'smooth' });
      this.root.focus({ preventScroll: true });
      caretAt(titleOf(sec), true);
    }

    /** Clean, storage-friendly HTML (no editor chrome). */
    getHTML() {
      const out = [];
      for (const n of this.root.children) out.push(this._ser(n, 0));
      return out.join('\n');
    }

    /** Tree: [{id,title,open,html,children:[...]}] for the section blocks only (top-level orphans skipped). */
    toJSON() {
      const walk = (s) => ({
        id: s.dataset.sectionId,
        title: titleOf(s).textContent.trim(),
        open: isOpen(s),
        html: Array.from(bodyOf(s).children).filter((c) => !c.classList.contains('ed-section')).map((c) => c.outerHTML).join(''),
        children: Array.from(bodyOf(s).children).filter((c) => c.classList.contains('ed-section')).map(walk),
      });
      return Array.from(this.root.children).filter((c) => c.classList.contains('ed-section')).map(walk);
    }

    /** Load HTML produced by getHTML() (or any HTML; unknown nodes are kept as plain blocks). */
    load(html) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      const build = (node) => {
        if (node.nodeType === 1 && node.matches('[data-section]')) {
          const t = node.querySelector(':scope > [data-section-title]');
          const b = node.querySelector(':scope > [data-section-body]');
          const kids = b ? Array.from(b.childNodes).map(build).filter(Boolean) : [];
          const sec = this._make(t ? t.innerHTML : '', kids, node.dataset.open !== 'false');
          if (node.dataset.sectionId) sec.dataset.sectionId = node.dataset.sectionId;
          return sec;
        }
        if (node.nodeType === 3) return node.textContent.trim() ? Object.assign(document.createElement('p'), { textContent: node.textContent }) : null;
        return node.nodeType === 1 ? node.cloneNode(true) : null;
      };
      this.root.replaceChildren(...Array.from(tpl.content.childNodes).map(build).filter(Boolean));
      if (!this.root.children.length) this.root.appendChild(newP());
      this._refresh();
    }

    /* ---------------------------------------------------------------- DOM building */

    _make(titleHTML, bodyNodes, open) {
      const s = el('div', 'ed-section');
      s.dataset.open = String(open !== false);
      s.dataset.sectionId = uid();
      const hd = el('div', 'ed-section-head');
      const btn = el('button', 'ed-toggle', { type: 'button', tabindex: '-1', 'aria-label': 'Toggle section', contenteditable: 'false' });
      const tt = el('div', 'ed-section-title', { role: 'heading', 'data-placeholder': this.opts.titlePlaceholder });
      tt.innerHTML = titleHTML || '<br>'; // <br> gives an empty block a reliable caret in Chrome/Safari
      hd.append(btn, tt);
      const bd = el('div', 'ed-section-body');
      if (bodyNodes && bodyNodes.length) bd.append(...bodyNodes);
      if (!bd.children.length) bd.appendChild(newP());
      s.append(hd, bd);
      return s;
    }

    _ser(n, depth) {
      if (!n.classList || !n.classList.contains('ed-section')) return n.outerHTML || '';
      const lvl = Math.min(depth + 2, 6);
      const title = titleOf(n).innerHTML.replace(/<br\s*\/?>$/i, '');
      const body = Array.from(bodyOf(n).children).map((c) => this._ser(c, depth + 1)).join('\n');
      return (
        `<section data-section data-section-id="${n.dataset.sectionId}" data-open="${isOpen(n)}">` +
        `<h${lvl} data-section-title>${title}</h${lvl}>` +
        `<div data-section-body>\n${body}\n</div></section>`
      );
    }

    /* ---------------------------------------------------------------- input handling */

    _selNode() {
      const s = getSelection();
      return s && s.rangeCount ? s.getRangeAt(0).startContainer : null;
    }

    _ctx() {
      const sel = getSelection();
      if (!sel.rangeCount) return null;
      const r = sel.getRangeAt(0);
      const title = closestIn(r.startContainer, '.ed-section-title', this.root);
      const sec = closestIn(r.startContainer, '.ed-section', this.root);
      return { r, title, sec };
    }

    _beforeInput(e) {
      const c = this._ctx();
      if (!c || !c.sec) return;
      const { r, title, sec } = c;
      const type = e.inputType;

      if (type === 'insertLineBreak' && title) return e.preventDefault(); // title is single line

      if (type === 'insertParagraph') {
        if (title) {
          e.preventDefault();
          return this._enterBody(sec);
        }
        const body = bodyOf(sec);
        const block = directChild(r.startContainer, body);
        if (block && block.nodeType === 1 && /^(P|DIV)$/.test(block.tagName) && isEmpty(block) && !block.nextElementSibling) {
          e.preventDefault();
          return this._exit(sec, block);
        }
        return;
      }

      if (type === 'deleteContentBackward' && r.collapsed) {
        if (title && atStart(title, r)) {
          e.preventDefault();
          return this._unwrap(sec);
        }
        const body = bodyOf(sec);
        const block = !title && directChild(r.startContainer, body);
        if (block && block.nodeType === 1 && !block.previousElementSibling && atStart(block, r) && !/^(UL|OL|LI)$/.test(block.tagName)) {
          e.preventDefault();
          if (isEmpty(block) && body.children.length > 1) block.remove();
          caretAt(titleOf(sec), true);
        }
      }
    }

    _keyDown(e) {
      const c = this._ctx();
      if (!c) return;
      const { r, title, sec } = c;

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        return sec ? void this.addSiblingSection(sec) : void this.insertSection();
      }
      if (e.key !== 'Tab' || !sec) return;

      if (title) {
        e.preventDefault();
        const off = textOffset(title, r);
        if (e.shiftKey) {
          const parent = closestIn(sec.parentElement, '.ed-section', this.root);
          if (parent) parent.after(sec);
        } else {
          const prev = sec.previousElementSibling;
          if (prev && prev.classList.contains('ed-section') && this._depth(sec) < this.opts.maxDepth) {
            prev.dataset.open = 'true';
            bodyOf(prev).appendChild(sec);
          }
        }
        this.root.focus({ preventScroll: true });
        setTextOffset(titleOf(sec), off);
      } else if (e.shiftKey) {
        const body = bodyOf(sec);
        const block = directChild(r.startContainer, body);
        if (!block) return;
        e.preventDefault();
        const moving = [block];
        for (let n = block.nextElementSibling; n; n = n.nextElementSibling) moving.push(n);
        sec.after(...moving);
        if (!body.children.length) body.appendChild(newP());
        caretAt(block, false);
      }
    }

    _paste(e) {
      const c = this._ctx();
      if (!c || !c.title) return;
      e.preventDefault();
      const text = (e.clipboardData.getData('text/plain') || '').replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, text);
    }

    /* ---------------------------------------------------------------- structural ops */

    _enterBody(sec) {
      sec.dataset.open = 'true';
      const body = bodyOf(sec);
      let first = body.firstElementChild;
      if (!first || first.classList.contains('ed-section')) {
        first = newP();
        body.prepend(first);
      }
      this._refresh();
      caretAt(first, false);
    }

    _exit(sec, block) {
      const body = bodyOf(sec);
      block.remove();
      if (!body.children.length) body.appendChild(newP());
      const p = newP();
      sec.after(p);
      caretAt(p, false);
    }

    _unwrap(sec) {
      const t = titleOf(sec);
      const frag = document.createDocumentFragment();
      let focus = null;
      if (!isEmpty(t)) {
        const p = document.createElement('p');
        p.innerHTML = t.innerHTML;
        frag.appendChild(p);
        focus = p;
      }
      const kids = Array.from(bodyOf(sec).children);
      const onlyBlank = kids.length === 1 && isEmpty(kids[0]);
      if (!onlyBlank || !focus) kids.forEach((k) => frag.appendChild(k));
      if (!frag.firstChild) frag.appendChild(newP());
      focus = focus || frag.firstChild;
      sec.replaceWith(frag);
      caretAt(focus, false);
    }

    _focusTail() {
      let last = this.root.lastElementChild;
      if (!last || last.classList.contains('ed-section')) {
        last = newP();
        this.root.appendChild(last);
      }
      this.root.focus({ preventScroll: true });
      caretAt(last, true);
    }

    _afterStructural() { this._refresh(); }

    /* ---------------------------------------------------------------- housekeeping */

    _depth(sec) {
      let d = 1;
      for (let p = sec.parentElement; p && p !== this.root; p = p.parentElement) if (p.classList.contains('ed-section')) d++;
      return d;
    }

    _schedule() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._refresh();
        if (this.opts.onChange) this.opts.onChange(this);
      });
    }

    /** Repair structure damaged by select-all+delete / odd pastes, then refresh derived UI. */
    _refresh() {
      this.sections().forEach((s) => {
        if (!head(s) || !titleOf(s) || !head(s).querySelector('.ed-toggle')) {
          const fresh = this._make(titleOf(s) ? titleOf(s).innerHTML : '');
          const old = head(s);
          if (old) old.replaceWith(head(fresh));
          else s.prepend(head(fresh));
        }
        if (!bodyOf(s)) s.appendChild(el('div', 'ed-section-body'));
        const bd = bodyOf(s);
        if (!bd.children.length) bd.appendChild(newP());
        // stray children that are neither head nor body -> move into body
        Array.from(s.children).forEach((ch) => {
          if (ch !== head(s) && ch !== bd) bd.appendChild(ch);
        });
        const t = titleOf(s);
        t.classList.toggle('is-empty', isEmpty(t));
        t.setAttribute('aria-level', String(this._depth(s) + 1));
        s.dataset.depth = String(this._depth(s));
        head(s).querySelector('.ed-toggle').setAttribute('aria-expanded', String(isOpen(s)));
      });
      this._renderOutline();
    }

    _renderOutline() {
      const box = this.opts.outline;
      if (!box) return;
      const items = this.sections();
      box.replaceChildren();
      items.forEach((s, i) => {
        const b = el('button', 'ed-outline-item', { type: 'button' });
        b.style.setProperty('--d', String(this._depth(s) - 1));
        b.textContent = titleOf(s).textContent.trim() || '(untitled)';
        b.addEventListener('click', () => this.focusSection(s));
        box.appendChild(b);
      });
      box.dataset.count = String(items.length);
    }
  }

  global.SectionEditor = SectionEditor;
})(window);
