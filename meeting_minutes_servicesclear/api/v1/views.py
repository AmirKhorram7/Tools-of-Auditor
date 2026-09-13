from rest_framework import status, viewsets
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from meeting_minutes_servicesclear.api.v1.serializers import CompanySerializer
from meeting_minutes_servicesclear.services.meetings_minutes import CompanyService


company_service = CompanyService()



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
    