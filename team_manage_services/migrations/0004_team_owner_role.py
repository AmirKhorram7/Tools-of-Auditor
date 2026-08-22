from django.db import migrations


def set_team_creators_as_owners(apps, schema_editor):
    Team = apps.get_model("team_manage_services", "Team")
    TeamMember = apps.get_model("team_manage_services", "TeamMember")
    for team in Team.objects.all().only("id", "owner_id"):
        if not team.owner_id:
            continue
        TeamMember.objects.filter(team_id=team.id, user_id=team.owner_id).update(
            role="owner"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("team_manage_services", "0003_board_templates_and_roles"),
    ]

    operations = [
        migrations.RunPython(set_team_creators_as_owners, migrations.RunPython.noop),
    ]
