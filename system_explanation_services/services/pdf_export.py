"""
On-demand PDF export for a root project (full tree) or a single process.

Uses ReportLab + a Unicode TTF (DejaVu / Tahoma) and arabic-reshaper for Farsi.
"""

from __future__ import annotations

import io
import re
from pathlib import Path

from django.utils.html import strip_tags
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from system_explanation_services.models import Process, ProcessStep, Project

# Optional Farsi shaping — if packages missing, fall back to plain text.
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


def _html_to_text(html: str) -> str:
    if not html:
        return ""
    text = strip_tags(html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


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
    # Bold file if available next to regular DejaVu
    bold = Path(font_path).with_name(Path(font_path).name.replace("Sans", "Sans-Bold"))
    if "DejaVuSans.ttf" in font_path:
        bold = Path(font_path).with_name("DejaVuSans-Bold.ttf")
    if bold.is_file():
        pdfmetrics.registerFont(TTFont("AppFont-Bold", str(bold)))
        return "AppFont", "AppFont-Bold"
    return "AppFont", "AppFont"


def build_project_pdf(project: Project) -> io.BytesIO:
    """
    Export a root project (or resolve to root) with all sub-projects and processes.
    """
    root = project.get_root()
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm

    font_name, font_bold = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "FaTitle",
        parent=styles["Title"],
        fontName=font_bold,
        fontSize=16,
        leading=22,
        alignment=2,  # right
    )
    h1 = ParagraphStyle(
        "FaH1",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=13,
        leading=18,
        alignment=2,
        spaceBefore=12,
    )
    h2 = ParagraphStyle(
        "FaH2",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=11,
        leading=16,
        alignment=2,
        spaceBefore=8,
    )
    body = ParagraphStyle(
        "FaBody",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=2,
    )

    story = []
    story.append(Paragraph(_fa(f"تی‌ادیتور — {root.name}"), title_style))
    if root.company_name:
        story.append(Paragraph(_fa(f"شرکت: {root.company_name}"), body))
    if root.description:
        story.append(Paragraph(_fa(root.description), body))
    story.append(Paragraph(_fa(f"وضعیت: {root.get_status_display()}"), body))
    story.append(Spacer(1, 0.4 * cm))

    # Direct processes on root
    _append_processes(story, root, h1, h2, body)

    for sub in root.sub_projects.filter(is_deleted=False).order_by("name"):
        story.append(Paragraph(_fa(f"زیرپوشه: {sub.name}"), h1))
        if sub.description:
            story.append(Paragraph(_fa(sub.description), body))
        _append_processes(story, sub, h1, h2, body)

    doc.build(story)
    buffer.seek(0)
    return buffer


def build_process_pdf(process: Process) -> io.BytesIO:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm

    font_name, font_bold = _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "FaTitle",
        parent=styles["Title"],
        fontName=font_bold,
        fontSize=16,
        leading=22,
        alignment=2,
    )
    h2 = ParagraphStyle(
        "FaH2",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=11,
        leading=16,
        alignment=2,
        spaceBefore=8,
    )
    body = ParagraphStyle(
        "FaBody",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
        leading=14,
        alignment=2,
    )

    story = [
        Paragraph(_fa(f"فرایند: {process.name}"), title_style),
        Paragraph(_fa(f"پوشه: {process.project.name}"), body),
    ]
    if process.department:
        story.append(Paragraph(_fa(f"واحد: {process.department}"), body))
    if process.process_owner_name:
        story.append(Paragraph(_fa(f"متولی فرایند: {process.process_owner_name}"), body))
    if process.description:
        story.append(Paragraph(_fa(process.description), body))
    story.append(Spacer(1, 0.3 * cm))
    _append_steps(story, process, h2, body)

    doc.build(story)
    buffer.seek(0)
    return buffer


def _append_processes(story, project: Project, h1, h2, body):
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
        _append_steps(story, process, h2, body)


def _append_steps(story, process: Process, h2, body):
    steps = (
        ProcessStep.objects.filter(process=process, is_deleted=False)
        .prefetch_related("risks", "controls")
        .order_by("order", "id")
    )
    for step in steps:
        story.append(Paragraph(_fa(f"گام: {step.title}"), h2))
        explanation = _html_to_text(step.explanation)
        if explanation:
            story.append(Paragraph(_fa(f"توضیح: {explanation}"), body))
        for risk in step.risks.filter(is_deleted=False).order_by("order", "id"):
            story.append(Paragraph(_fa(f"• ریسک: {risk.title}"), body))
            content = _html_to_text(risk.content)
            if content:
                story.append(Paragraph(_fa(content), body))
        for control in step.controls.filter(is_deleted=False).order_by("order", "id"):
            story.append(Paragraph(_fa(f"• کنترل: {control.title}"), body))
            content = _html_to_text(control.content)
            if content:
                story.append(Paragraph(_fa(content), body))
