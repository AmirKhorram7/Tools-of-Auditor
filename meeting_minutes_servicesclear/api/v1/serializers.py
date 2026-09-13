from rest_framework import serializers
from meeting_minutes_servicesclear.models import Company







class CompanySerializer(serializers.ModelSerializer):
    is_owner = serializers.SerializerMethodField()


    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "parent",
            "owner",
            "status",
            "is_owner",
            "created_at",
            "updated_at",
           
        ]
        read_only_fields = ["owner", "is_owner", "created_at", "updated_at"]
    


    def get_is_owner(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.owner_id == request.user.id)