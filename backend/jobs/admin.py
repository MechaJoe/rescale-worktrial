from django.contrib import admin

from .models import Job, JobStatus


class JobStatusInline(admin.TabularInline):
    model = JobStatus
    extra = 0
    ordering = ("-timestamp", "-id")


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "current_status", "created_at", "updated_at")
    search_fields = ("name",)
    date_hierarchy = "created_at"
    inlines = (JobStatusInline,)

    def get_queryset(self, request):
        return super().get_queryset(request).with_current_status()

    @admin.display(description="Current status", ordering="current_status")
    def current_status(self, job: Job) -> str:
        return job.current_status or "—"


@admin.register(JobStatus)
class JobStatusAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "status_type", "timestamp")
    list_filter = ("status_type",)
    list_select_related = ("job",)
