"""
On-demand PDF export for a root project, a process, or a single step.

Uses ReportLab + a Unicode TTF (DejaVu / Tahoma) and arabic-reshaper for Farsi.
Rich-text HTML (including tables from the editor) is kept as structured layout.
"""

from __future__ import annotations

import io
import re
from html import unescape
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from django.utils.html import strip_tags
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from system_explanation_services.models import Process, ProcessStep, Project

TABLE_RE = re.compile(r"<table\b[^>]*>.*?</table>", re.I | re.S)
ROW_RE = re.compile(r"<tr\b[^>]*>(.*?)</tr>", re.I | re.S)
CELL_RE = re.compile(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", re.I | re.S)
BR_RE = re.compile(r"<br\s*/?>", re.I)
BLOCK_CLOSE_RE = re.compile(r"</(p|div|h[1-6]|li|blockquote)>", re.I)
LI_OPEN_RE = re.compile(r"<li\b[^>]*>", re.I)

NAVY = colors.HexColor("#1A2B49")
GRID = colors.HexColor("#C5D3E8")
HEAD_BG = colors.HexColor("#EEF3FA")

try:
    import arabic_reshaper
    from bidi.algorithm import get_display

    def _fa(text: str) -> str:
        if not text:
            return ""
        return get_display(arabic_reshaper.reshape(str(text)))
except Exception:  # pragma: no cover - optional runtime shaping

    def _fa(text: str) -> str:
        return str(text or "")


def _cell_plain(html: str) -> str:
    if not html:
        return ""
    text = BR_RE.sub("\n", html)
    text = strip_tags(text)
    text = unescape(text).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _para_xml(text: str) -> str:
    shaped = _fa(text)
    parts = [xml_escape(part) for part in shaped.split("\n")]
    return "<br/>".join(parts) if parts else "&nbsp;"


def parse_html_table_rows(table_html: str) -> list[list[str]]:
    rows: list[list[str]] = []
    for row_html in ROW_RE.findall(table_html or ""):
        cells = [_cell_plain(cell) for cell in CELL_RE.findall(row_html)]
        if cells:
            rows.append(cells)
    if not rows:
        return []
    width = max(len(row) for row in rows)
    return [row + [""] * (width - len(row)) for row in rows]


def _html_text_chunks(html: str) -> list[str]:
    if not html:
        return []
    text = BR_RE.sub("\n", html)
    text = BLOCK_CLOSE_RE.sub("\n", text)
    text = LI_OPEN_RE.sub("• ", text)
    text = strip_tags(text)
    text = unescape(text).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    chunks = [chunk.strip() for chunk in re.split(r"\n+", text)]
    return [chunk for chunk in chunks if chunk]


def _iter_html_blocks(html: str):
    source = html or ""
    pos = 0
    for match in TABLE_RE.finditer(source):
        before = source[pos : match.start()]
        if before.strip():
            yield "text", before
        yield "table", match.group(0)
        pos = match.end()
    rest = source[pos:]
    if rest.strip():
        yield "text", rest


def _table_flowable(table_html: str, cell_style: ParagraphStyle, usable_width: float):
    rows = parse_html_table_rows(table_html)
    if not rows:
        return None
    rtl_rows = [list(reversed(row)) for row in rows]
    data = [[Paragraph(_para_xml(cell or " "), cell_style) for cell in row] for row in rtl_rows]
    cols = len(data[0])
    col_width = usable_width / cols
    table = Table(data, colWidths=[col_width] * cols, repeatRows=1, hAlign="RIGHT")
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), cell_style.fontName),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
                ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG),
                ("GRID", (0, 0), (-1, -1), 0.4, GRID),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def html_to_flowables(html: str, body, cell_style, usable_width: float) -> list:
    story = []
    for kind, chunk in _iter_html_blocks(html):
        if kind == "table":
            table = _table_flowable(chunk, cell_style, usable_width)
            if table is not None:
                story.append(Spacer(1, 0.15 * cm))
                story.append(table)
                story.append(Spacer(1, 0.2 * cm))
            continue
        for line in _html_text_chunks(chunk):
            story.append(Paragraph(_para_xml(line), body))
    return story


def _find_font() -> str | None:
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
        Path("C:/Windows/Fonts/tahoma.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
        Path(__file__).resolve().parent / "fonts" / "DejaVuSans.ttf",
    ]
    for path in candidates:
        if path.is_file():
            return str(path)
    return None


def _register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    font_path = _find_font()
    if not font_path:
        return "Helvetica", "Helvetica-Bold"
    pdfmetrics.registerFont(TTFont("AppFont", font_path))
    bold = Path(font_path).with_name(Path(font_path).name.replace("Sans", "Sans-Bold"))
    if "DejaVuSans.ttf" in font_path:
        bold = Path(font_path).with_name("DejaVuSans-Bold.ttf")
    if bold.is_file():
        pdfmetrics.registerFont(TTFont("AppFont-Bold", str(bold)))
        return "AppFont", "AppFont-Bold"
    return "AppFont", "AppFont"


