"""Domain models for the job dashboard.

A :class:`Job` owns an append-only log of :class:`JobStatus` rows. Nothing ever
mutates a status: moving a job to a new state records a new entry, so the log
doubles as the job's audit history.
"""

from django.db import models, transaction
from django.db.models import OuterRef, Subquery
from django.utils import timezone


class JobQuerySet(models.QuerySet):
    def with_current_status(self) -> "JobQuerySet":
        """Annotate each job with the ``status_type`` of its latest status entry.

        Uses a correlated subquery rather than a join + ``DISTINCT ON`` so the
        annotation stays composable, and so the database only resolves it for
        the rows a paginated response actually returns. The subquery is a
        one-row lookup on ``jobs_jobstatus (job_id, -timestamp, -id)``.
        """
        latest_status = JobStatus.objects.filter(job=OuterRef("pk")).values("status_type")[:1]
        return self.annotate(current_status=Subquery(latest_status))


class Job(models.Model):
    """A computational job submitted to the platform."""

    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = JobQuerySet.as_manager()

    class Meta:
        # Newest first, with `id` as a tiebreaker so the ordering is total and
        # safe for keyset pagination.
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("-created_at", "-id"), name="job_created_desc_idx"),
            models.Index(fields=("name",), name="job_name_idx"),
        ]

    def __str__(self) -> str:
        return self.name

    @transaction.atomic
    def record_status(self, status_type: str, timestamp=None) -> "JobStatus":
        """Append a new status entry and return it.

        This is the only supported way to change a job's state; the rest of the
        codebase goes through it so the history stays consistent.
        """
        status = self.statuses.create(
            status_type=status_type, timestamp=timestamp or timezone.now()
        )
        # `auto_now` only fires on Job.save(), so touch the row explicitly to
        # keep `updated_at` meaningful for status-only changes.
        Job.objects.filter(pk=self.pk).update(updated_at=timezone.now())
        return status

    def latest_status(self) -> str | None:
        """The job's current ``status_type``, or ``None`` if it has no history.

        Prefer the ``current_status`` annotation from
        :meth:`JobQuerySet.with_current_status` when reading a list of jobs;
        this method is the single-object fallback and costs one query.
        """
        return self.statuses.values_list("status_type", flat=True).first()


class JobStatus(models.Model):
    """One entry in a job's status history."""

    class StatusType(models.TextChoices):
        PENDING = "PENDING", "Pending"
        RUNNING = "RUNNING", "Running"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="statuses")
    status_type = models.CharField(max_length=16, choices=StatusType.choices)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name_plural = "job statuses"
        ordering = ("-timestamp", "-id")
        indexes = [
            # Serves both "latest status for this job" and "full history for
            # this job", which are the only two ways this table is read.
            models.Index(fields=("job", "-timestamp", "-id"), name="jobstatus_latest_idx"),
        ]
        get_latest_by = ("timestamp", "id")

    def __str__(self) -> str:
        return f"{self.job_id}: {self.status_type} @ {self.timestamp:%Y-%m-%d %H:%M:%S}"
