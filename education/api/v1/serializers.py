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

    class Meta:
        model = CourseComment
        fields = ["id", "course", "lesson", "author_id", "body", "created_at"]
        read_only_fields = ["id", "course", "author_id", "created_at"]

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