def _make_styles(font_name: str, font_bold: str):
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "FaTitle",
        parent=styles["Title"],
        fontName=font_bold,
        fontSize=16,
        leading=22,
        alignment=TA_RIGHT,
    )
    h1 = ParagraphStyle(
        "FaH1",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=13,
        leading=18,
        alignment=TA_RIGHT,
        spaceBefore=12,
    )
    h2 = ParagraphStyle(
        "FaH2",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=11,
        leading=16,
        alignment=TA_RIGHT,
        spaceBefore=8,
    )
    body = ParagraphStyle(
        "FaBody",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=TA_RIGHT,
    )
    cell = ParagraphStyle(
        "FaCell",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=8.5,
        leading=12,
        alignment=TA_RIGHT,
        wordWrap="CJK",
    )
    return title, h1, h2, body, cell


def _new_doc(buffer: io.BytesIO):
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )


def _usable_width() -> float:
    return A4[0] - 4 * cm


def build_project_pdf(project: Project) -> io.BytesIO:
    root = project.get_root()
    font_name, font_bold = _register_fonts()
    title, h1, h2, body, cell = _make_styles(font_name, font_bold)
    buffer = io.BytesIO()
    doc = _new_doc(buffer)
    width = _usable_width()

    story = [Paragraph(_fa(f"تی‌ادیتور — {root.name}"), title)]
    if root.company_name:
        story.append(Paragraph(_fa(f"شرکت: {root.company_name}"), body))
    if root.description:
        story.append(Paragraph(_fa(root.description), body))
    story.append(Paragraph(_fa(f"وضعیت: {root.get_status_display()}"), body))
    story.append(Spacer(1, 0.4 * cm))

    _append_processes(story, root, h1, h2, body, cell, width)
    for sub in root.sub_projects.filter(is_deleted=False).order_by("name"):
        story.append(Paragraph(_fa(f"زیرپوشه: {sub.name}"), h1))
        if sub.description:
            story.append(Paragraph(_fa(sub.description), body))
        _append_processes(story, sub, h1, h2, body, cell, width)

    doc.build(story)
    buffer.seek(0)
    return buffer


def build_process_pdf(process: Process) -> io.BytesIO:
    font_name, font_bold = _register_fonts()
    title, _h1, h2, body, cell = _make_styles(font_name, font_bold)
    buffer = io.BytesIO()
    doc = _new_doc(buffer)
    width = _usable_width()

    story = [
        Paragraph(_fa(f"فرایند: {process.name}"), title),
        Paragraph(_fa(f"پوشه: {process.project.name}"), body),
    ]
    if process.department:
        story.append(Paragraph(_fa(f"واحد: {process.department}"), body))
    if process.process_owner_name:
        story.append(Paragraph(_fa(f"متولی فرایند: {process.process_owner_name}"), body))
    if process.description:
        story.append(Paragraph(_fa(process.description), body))
    story.append(Spacer(1, 0.3 * cm))
    _append_steps(story, process, h2, body, cell, width)

    doc.build(story)
    buffer.seek(0)
    return buffer


def build_step_pdf(step: ProcessStep) -> io.BytesIO:
    font_name, font_bold = _register_fonts()
    title, _h1, h2, body, cell = _make_styles(font_name, font_bold)
    buffer = io.BytesIO()
    doc = _new_doc(buffer)
    width = _usable_width()
    process = step.process

    story = [
        Paragraph(_fa(f"گام: {step.title}"), title),
        Paragraph(_fa(f"فرایند: {process.name}"), body),
        Paragraph(_fa(f"پوشه: {process.project.name}"), body),
        Spacer(1, 0.25 * cm),
    ]
    story.extend(html_to_flowables(step.explanation, body, cell, width))
    _append_step_items(story, step, h2, body, cell, width)

    doc.build(story)
    buffer.seek(0)
    return buffer


def _append_processes(story, project: Project, h1, h2, body, cell, width):
    processes = project.processes.filter(is_deleted=False).order_by("order", "id")
    for process in processes:
        story.append(Paragraph(_fa(f"فرایند: {process.name}"), h1))
        meta = []
        if process.department:
            meta.append(f"واحد: {process.department}")
        if process.process_owner_name:
            meta.append(f"متولی: {process.process_owner_name}")
        if meta:
            story.append(Paragraph(_fa(" | ".join(meta)), body))
        if process.description:
            story.append(Paragraph(_fa(process.description), body))
        _append_steps(story, process, h2, body, cell, width)


def _append_steps(story, process: Process, h2, body, cell, width):
    steps = (
        ProcessStep.objects.filter(process=process, is_deleted=False)
        .prefetch_related("risks", "controls")
        .order_by("order", "id")
    )
    for step in steps:
        story.append(Paragraph(_fa(f"گام: {step.title}"), h2))
        story.extend(html_to_flowables(step.explanation, body, cell, width))
        _append_step_items(story, step, h2, body, cell, width)


def _append_step_items(story, step: ProcessStep, h2, body, cell, width):
    for risk in step.risks.filter(is_deleted=False).order_by("order", "id"):
        story.append(Paragraph(_fa(f"• ریسک: {risk.title}"), body))
        story.extend(html_to_flowables(risk.content, body, cell, width))
    for control in step.controls.filter(is_deleted=False).order_by("order", "id"):
        story.append(Paragraph(_fa(f"• کنترل: {control.title}"), body))
        story.extend(html_to_flowables(control.content, body, cell, width))
