from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("system_explanation_services", "0009_processstep_status"),
    ]

    operations = [
        migrations.CreateModel(
            name="StepRiskControlLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("is_deleted", models.BooleanField(default=False)),
                (
                    "control",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="risk_links",
                        to="system_explanation_services.stepcontrol",
                    ),
                ),
                (
                    "risk",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="control_links",
                        to="system_explanation_services.steprisk",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.AddIndex(
            model_name="stepriskcontrollink",
            index=models.Index(fields=["risk", "is_deleted"], name="system_expl_risk_id_7f2a1c_idx"),
        ),
        migrations.AddIndex(
            model_name="stepriskcontrollink",
            index=models.Index(fields=["control", "is_deleted"], name="system_expl_control_8b3d2e_idx"),
        ),
        migrations.AddConstraint(
            model_name="stepriskcontrollink",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_deleted", False)),
                fields=("risk", "control"),
                name="uniq_active_step_risk_control_link",
            ),
        ),
    ]
