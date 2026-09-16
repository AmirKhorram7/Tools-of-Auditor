from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("user_management", "0002_buildercontactclick"),
    ]

    operations = [
        migrations.AddField(
            model_name="profile",
            name="character_id",
            field=models.CharField(
                blank=True,
                default="",
                max_length=20,
                verbose_name="Character",
            ),
        ),
    ]
