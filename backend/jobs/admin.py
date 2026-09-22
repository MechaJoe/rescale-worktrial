from django.contrib import admin

from .models import Job, JobStatus


class JobStatusInline(admin.TabularInline):
    """Read-only view of a job's history.

    The history is append-only and `Job.current_status` holds its newest entry,
    so editing rows here would silently break that invariant. Status changes go
    through `Job.record_status()`.
    """

    model = JobStatus
    extra = 0
    can_delete = False
    ordering = ("-timestamp", "-id")
    readonly_fields = ("status_type", "timestamp")

    def has_add_permission(self, request, obj):
        return False


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "current_status", "created_at", "updated_at")
    list_filter = ("current_status",)
    search_fields = ("name",)
    date_hierarchy = "created_at"
    readonly_fields = ("current_status", "created_at", "updated_at")
    inlines = (JobStatusInline,)


@admin.register(JobStatus)
class JobStatusAdmin(admin.ModelAdmin):
    list_display = ("id", "job", "status_type", "timestamp")
    list_filter = ("status_type",)
    list_select_related = ("job",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
