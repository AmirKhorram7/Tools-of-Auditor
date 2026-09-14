from turtle import position
from rest_framework import serializers
from meeting_minutes_servicesclear.models import Company, Group, GroupMember, GroupInvitation







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






### Part B ===> Groups 



class GroupSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    my_role = serializers.SerializerMethodField()
    can_manage = serializers.SerializerMethodField()


    class Meta:
        model = Group
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "owner",
            "status",
            "my_role",
            "can_manage",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["owner", "company_name", "my_role", "can_manage", "created_at", "updated_at"]
    

    def _service(self):
        from meeting_minutes_servicesclear.services.groups import GroupService
        return GroupService()
    

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.company.owner_id == request.user.id:
            return GroupMember.Role.OWNER
        return self._service().member_role(request.user, obj)



    def get_can_manage(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return self._service().can_manage_members(request.user, obj)



class GroupMemberSerializer(serializers.ModelSerializer):
    phone_number = serializers.CharField(source="user.phone_number", read_only=True)
    full_name = serializers.SerializerMethodField()


    class Meta:
        model = GroupMember
        fields = [
            "id",
            "user",
            "phone_number",
            "full_name",
            "role",
            "position_title",
            "status",
            "joined_at",
        ]
        read_only_fields = ["user", "phone_number", "full_name", "joined_at"]


    def get_full_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.phone_number
    





class InviteSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    position_title = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[
            (GroupMember.Role.MAINTAINER, "Maintainer"),
            (GroupMember.Role.GUEST, "Guest"),
        ],
        required=False,
        default=GroupMember.Role.GUEST,
    )



class GroupMemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=[
            (GroupMember.Role.MAINTAINER, "Maintainer"),
            (GroupMember.Role.GUEST, "Guest"),
        ],
        required=False,
    )
    status = serializers.ChoiceField(choices=GroupMember.Status.choices, required=False)
    position_title = serializers.CharField(max_length=150, required=False, allow_blank=True)



class InvitationSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source="group.name", read_only=True)
    company_id = serializers.IntegerField(source="group.company_id", read_only=True)
    invited_by_name = serializers.SerializerMethodField()
    class Meta:
        model = GroupInvitation
        fields = [
            "id",
            "group",
            "group_name",
            "company_id",
            "invited_by",
            "invited_by_name",
            "invited_user",
            "phone_number",
            "role",
            "position_title",
            "status",
            "expires_at",
            "created_at",
        ]
        read_only_fields = fields


        
    def get_invited_by_name(self, obj):
        return obj.invited_by.get_full_name().strip() or obj.invited_by.phone_number


