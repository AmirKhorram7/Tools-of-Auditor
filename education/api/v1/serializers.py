from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from education.models import CourseComment, ExamSubmission, TeacherProfile, plain_text


def as_text(value, max_length):
    try:
        return plain_text(value, max_length=max_length)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.messages)


class CommentSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(read_only=True)
    author_name = serializers.SerializerMethodField()
    parent = serializers.IntegerField(source="parent_id", read_only=True, allow_null=True)
    is_teacher = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    dislike_count = serializers.SerializerMethodField()
    my_vote = serializers.SerializerMethodField()

    class Meta:
        model = CourseComment
        fields = [
            "id",
            "course",
            "lesson",
            "parent",
            "author_id",
            "author_name",
            "is_teacher",
            "body",
            "like_count",
            "dislike_count",
            "my_vote",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "course",
            "parent",
            "author_id",
            "author_name",
            "is_teacher",
            "like_count",
            "dislike_count",
            "my_vote",
            "created_at",
        ]

    def get_author_name(self, obj):
        from education.services.teachers import teacher_name

        return teacher_name(obj.author) or getattr(obj.author, "phone_number", "") or ""

    def get_is_teacher(self, obj):
        from education.services.teachers import can_build_course

        return can_build_course(obj.author)

    def get_like_count(self, obj):
        return getattr(obj, "like_total", None) if getattr(obj, "like_total", None) is not None else obj.votes.filter(value=1).count()

    def get_dislike_count(self, obj):
        return getattr(obj, "dislike_total", None) if getattr(obj, "dislike_total", None) is not None else obj.votes.filter(value=-1).count()

    def get_my_vote(self, obj):
        user = self.context.get("request") and self.context["request"].user
        if not user or not user.is_authenticated:
            return 0
        mine = getattr(obj, "my_votes", None)
        if mine is not None:
            return mine[0].value if mine else 0
        row = obj.votes.filter(user=user).first()
        return row.value if row else 0

    def validate_body(self, value):
        return as_text(value, CourseComment.MAX_LENGTH)


class ExamSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSubmission
        fields = ["id", "answer", "score", "graded_at"]
        read_only_fields = ["id", "score", "graded_at"]

    def validate_answer(self, value):
        return as_text(value, 8000)


class TeacherProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeacherProfile
        fields = ["user", "bio"]
        read_only_fields = ["user"]

    def validate_bio(self, value):
        return as_text(value, TeacherProfile.MAX_BIO) if value else ""
