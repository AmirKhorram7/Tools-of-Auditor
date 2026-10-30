from django.db import migrations

from news.constants import NEWS_GROUP_NAME


def create_news_team(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name=NEWS_GROUP_NAME)


def remove_news_team(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name=NEWS_GROUP_NAME).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
        ("news", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_news_team, remove_news_team),
    ]
