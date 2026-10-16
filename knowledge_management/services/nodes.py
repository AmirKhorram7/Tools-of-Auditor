import io
import zipfile
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from knowledge_management.models import Attachment, InkDrawing, Link, Node, Template
from knowledge_management.services.content import (
    COURSE_TEMPLATE,
    SCHEMA_VERSION,
    document_size,
    extract,
    to_markdown,
)

MAX_DEPTH = 40
MAX_DOCUMENT_BYTES = 200_000
TRASH_DAYS = 30
DAILY_FOLDER = "Daily"
SEARCH_LIMIT = 30
TITLE_LIMIT = 20


class VersionConflict(Exception):
    def __init__(self, version: int):
        self.version = version


def _owned(user, node_id, *, alive=True) -> Node:
    manager = Node.objects if alive else Node.all_objects
    node = manager.filter(owner=user, pk=node_id).first()
    if node is None:
        raise NotFound("Page not found.")
    return node


def _require_folder(user, parent_id):
    if parent_id is None:
        return None
    parent = _owned(user, parent_id)
    if parent.type != Node.Type.FOLDER:
        raise ValidationError({"parent_id": "A page can only live inside a folder."})
    return parent


class NodeService:
    # ---- tree ----

    def tree(self, user):
        return Node.objects.filter(owner=user).order_by("path", "position", "id")

    def get(self, user, node_id) -> Node:
        return _owned(user, node_id)

    @transaction.atomic
    def create(self, user, *, parent_id=None, type, title, icon="", template_id=None) -> Node:
        parent = _require_folder(user, parent_id)
        if parent and parent.depth + 1 > MAX_DEPTH:
            raise ValidationError({"parent_id": f"A branch can be at most {MAX_DEPTH} levels deep."})
        title = (title or "").strip()
        if not title:
            raise ValidationError({"title": "A title is required."})
        content = self._template_content(user, template_id) if template_id else {"type": "doc", "content": []}
        if type == Node.Type.FOLDER:
            content = {"type": "doc", "content": []}
        text, _, _ = extract(content)
        position = Node.objects.filter(owner=user, parent=parent).count()
        node = Node.objects.create(
            owner=user,
            parent=parent,
            type=type,
            title=title[:200],
            icon=(icon or "")[:32],
            content=content,
            content_text=text,
            schema_version=SCHEMA_VERSION,
            position=position,
        )
        self._set_path(node, parent)
        if type == Node.Type.PAGE:
            self._rebuild_links(user, node)
        return node

    def _template_content(self, user, template_id):
        template = Template.objects.filter(owner=user, pk=template_id).first()
        if template is None:
            raise ValidationError({"template_id": "Template not found."})
        return template.content

    def _set_path(self, node: Node, parent: Node | None):
        prefix = parent.path if parent else ""
        node.path = f"{prefix}{node.id}/"
        node.depth = 0 if parent is None else parent.depth + 1
        node.save(update_fields=["path", "depth"])

    @transaction.atomic
    def update(self, user, node: Node, *, version=None, **fields) -> Node:
        if node.owner_id != user.id or node.is_deleted:
            raise NotFound("Page not found.")
        changing_page = node.type == Node.Type.PAGE and ("content" in fields or "title" in fields)
        if changing_page:
            if version is None:
                raise ValidationError({"version": "Send the version you last read."})
            if version != node.version:
                raise VersionConflict(node.version)
        if "title" in fields:
            title = (fields["title"] or "").strip()
            if not title:
                raise ValidationError({"title": "A title is required."})
            node.title = title[:200]
        if "icon" in fields:
            node.icon = (fields["icon"] or "")[:32]
        if "content" in fields and node.type == Node.Type.PAGE:
            content = fields["content"] if fields["content"] is not None else {"type": "doc", "content": []}
            if document_size(content) > MAX_DOCUMENT_BYTES:
                raise ValidationError({"content": "This page is larger than 200 KB."})
            node.content = content
            node.content_text, _, _ = extract(content)
            node.schema_version = SCHEMA_VERSION
        if changing_page:
            node.version += 1
        node.save()
        if node.type == Node.Type.PAGE and ("content" in fields or "title" in fields):
            self._rebuild_links(user, node)
        return node

    @transaction.atomic
    def delete(self, user, node: Node):
        if node.owner_id != user.id or node.is_deleted:
            raise NotFound("Page not found.")
        node.soft_delete()

    @transaction.atomic
    def move(self, user, node: Node, *, parent_id, position: int) -> Node:
        if node.owner_id != user.id or node.is_deleted:
            raise NotFound("Page not found.")
        parent = _require_folder(user, parent_id)
        if parent and (parent.path.startswith(node.path) or parent.id == node.id):
            raise ValidationError({"parent_id": "A page cannot be moved inside itself."})
        new_depth = 0 if parent is None else parent.depth + 1
        deepest = (
            Node.objects.filter(owner=user, path__startswith=node.path)
            .order_by("-depth")
            .values_list("depth", flat=True)
            .first()
        )
        extra = (deepest or node.depth) - node.depth
        if new_depth + extra > MAX_DEPTH:
            raise ValidationError({"parent_id": f"A branch can be at most {MAX_DEPTH} levels deep."})
        old_path = node.path
        siblings = list(
            Node.objects.filter(owner=user, parent=parent).exclude(pk=node.pk).order_by("position", "id")
        )
        position = max(0, min(int(position), len(siblings)))
        siblings.insert(position, node)
        node.parent = parent
        node.position = position
        self._set_path(node, parent)
        for index, sibling in enumerate(siblings):
            if sibling.pk != node.pk and sibling.position != index:
                Node.objects.filter(pk=sibling.pk).update(position=index)
        self._rewrite_descendants(user, old_path, node)
        return node

    def _rewrite_descendants(self, user, old_path: str, node: Node):
        if not old_path or old_path == node.path:
            return
        descendants = Node.all_objects.filter(owner=user, path__startswith=old_path).exclude(pk=node.pk)
        for desc in descendants:
            desc.path = node.path + desc.path[len(old_path) :]
            desc.depth = desc.path.count("/") - 1
            desc.save(update_fields=["path", "depth"])

    @transaction.atomic
    def duplicate(self, user, node: Node) -> Node:
        source = _owned(user, node.id)
        return self._copy(user, source, source.parent, f"{source.title} copy")

    def _copy(self, user, source: Node, parent: Node | None, title: str) -> Node:
        created = self.create(
            user,
            parent_id=parent.id if parent else None,
            type=source.type,
            title=title,
            icon=source.icon,
        )
        if source.type == Node.Type.PAGE:
            created = self.update(user, created, version=created.version, content=source.content, title=title)
        for child in Node.objects.filter(owner=user, parent=source).order_by("position", "id"):
            self._copy(user, child, created, child.title)
        return created

    @transaction.atomic
    def restore(self, user, node_id) -> Node:
        node = _owned(user, node_id, alive=False)
        if not node.is_deleted or node.deleted_at is None:
            raise ValidationError({"detail": "This page is not in the trash."})
        if node.deleted_at < timezone.now() - timedelta(days=TRASH_DAYS):
            raise ValidationError({"detail": f"Trash is kept for {TRASH_DAYS} days."})
        old_path = node.path
        parent_gone = bool(node.parent_id and Node.all_objects.filter(pk=node.parent_id, is_deleted=True).exists())
        if parent_gone:
            node.parent = None
            node.save(update_fields=["parent"])
        stamp = node.deleted_at
        Node.all_objects.filter(
            owner=user,
            path__startswith=old_path,
            is_deleted=True,
            deleted_at__gte=stamp,
        ).update(is_deleted=False, deleted_at=None)
        node.refresh_from_db()
        if parent_gone:
            node.position = Node.objects.filter(owner=user, parent__isnull=True).exclude(pk=node.pk).count()
            node.save(update_fields=["position"])
            self._set_path(node, None)
            self._rewrite_descendants(user, old_path, node)
        return node

    # ---- links ----

    def _rebuild_links(self, user, node: Node):
        _, ids, titles = extract(node.content)
        for title in titles:
            match = (
                Node.objects.filter(owner=user, type=Node.Type.PAGE, title__iexact=title)
                .order_by("id")
                .values_list("id", flat=True)
                .first()
            )
            if match:
                ids.add(match)
        ids.discard(node.id)
        allowed = set(
            Node.all_objects.filter(owner=user, pk__in=ids).values_list("id", flat=True)
        )
        Link.objects.filter(source=node).exclude(target_id__in=allowed).delete()
        existing = set(Link.objects.filter(source=node).values_list("target_id", flat=True))
        Link.objects.bulk_create(
            [
                Link(owner=user, source=node, target_id=target_id)
                for target_id in allowed
                if target_id not in existing
            ]
        )

    def backlinks(self, user, node: Node):
        return (
            Link.objects.filter(target=node, source__owner=user, source__is_deleted=False)
            .select_related("source")
            .order_by("source__title", "id")
        )

    def outgoing(self, user, node: Node):
        return Link.objects.filter(source=node, owner=user).select_related("target")

    # ---- daily note ----

    @transaction.atomic
    def daily(self, user, day: date) -> Node:
        existing = Node.objects.filter(owner=user, is_daily=True, daily_date=day).first()
        if existing:
            return existing
        folder = Node.objects.filter(owner=user, parent__isnull=True, type=Node.Type.FOLDER, title=DAILY_FOLDER).first()
        if folder is None:
            folder = self.create(user, type=Node.Type.FOLDER, title=DAILY_FOLDER)
        page = self.create(user, parent_id=folder.id, type=Node.Type.PAGE, title=day.isoformat())
        page.is_daily = True
        page.daily_date = day
        page.save(update_fields=["is_daily", "daily_date"])
        return page

    # ---- search ----

    def search(self, user, query: str, folder_id=None):
        query = (query or "").strip()
        if len(query) < 2:
            raise ValidationError({"q": "Type at least 2 characters."})
        qs = Node.objects.filter(owner=user).filter(Q(title__icontains=query) | Q(content_text__icontains=query))
        if folder_id:
            folder = _owned(user, folder_id)
            qs = qs.filter(path__startswith=folder.path)
        rows = list(qs.order_by("title", "id")[:200])
        needle = query.casefold()

        def rank(node: Node) -> tuple:
            title = node.title.casefold()
            if title == needle:
                score = 0
            elif title.startswith(needle):
                score = 1
            elif needle in title:
                score = 2
            else:
                score = 3
            return (score, title, node.id)

        rows.sort(key=rank)
        return rows[:SEARCH_LIMIT], query

    def search_titles(self, user, query: str):
        query = (query or "").strip()
        if not query:
            return Node.objects.none()
        return Node.objects.filter(owner=user, title__istartswith=query).order_by("title", "id")[:TITLE_LIMIT]

    # ---- templates ----

    def templates(self, user):
        self.ensure_course_template(user)
        return Template.objects.filter(owner=user)

    def ensure_course_template(self, user):
        Template.objects.get_or_create(
            owner=user,
            title="Course",
            defaults={"content": COURSE_TEMPLATE},
        )

    def get_template(self, user, template_id) -> Template:
        row = Template.objects.filter(owner=user, pk=template_id).first()
        if row is None:
            raise NotFound("Template not found.")
        return row

    def save_template(self, user, template: Template | None, **fields) -> Template:
        title = (fields.get("title") or (template.title if template else "")).strip()
        if not title:
            raise ValidationError({"title": "A title is required."})
        content = fields.get("content", template.content if template else {"type": "doc", "content": []})
        if document_size(content) > MAX_DOCUMENT_BYTES:
            raise ValidationError({"content": "This template is larger than 200 KB."})
        if template is None:
            return Template.objects.create(owner=user, title=title[:200], content=content)
        template.title = title[:200]
        if "content" in fields:
            template.content = content
        template.save()
        return template

    def delete_template(self, user, template: Template):
        if template.owner_id != user.id:
            raise NotFound("Template not found.")
        template.delete()

    # ---- ink ----

    def save_ink(self, user, drawing: InkDrawing | None, *, node_id, strokes, width, height) -> InkDrawing:
        from knowledge_management.services.ink import validate_strokes

        node = _owned(user, node_id)
        if node.type != Node.Type.PAGE:
            raise ValidationError({"node_id": "Ink belongs on a page."})
        strokes = validate_strokes(strokes)
        if drawing is None:
            return InkDrawing.objects.create(
                owner=user, node=node, strokes=strokes, width=width, height=height
            )
        if drawing.owner_id != user.id:
            raise NotFound("Drawing not found.")
        drawing.strokes = strokes
        drawing.width = width
        drawing.height = height
        drawing.node = node
        drawing.save()
        return drawing

    def get_ink(self, user, drawing_id) -> InkDrawing:
        row = InkDrawing.objects.filter(owner=user, pk=drawing_id).first()
        if row is None:
            raise NotFound("Drawing not found.")
        return row

    # ---- files ----

    def add_file(self, user, *, node_id, upload) -> Attachment:
        from knowledge_management.services.files import describe_upload

        node = _owned(user, node_id)
        kind, size, name = describe_upload(upload)
        return Attachment.objects.create(
            owner=user,
            node=node,
            file=upload,
            kind=kind,
            size=size,
            name=name,
        )

    # ---- export ----

    def export_page(self, user, node: Node) -> str:
        page = _owned(user, node.id)
        if page.type != Node.Type.PAGE:
            raise ValidationError({"detail": "Only a page can be exported on its own."})
        return self._markdown(user, page)

    def export_zip(self, user, node: Node) -> bytes:
        folder = _owned(user, node.id)
        if folder.type != Node.Type.FOLDER:
            raise ValidationError({"detail": "Choose a folder to export a tree."})
        pages = Node.objects.filter(owner=user, type=Node.Type.PAGE, path__startswith=folder.path)
        buffer = io.BytesIO()
        used = set()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for page in pages:
                relative = self._zip_path(page, folder)
                name = relative
                n = 2
                while name in used:
                    stem, dot, ext = relative.rpartition(".")
                    name = f"{stem} ({n}){dot}{ext}"
                    n += 1
                used.add(name)
                archive.writestr(name, self._markdown(user, page))
        return buffer.getvalue()

    def _zip_path(self, page: Node, root: Node) -> str:
        chain = []
        current = page
        while current and current.id != root.id:
            chain.append(_safe_name(current.title))
            current = current.parent if current.parent_id and not current.parent.is_deleted else None
        chain.reverse()
        if not chain:
            chain = [_safe_name(page.title)]
        chain[-1] = f"{chain[-1]}.md"
        return "/".join(chain)

    def _markdown(self, user, page: Node) -> str:
        ids = list(Link.objects.filter(source=page).values_list("target_id", flat=True))
        titles = dict(Node.all_objects.filter(owner=user, pk__in=ids).values_list("id", "title"))
        body = to_markdown(page.content, titles)
        drawings = InkDrawing.objects.filter(owner=user, node=page)
        if drawings:
            lines = ["", "## Ink", ""]
            for drawing in drawings:
                lines.append(f"![ink](ink-{drawing.id}.svg)")
            body = body.rstrip() + "\n" + "\n".join(lines) + "\n"
        return f"# {page.title}\n\n{body}"


def _safe_name(title: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in " -_" else "-" for ch in title).strip()
    return cleaned[:80] or "page"


def snippet(text: str, query: str, size: int = 140) -> str:
    if not text:
        return ""
    hay = text.casefold()
    at = hay.find(query.casefold())
    if at < 0:
        return text[:size]
    start = max(0, at - 40)
    end = min(len(text), at + size - 40)
    prefix = "…" if start else ""
    suffix = "…" if end < len(text) else ""
    return prefix + text[start:end].strip() + suffix
