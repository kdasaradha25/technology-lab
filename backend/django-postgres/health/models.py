from django.db import models


class HealthRecord(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"HealthRecord {self.pk} at {self.created_at:%Y-%m-%d %H:%M:%S}"
