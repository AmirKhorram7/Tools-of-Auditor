"""Acceptance tests for the Section block (DESIGN.md §7).

Default: local harness that uses the same section-editor.js contract as the app.
Against the real step page (after login), set:

  SECTION_EDITOR_URL=http://localhost/explanation/steps/<id>
  SECTION_EDITOR_CHROME=/path/to/chrome   # optional

Selectors: #explanation-editor, #btn-section, window.ed / window.__sectionEditor
"""

from __future__ import annotations

import os
import pathlib
import shutil
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
HARNESS = (ROOT / "frontend" / "public" / "section-editor-demo.html").resolve().as_uri()
URL = os.environ.get("SECTION_EDITOR_URL", HARNESS)
fails: list[str] = []


def check(name: str, cond: bool, info: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  [{info}]" if (info and not cond) else ""))
    if not cond:
        fails.append(name)


def _chrome_path() -> str | None:
    env = os.environ.get("SECTION_EDITOR_CHROME")
    if env and pathlib.Path(env).exists():
        return env
    for candidate in (
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        shutil.which("chrome"),
        shutil.which("google-chrome"),
        shutil.which("chromium"),
    ):
        if candidate and pathlib.Path(candidate).exists():
            return candidate
    # Windows common paths
    for candidate in (
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ):
        if pathlib.Path(candidate).exists():
            return candidate
    return None


def _editor_api(pg) -> str:
    """JS expression that returns the SectionEditor instance (parenthesized!)."""
    return "(window.ed || window.__sectionEditor)"


with sync_playwright() as p:
    chrome = _chrome_path()
    launch_kwargs: dict = {"args": ["--no-sandbox"]}
    if chrome:
        launch_kwargs["executable_path"] = chrome
    else:
        launch_kwargs["channel"] = "chrome"
    try:
        b = p.chromium.launch(**launch_kwargs)
    except Exception:
        b = p.chromium.launch(args=["--no-sandbox"])

    pg = b.new_page(viewport={"width": 1100, "height": 800})
    errs: list[str] = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until="domcontentloaded")

    # Real app page: wait for the explanation editor to mount.
    if "explanation/steps" in URL:
        pg.wait_for_selector("#explanation-editor", timeout=60000)
        pg.wait_for_function("() => !!(window.ed || window.__sectionEditor)", timeout=60000)
        # Prefer explanation tab if tabs exist.
        tab = pg.locator("button, a", has_text="تشریح").first
        if tab.count():
            tab.click()
            pg.wait_for_timeout(200)
    else:
        pg.wait_for_function("() => !!(window.ed || window.__sectionEditor)", timeout=15000)

    ed = _editor_api(pg)
    pg.evaluate(f"{ed}.load('<p><br></p>')")

    editor_sel = "#explanation-editor, #editor"
    btn_sel = "#btn-section"

    # 1. type a line, click Section -> line becomes title
    pg.evaluate(
        f"""() => {{
          const root = document.querySelector({editor_sel!r});
          const p = root.querySelector('p') || root.firstElementChild;
          root.focus();
          const r = document.createRange();
          r.selectNodeContents(p);
          r.collapse(true);
          const s = getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }}"""
    )
    pg.keyboard.type("Alpha")
    # Prefer the same handler as the toolbar (keeps caret); Playwright focus can steal selection.
    pg.evaluate(f"{ed}.insertSection()")
    pg.wait_for_timeout(50)
    check(
        "line becomes section title",
        pg.evaluate("document.querySelector('.ed-section-title')?.textContent?.trim()")
        == "Alpha",
    )

    # 2. Enter in title -> body; Enter on empty last line -> exit
    pg.keyboard.press("Enter")
    pg.keyboard.type("one")
    pg.keyboard.press("Enter")
    pg.keyboard.type("two")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Enter")
    pg.keyboard.type("outside")
    inside = pg.evaluate("document.querySelector('.ed-section-body')?.innerText || ''")
    outside = pg.evaluate(
        """() => {
          const root = document.querySelector('#explanation-editor, #editor');
          return [...root.children]
            .filter(c => !c.classList.contains('ed-section'))
            .map(c => c.textContent.trim())
            .filter(Boolean);
        }"""
    )
    check("body has one + two only", inside.split() == ["one", "two"], inside)
    check("exit puts caret OUTSIDE section", outside == ["outside"], str(outside))

    # 3. Ctrl+Enter inside section -> sibling
    pg.evaluate(f"{ed}.focusSection({ed}.sections()[0])")
    pg.wait_for_timeout(50)
    pg.keyboard.press("Control+Enter")
    pg.keyboard.type("Beta")
    check("ctrl+enter adds sibling", pg.evaluate(f"{ed}.sections().length") == 2)

    # 4. Tab nests / Shift+Tab un-nests
    pg.keyboard.press("Tab")
    pg.wait_for_timeout(100)
    check("tab nests (depth 2)", pg.evaluate(f"{ed}.sections()[1].dataset.depth") == "2")
    pg.keyboard.press("Shift+Tab")
    pg.wait_for_timeout(100)
    check("shift+tab un-nests (depth 1)", pg.evaluate(f"{ed}.sections()[1].dataset.depth") == "1")
    check(
        "caret kept in title after move",
        pg.evaluate(
            "(n=>(n.nodeType===3?n.parentElement:n).closest('.ed-section-title')?.textContent)"
            "(getSelection().anchorNode)"
        )
        == "Beta",
    )

    # 5. collapse
    pg.evaluate(
        f"""() => {{
          const sec = {ed}.sections()[0];
          {ed}.toggle(sec, false);
          window.__secBodyDisplay = getComputedStyle(sec.querySelector('.ed-section-body')).display;
        }}"""
    )
    check("collapsed body hidden", pg.evaluate("window.__secBodyDisplay") == "none")
    pg.evaluate(f"{ed}.toggle({ed}.sections()[0], true)")

    # 6. Backspace at start of title -> unwrap
    pg.evaluate(f"{ed}.focusSection({ed}.sections()[1])")
    pg.keyboard.press("Home")
    pg.keyboard.press("Backspace")
    check("backspace unwraps section", pg.evaluate(f"{ed}.sections().length") == 1)
    check(
        "title text kept as paragraph",
        pg.evaluate(
            """() => {
              const root = document.querySelector('#explanation-editor, #editor');
              return [...root.querySelectorAll(':scope > p')].some(p => p.textContent === 'Beta');
            }"""
        ),
    )

    # 7. Backspace in first body line -> title, no merge
    pg.evaluate(f"{ed}.focusSection({ed}.sections()[0])")
    pg.keyboard.press("Enter")
    pg.keyboard.press("Home")
    pg.keyboard.press("Backspace")
    check(
        "backspace body-start returns to title",
        pg.evaluate(
            "(n=>!!(n.nodeType===3?n.parentElement:n).closest('.ed-section-title'))"
            "(getSelection().anchorNode)"
        ),
    )
    check(
        "title unchanged by backspace",
        pg.evaluate(f"{ed}.sections()[0].querySelector('.ed-section-title').textContent")
        == "Alpha",
    )

    # 8. round trip
    html = pg.evaluate(f"{ed}.getHTML()")
    pg.evaluate(f"(h) => {ed}.load(h)", html)
    check(
        "roundtrip keeps section",
        pg.evaluate(f"{ed}.sections().length") == 1 and "data-section-title" in html,
    )
    check("no editor chrome in output", "ed-toggle" not in html and "contenteditable" not in html)

    # 9. select-all + delete
    pg.click(editor_sel)
    pg.keyboard.press("Control+A")
    pg.keyboard.press("Delete")
    ok = pg.evaluate(
        "document.querySelector('#explanation-editor, #editor').children.length >= 1"
    )
    check("select-all delete leaves editor usable", ok)

    # 10. RTL sample
    pg.evaluate(
        f"""{ed}.load(`<section data-section data-open="true"><h2 data-section-title>بخش</h2>`
        + `<div data-section-body><p>متن</p></div></section><p></p>`)"""
    )
    pg.evaluate(
        "document.querySelector('#explanation-editor, #editor').dir='rtl'"
    )
    pg.evaluate(f"{ed}.toggle({ed}.sections()[0], false)")
    pg.wait_for_timeout(100)

    check("no JS errors", not errs, "; ".join(errs))
    b.close()

print("\nFAILED:" if fails else "\nALL PASSED", fails or "")
sys.exit(1 if fails else 0)
