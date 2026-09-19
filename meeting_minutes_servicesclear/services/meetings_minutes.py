from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from meeting_minutes_servicesclear.jalali import jalali_year
from meeting_minutes_servicesclear.models import (
    Company,
    Group,
    GroupMember,
    Meeting,
    MeetingItem,
    MeetingItemComment,
)

MANAGE_ROLES = {GroupMember.Role.OWNER, GroupMember.Role.MAINTAINER}
OPEN_ITEM_STATUSES = {
    MeetingItem.Status.CREATED,
    MeetingItem.Status.IN_PROGRESS,
    MeetingItem.Status.TEST,
}


class MeetingService:
    def _active_member(self, user, group: Group) -> GroupMember | None:
        return GroupMember.objects.filter(
            group=group,
            user=user,
            status=GroupMember.Status.ACTIVE,
            deleted_at__isnull=True,
        ).first()

    def can_clerk_group(self, user, group: Group) -> bool:
        if group.company.owner_id == user.id:
            return True
        member = self._active_member(user, group)
        return bool(member and member.role in MANAGE_ROLES)

    def can_view(self, user, meeting: Meeting) -> bool:
        if meeting.deleted_at:
            return False
        if meeting.group.company.owner_id == user.id:
            return True
        return self._active_member(user, meeting.group) is not None

    def can_clerk(self, user, meeting: Meeting) -> bool:
        return self.can_clerk_group(user, meeting.group)

    def is_assignee(self, user, item: MeetingItem) -> bool:
        return item.assignees.filter(
            user=user,
            status=GroupMember.Status.ACTIVE,
            deleted_at__isnull=True,
        ).exists()

    def _require_view(self, user, meeting: Meeting) -> Meeting:
        if not self.can_view(user, meeting):
            raise PermissionDenied("You do not have access to this meeting.")
        return meeting

    def _require_clerk(self, user, meeting: Meeting) -> Meeting:
        self._require_view(user, meeting)
        if not self.can_clerk(user, meeting):
            raise PermissionDenied("Only an owner or maintainer can do this.")
        return meeting

    def meetings_for_user(self, user, group: Group | None = None, year: int | None = None):
        owned_company_ids = Company.objects.filter(
            owner=user, deleted_at__isnull=True
        ).values("id")
        qs = (
            Meeting.objects.filter(deleted_at__isnull=True)
            .filter(
                Q(group__company_id__in=owned_company_ids)
                | Q(
                    group__members__user=user,
                    group__members__status=GroupMember.Status.ACTIVE,
                    group__members__deleted_at__isnull=True,
                )
            )
            .select_related("group", "group__company", "created_by", "created_by__profile")
            .distinct()
            .order_by("-year", "-meeting_number", "-date")
        )
        if group:
            qs = qs.filter(group=group)
        if year:
            qs = qs.filter(year=year)
        return qs

    def get_meeting(self, user, meeting_id: int) -> Meeting:
        meeting = (
            Meeting.objects.filter(pk=meeting_id, deleted_at__isnull=True)
            .select_related("group", "group__company", "created_by", "created_by__profile")
            .first()
        )
        if meeting is None:
            raise ValidationError({"meeting": "Meeting not found."})
        return self._require_view(user, meeting)

    def _next_number(self, group: Group, year: int) -> int:
        current = (
            Meeting.objects.filter(group=group, year=year, deleted_at__isnull=True)
            .aggregate(n=Max("meeting_number"))
            .get("n")
        )
        return (current or 0) + 1

    def _save_meeting(self, meeting: Meeting) -> Meeting:
        try:
            with transaction.atomic():
                meeting.full_clean()
                meeting.save()
        except DjangoValidationError as exc:
            payload = getattr(exc, "message_dict", None) or {
                "detail": getattr(exc, "messages", [str(exc)])
            }
            raise ValidationError(payload) from exc
        except IntegrityError as exc:
            raise ValidationError({"group": "Could not save the meeting. Try again."}) from exc
        return meeting

    def create_meeting(
        self,
        *,
        user,
        group: Group,
        name: str = "",
        meeting_date=None,
        description: str = "",
    ) -> Meeting:
        if group.deleted_at:
            raise ValidationError({"group": "Group is deleted."})
        if not self.can_clerk_group(user, group):
            raise PermissionDenied("Only an owner or maintainer can do this.")

        meeting_date = meeting_date or date.today()
        year = jalali_year(meeting_date)
        for attempt in range(3):
            meeting = Meeting(
                group=group,
                name=(name or "").strip() or group.name,
                date=meeting_date,
                year=year,
                description=(description or "").strip(),
                meeting_number=self._next_number(group, year),
                status=Meeting.Status.OPEN,
                created_by=user,
            )
            try:
                with transaction.atomic():
                    meeting.full_clean()
                    meeting.save()
                return meeting
            except DjangoValidationError as exc:
                payload = getattr(exc, "message_dict", None) or {
                    "detail": getattr(exc, "messages", [str(exc)])
                }
                raise ValidationError(payload) from exc
            except IntegrityError:
                if attempt == 2:
                    raise ValidationError({"group": "Could not create the meeting. Try again."})
        raise ValidationError({"group": "Could not create the meeting. Try again."})

    def update_meeting(self, *, user, meeting: Meeting, **fields) -> Meeting:
        self._require_clerk(user, meeting)
        old_group_id = meeting.group_id
        old_year = meeting.year
        if "name" in fields:
            meeting.name = (fields["name"] or "").strip() or meeting.name
        if "date" in fields and fields["date"]:
            meeting.date = fields["date"]
            meeting.year = jalali_year(fields["date"])
        if "description" in fields:
            meeting.description = (fields["description"] or "").strip()
        if "group" in fields and fields["group"] and fields["group"].id != meeting.group_id:
            new_group = fields["group"]
            if not self.can_clerk_group(user, new_group):
                raise PermissionDenied("You cannot move minutes to that group.")
            if new_group.company_id != meeting.group.company_id:
                raise ValidationError({"group": "Group must belong to the same company."})
            meeting.group = new_group
        if meeting.group_id != old_group_id or meeting.year != old_year:
            meeting.meeting_number = self._next_number(meeting.group, meeting.year)
        meeting.updated_by = user
        return self._save_meeting(meeting)

    def close_meeting(self, *, user, meeting: Meeting) -> Meeting:
        self._require_clerk(user, meeting)
        if meeting.status != Meeting.Status.CLOSED:
            meeting.status = Meeting.Status.CLOSED
            meeting.closed_at = timezone.now()
            meeting.updated_by = user
            meeting.save(update_fields=["status", "closed_at", "updated_by", "updated_at"])
        return meeting

    def delete_meeting(self, *, user, meeting: Meeting) -> Meeting:
        self._require_clerk(user, meeting)
        meeting.deleted_at = timezone.now()
        meeting.deleted_by = user
        meeting.status = Meeting.Status.ARCHIVED
        meeting.save(update_fields=["deleted_at", "deleted_by", "status", "updated_at"])
        return meeting

    def items_for_meeting(self, user, meeting: Meeting):
        self._require_view(user, meeting)
        return (
            meeting.items.filter(deleted_at__isnull=True)
            .prefetch_related("assignees__user__profile")
            .annotate(
                comment_count=Count(
                    "comments",
                    filter=Q(comments__deleted_at__isnull=True),
                )
            )
            .order_by("order", "id")
        )

    def _set_assignees(self, item: MeetingItem, meeting: Meeting, assignee_ids):
        ids = list(assignee_ids or [])
        if not ids:
            item.assignees.clear()
            return
        members = list(
            GroupMember.objects.filter(
                pk__in=ids,
                group=meeting.group,
                status=GroupMember.Status.ACTIVE,
                deleted_at__isnull=True,
            )
        )
        if len(members) != len(set(ids)):
            raise ValidationError(
                {"assignee_ids": "Assignees must be active members of this group."}
            )
        item.assignees.set(members)

    @transaction.atomic
    def create_item(
        self,
        *,
        user,
        meeting: Meeting,
        title: str,
        description: str = "",
        priority: int = 2,
        due_date=None,
        assignee_ids=None,
    ) -> MeetingItem:
        self._require_clerk(user, meeting)
        if meeting.status != Meeting.Status.OPEN:
            raise ValidationError({"meeting": "Meeting is not open."})
        clean_title = (title or "").strip()
        if not clean_title:
            raise ValidationError({"title": "Title is required."})
        if priority not in MeetingItem.Priority.values:
            raise ValidationError({"priority": "Invalid priority."})

        last = meeting.items.filter(deleted_at__isnull=True).aggregate(n=Max("order")).get("n") or 0
        item = MeetingItem(
            meeting=meeting,
            title=clean_title,
            description=(description or "").strip(),
            priority=priority,
            due_date=due_date,
            status=MeetingItem.Status.CREATED,
            order=last + 1,
            created_by=user,
        )
        item.full_clean()
        item.save()
        self._set_assignees(item, meeting, assignee_ids)
        return item

    def update_item(self, *, user, item: MeetingItem, **fields) -> MeetingItem:
        meeting = item.meeting
        self._require_view(user, meeting)
        clerk = self.can_clerk(user, meeting)
        assignee = self.is_assignee(user, item)
        if not clerk and not assignee:
            raise PermissionDenied("You cannot edit this line.")
        if not clerk:
            extra = set(fields) - {"status"}
            if extra:
                raise PermissionDenied("Assignees can only change status.")
        if "title" in fields:
            clean_title = (fields["title"] or "").strip()
            if not clean_title:
                raise ValidationError({"title": "Subject is required."})
            item.title = clean_title
        if "description" in fields:
            item.description = (fields["description"] or "").strip()
        if "priority" in fields:
            if fields["priority"] not in MeetingItem.Priority.values:
                raise ValidationError({"priority": "Invalid priority."})
            item.priority = fields["priority"]
        if "due_date" in fields:
            item.due_date = fields["due_date"]
        if "assignee_ids" in fields:
            self._set_assignees(item, meeting, fields["assignee_ids"])
        if "status" in fields:
            new_status = fields["status"]
            if new_status not in MeetingItem.Status.values:
                raise ValidationError({"status": "Invalid status."})
            if new_status == MeetingItem.Status.CANCELLED and not clerk:
                raise PermissionDenied("Only a clerk can cancel a line.")
            item.status = new_status
            if new_status == MeetingItem.Status.COMPLETED:
                item.completed_at = timezone.now()
                item.completed_by = user
            else:
                item.completed_at = None
                item.completed_by = None
        item.updated_by = user
        item.save()
        return item

    def can_comment(self, user, item: MeetingItem) -> bool:
        return self.can_clerk(user, item.meeting) or self.is_assignee(user, item)

    def comments_for_item(self, user, item: MeetingItem):
        self._require_view(user, item.meeting)
        return (
            item.comments.filter(deleted_at__isnull=True)
            .select_related("created_by", "created_by__profile")
            .order_by("created_at", "id")
        )

    def add_comment(self, *, user, item: MeetingItem, body: str) -> MeetingItemComment:
        self._require_view(user, item.meeting)
        if not self.can_comment(user, item):
            raise PermissionDenied("Only the assignee or a clerk can comment on this line.")
        text = (body or "").strip()
        if not text:
            raise ValidationError({"body": "Comment cannot be empty."})
        comment = MeetingItemComment(item=item, body=text, created_by=user)
        comment.full_clean()
        comment.save()
        return comment

    def delete_item(self, *, user, item: MeetingItem) -> MeetingItem:
        self._require_clerk(user, item.meeting)
        item.deleted_at = timezone.now()
        item.deleted_by = user
        item.status = MeetingItem.Status.CANCELLED
        item.save(update_fields=["deleted_at", "deleted_by", "status", "updated_at"])
        return item

    @transaction.atomic
    def carry_over(self, *, user, meeting: Meeting, target: Meeting | None = None) -> Meeting:
        self._require_clerk(user, meeting)
        if target is None:
            target = self.create_meeting(
                user=user,
                group=meeting.group,
                name=meeting.name,
                meeting_date=date.today(),
            )
        else:
            self._require_clerk(user, target)
            if target.status != Meeting.Status.OPEN:
                raise ValidationError({"target_meeting": "Target minutes must be open."})
            if target.group.company_id != meeting.group.company_id:
                raise ValidationError({"target_meeting": "Target must be in the same company."})

        open_items = meeting.items.filter(
            deleted_at__isnull=True,
            status__in=OPEN_ITEM_STATUSES,
        ).prefetch_related("assignees")
        last = target.items.filter(deleted_at__isnull=True).aggregate(n=Max("order")).get("n") or 0
        for source in open_items:
            last += 1
            clone = MeetingItem.objects.create(
                meeting=target,
                title=source.title,
                description=source.description,
                priority=source.priority,
                due_date=source.due_date,
                status=MeetingItem.Status.CREATED,
                order=last,
                cloned_from=source,
                created_by=user,
            )
            clone.assignees.set(source.assignees.all())
        return target
