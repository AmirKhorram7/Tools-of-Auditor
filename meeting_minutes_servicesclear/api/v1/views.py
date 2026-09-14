from rest_framework import status, viewsets
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from meeting_minutes_servicesclear.api.v1.serializers import (
    #company serializers
    CompanySerializer,

    #group serializers
    GroupMemberSerializer,
    GroupMemberUpdateSerializer,
    GroupSerializer,
    InvitationSerializer,
    InviteSerializer,
)

from meeting_minutes_servicesclear.services.meetings_minutes import CompanyService
from meeting_minutes_servicesclear.services.groups import GroupService
from meeting_minutes_servicesclear.models import Company, Group, GroupMember, GroupInvitation   


from django.db.models import Q


company_service = CompanyService()

group_service = GroupService()


class CompanyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompanySerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]



    def get_queryset(self):
        return company_service.companies_for_user(self.request.user)
    

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = company_service.create_company(
            user=request.user,
            name=serializer.validated_data["name"],
            parent=serializer.validated_data.get("parent")
        )
        return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)
    

    def partial_update(self, request, *args, **kwargs):
        company = self.get_object()
        serializer = self.get_serializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        company = company_service.update_company(
            user=request.user,
            company=company,
            **serializer.validated_data
        )
        return Response(CompanySerializer(company).data)
    
    def destroy(self, request, *args, **kwargs):
        company = self.get_object()
        company_service.delete_company(user=request.user, company=company)
        return Response(status=status.HTTP_204_NO_CONTENT)
    









# paer B ====> Groups 

class GroupViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = GroupSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    def get_queryset(self):
        company = None
        company_id = self.request.query_params.get("company")
        if company_id:
            company = Company.objects.filter(pk=company_id, deleted_at__isnull=True).first()
        return group_service.groups_for_user(self.request.user, company=company)
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = serializer.validated_data["company"]
        group = group_service.create_group(
            user=request.user,
            company=company,
            name=serializer.validated_data["name"],
        )
        return Response(self.get_serializer(group).data, status=status.HTTP_201_CREATED)
    def partial_update(self, request, *args, **kwargs):
        group = self.get_object()
        serializer = self.get_serializer(group, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        group = group_service.update_group(
            user=request.user,
            group=group,
            **serializer.validated_data,
        )
        return Response(self.get_serializer(group).data)
    def destroy(self, request, *args, **kwargs):
        group_service.delete_group(user=request.user, group=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        group = self.get_object()
        qs = group.members.filter(
            status=GroupMember.Status.ACTIVE,
            deleted_at__isnull=True,
        ).select_related("user").order_by("role", "id")
        return Response(GroupMemberSerializer(qs, many=True).data)
    @action(detail=True, methods=["post"])
    def invite(self, request, pk=None):
        group = self.get_object()
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation = group_service.invite(
            user=request.user,
            group=group,
            **serializer.validated_data,
        )
        return Response(InvitationSerializer(invitation).data, status=status.HTTP_201_CREATED)
    @action(detail=True, methods=["patch"], url_path=r"members/(?P<member_id>[^/.]+)")
    def update_member(self, request, pk=None, member_id=None):
        group = self.get_object()
        member = group.members.filter(pk=member_id, deleted_at__isnull=True).first()
        if member is None:
            raise ValidationError({"member_id": "Member not found."})
        serializer = GroupMemberUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        member = group_service.update_member(
            user=request.user,
            group=group,
            member=member,
            **serializer.validated_data,
        )
        return Response(GroupMemberSerializer(member).data)
    @action(detail=True, methods=["delete"], url_path=r"members/(?P<member_id>[^/.]+)")
    def remove_member(self, request, pk=None, member_id=None):
        group = self.get_object()
        member = group.members.filter(pk=member_id, deleted_at__isnull=True).first()
        if member is None:
            raise ValidationError({"member_id": "Member not found."})
        group_service.remove_member(user=request.user, group=group, member=member)
        return Response(status=status.HTTP_204_NO_CONTENT)







class InvitationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = InvitationSerializer
    def get_queryset(self):
        user = self.request.user
        scope = self.request.query_params.get("scope", "inbox")
        qs = GroupInvitation.objects.select_related(
            "group", "group__company", "invited_by", "invited_user"
        )
        if scope == "sent":
            return qs.filter(invited_by=user)
        return qs.filter(Q(invited_user=user) | Q(phone_number=user.phone_number)).distinct()
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = group_service.respond(
            user=request.user, invitation=self.get_object(), accept=True
        )
        return Response(self.get_serializer(invitation).data)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        invitation = group_service.respond(
            user=request.user, invitation=self.get_object(), accept=False
        )
        return Response(self.get_serializer(invitation).data)