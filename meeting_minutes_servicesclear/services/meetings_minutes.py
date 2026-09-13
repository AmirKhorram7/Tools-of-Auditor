from meeting_minutes_servicesclear.models import Company,  Meeting, MeetingItem, GroupMember, Group
from datetime import date
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

ROLE_OWNER = GroupMember.Role.OWNER
ROLE_MAINTAINER = GroupMember.Role.MAINTAINER
ROLE_GUEST = GroupMember.Role.GUEST


User = get_user_model()




class GroupService:

    def create_group(self, company: Company, name: str, owner: User) -> Group:
        return Group.objects.create(company=company, name=name, owner=owner)
    def update_group(self, group: Group, **fields) -> Group:
        data = self._validate_data(fields)
        group.name = data.get('name')
        group.owner = data.get('owner')
        group.save()
        return group
    def delete_group(self, group: Group) -> None:
        self.soft_delete(group)
        return group

    


class MeetingService:


    def is_comapny_owner(self, user: User, company: Company) -> bool:
        return user == company.owner
    def is_group_owner(self, user: User, group: Group) -> bool:
        return user == group.owner
    def is_group_member(self, user: User, group: Group) -> bool:
        return user in group.members.all()
    def is_meeting_owner(self, user: User, meeting: Meeting) -> bool:
        return user == meeting.owner
    def is_meeting_item_owner(self, user: User, meeting_item: MeetingItem) -> bool:
        return user == meeting_item.owner

    def _validate_data(self, data: dict) -> dict:
        if data.get('is_default_group_meeting') and data.get('meeting_number') is not None:
            raise ValidationError("Meeting number cannot be set when is_default_group_meeting is True")
            
        if data.get('meeting_number') is not None and data.get('meeting_number') <= 0:
            raise ValidationError("Meeting number must be greater than 0")

        if data.get('date') is not None and data.get('date') < date.today():
            raise ValidationError("Date must be in the future")
        
        if data.get('is_default_group_meeting') and data.get('meeting_number') is None:
            raise ValidationError("Meeting number is required when is_default_group_meeting is True")
        if data.get('manual_number_generating') and data.get('meeting_number') is not None:
            raise ValidationError("Meeting number cannot be set when manual_number_generating is False")
        
        if data.get('manual_number_generating') and data.get('meeting_number') is None:
            raise ValidationError("Meeting number is required when manual_number_generating is True")
        

        return data
            
        





    def meeting_list(self, group: Group, date: date) -> list[Meeting]:
        return Meeting.objects.filter(group=group, date=date)
    
    def meeting_detail(self, meeting: Meeting) -> Meeting:
        return meeting

    def get_meeting(self, meeting_id: int) -> Meeting:
        return Meeting.objects.get(id=meeting_id)


    def meeting_items_list(self, meeting: Meeting) -> list[MeetingItem]:
        return MeetingItem.objects.filter(meeting=meeting)
    
    def meeting_item_detail(self, meeting_item: MeetingItem) -> MeetingItem:
        return meeting_item
    def meeting_item_get(self, meeting_item_id: int) -> MeetingItem:
        return MeetingItem.objects.get(id=meeting_item_id)



    def generate_meeting_number(self, group: Group, date: date, manual_number_generating: bool) -> int:
        if group.manual_number_generating:
            return None
        else:
            return Meeting.objects.filter(group=group, date=date).count() + 1   


    def create_meeting(self, group: Group, date: date, is_default_group_meeting: bool = False, **fields) -> Meeting:
        data = self.validate_meeting_data(fields)
        meeting_number = self.generate_meeting_number(group, data.get('date'))
        meeting = Meeting.objects.create(
            group=group,
            date=data.get('date'),
            is_default_group_meeting=data.get('is_default_group_meeting'),
            meeting_number=meeting_number,
            manual_number_generating=data.get('manual_number_generating'),
            **data
        )
        return meeting

    def update_meeting(self, meeting: Meeting, **fields) -> Meeting:
        data = self.validate_meeting_data(fields)
        meeting.date = data.get('date')
        meeting.is_default_group_meeting = data.get('is_default_group_meeting')
        meeting.manual_number_generating = data.get('manual_number_generating')
        meeting.save()
        return meeting
    

    def delete_meeting(self, meeting: Meeting) -> None:
        self.soft_delete(meeting)
        return meeting



 



    def create_meeting_item(self, meeting: Meeting, title: str, description: str = "", priority: int = 2, assigned_to: GroupMember = None) -> MeetingItem:
        data = self.validate_meeting_item_data(title, description, priority, assigned_to)
        meeting_item = MeetingItem.objects.create(
            meeting=meeting,
            title=data.get('title'),
            description=data.get('description'),
            priority=data.get('priority'),
            assigned_to=data.get('assigned_to'),
        )
        return meeting_item

    def validate_meeting_item_data(self, title: str, description: str = "", priority: int = 2, assigned_to: GroupMember = None, **fields) -> dict:
        if title is None or title == "":
            raise ValidationError("Title is required")
        if priority is not None and priority < 1 or priority > 4:
            raise ValidationError("Priority must be between 1 and 4")
        return {
            'title': title,
            'description': description,
            'priority': priority,
            'assigned_to': assigned_to,
            'due_date': fields.get('due_date'),
            'completed_at': fields.get('completed_at'),
            'completed_by': fields.get('completed_by'),
            'status': fields.get('status'),
        }
    

    def update_meeting_item(self, meeting_item: MeetingItem, title: str = None, description: str = None, priority: int = None, assigned_to: GroupMember = None, due_date: date = None) -> MeetingItem:
        data = self.validate_meeting_item_data(title, description, priority, assigned_to, due_date)
        meeting_item.title = data.get('title')
        meeting_item.description = data.get('description')
        meeting_item.priority = data.get('priority')
        meeting_item.assigned_to = data.get('assigned_to')
        meeting_item.due_date = data.get('due_date')
        meeting_item.save()
        return meeting_item
    
    def delete_meeting_item(self, meeting_item: MeetingItem) -> None:
        self.soft_delete(meeting_item)
        return meeting_item


    


    def soft_delete(instance: Meeting | MeetingItem) -> None:
        instance.status = instance.Status.DELETED
        instance.save()
        return instance




