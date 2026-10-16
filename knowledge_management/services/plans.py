from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from knowledge_management.models import Node, PlanDay, Review, StudyPlan
from knowledge_management.services.nodes import NodeService

node_service = NodeService()

DEFAULT_DAYS = 30
MAX_DAYS = 366
REVIEW_STEPS = (1, 3, 7)
MAX_SHIFT = 60


class PlanService:
    def list(self, user):
        return StudyPlan.objects.filter(owner=user).prefetch_related("days_rows")

    def get(self, user, plan_id) -> StudyPlan:
        plan = StudyPlan.objects.filter(owner=user, pk=plan_id).first()
        if plan is None:
            raise NotFound("Plan not found.")
        return plan

    @transaction.atomic
    def create(self, user, *, title, start_date: date, days=DEFAULT_DAYS) -> StudyPlan:
        title = (title or "").strip()
        if not title:
            raise ValidationError({"title": "A title is required."})
        days = days or DEFAULT_DAYS
        if days < 1 or days > MAX_DAYS:
            raise ValidationError({"days": f"A plan is 1 to {MAX_DAYS} days."})
        plan = StudyPlan.objects.create(owner=user, title=title[:200], start_date=start_date, days=days)
        PlanDay.objects.bulk_create(
            [
                PlanDay(
                    plan=plan,
                    day_number=number,
                    date=start_date + timedelta(days=number - 1),
                    status=PlanDay.Status.TODO,
                )
                for number in range(1, days + 1)
            ]
        )
        return plan

    def get_day(self, user, day_id) -> PlanDay:
        row = PlanDay.objects.filter(plan__owner=user, pk=day_id).select_related("plan", "node").first()
        if row is None:
            raise NotFound("Plan day not found.")
        return row

    @transaction.atomic
    def update_day(self, user, row: PlanDay, *, node_id=None, status=None, set_node=False) -> PlanDay:
        if set_node:
            if node_id is None:
                row.node = None
            else:
                node = node_service.get(user, node_id)
                if node.type != Node.Type.FOLDER:
                    raise ValidationError({"node_id": "Assign a course folder, not a page."})
                row.node = node
        was_done = row.status == PlanDay.Status.DONE
        if status is not None:
            if status not in PlanDay.Status.values:
                raise ValidationError({"status": "Use todo, doing, or done."})
            row.status = status
        row.save()
        if row.status == PlanDay.Status.DONE and not was_done and row.node_id:
            self._schedule(user, row)
        return row

    def _schedule(self, user, row: PlanDay):
        Review.objects.bulk_create(
            [
                Review(
                    owner=user,
                    node_id=row.node_id,
                    plan_day=row,
                    due_date=row.date + timedelta(days=step),
                    step=step,
                )
                for step in REVIEW_STEPS
            ],
            ignore_conflicts=True,
        )

    def shift(self, user, plan: StudyPlan, by_days: int) -> StudyPlan:
        if by_days == 0 or abs(by_days) > MAX_SHIFT:
            raise ValidationError({"days": f"Shift by 1 to {MAX_SHIFT} days."})
        today = timezone.localdate()
        pending = list(plan.days_rows.filter(date__gte=today).exclude(status=PlanDay.Status.DONE))
        if not pending:
            return plan
        delta = timedelta(days=by_days)
        for row in pending:
            row.date = row.date + delta
            row.save(update_fields=["date"])
            for review in row.reviews.filter(done_at__isnull=True):
                review.due_date = row.date + timedelta(days=review.step)
                review.save(update_fields=["due_date"])
        return plan

    def progress(self, plan: StudyPlan) -> dict:
        rows = list(plan.days_rows.all())
        today = timezone.localdate()
        done_dates = sorted(row.date for row in rows if row.status == PlanDay.Status.DONE)
        done = len(done_dates)
        overdue = sum(1 for row in rows if row.date < today and row.status != PlanDay.Status.DONE)
        return {
            "days": plan.days,
            "done": done,
            "overdue": overdue,
            "streak": _streak(done_dates, today),
        }

    def today(self, user):
        today = timezone.localdate()
        days = (
            PlanDay.objects.filter(plan__owner=user, date=today)
            .select_related("plan", "node")
            .order_by("plan_id", "day_number")
        )
        reviews = self.due(user, today)
        note = node_service.daily(user, today)
        return {"date": today, "plan_days": days, "reviews": reviews, "daily_note": note}

    def due(self, user, day: date):
        return (
            Review.objects.filter(owner=user, done_at__isnull=True, due_date__lte=day)
            .select_related("node", "plan_day")
            .order_by("due_date", "id")
        )

    def finish_review(self, user, review_id) -> Review:
        review = Review.objects.filter(owner=user, pk=review_id).select_related("node").first()
        if review is None:
            raise NotFound("Review not found.")
        if review.done_at is None:
            review.done_at = timezone.now()
            review.save(update_fields=["done_at"])
        return review


def _streak(done_dates: list[date], today: date) -> int:
    if not done_dates:
        return 0
    cursor = today if today in done_dates else today - timedelta(days=1)
    if cursor not in done_dates:
        return 0
    count = 0
    have = set(done_dates)
    while cursor in have:
        count += 1
        cursor -= timedelta(days=1)
    return count
