"""Domain models for the job dashboard.

A :class:`Job` owns an append-only log of :class:`JobStatus` rows. Nothing ever
mutates a status: moving a job to a new state appends an entry, so the log
doubles as the job's audit history.

``Job.current_status`` holds the newest entry's state, so the dashboard can
filter on it with an index. It is written in the same transaction as the entry
it reflects, so it is a derived column rather than a cache: no reader ever
observes it disagreeing with the log, and nothing needs to fall back to the log
on read.
"""

from django.db import models, transaction
from django.utils import timezone


class StatusType(models.TextChoices):
    """The states a job can occupy, in the order a job normally moves through them."""

    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class Job(models.Model):
    """A computational job submitted to the platform."""

    name = models.CharField(max_length=255)
    current_status = models.CharField(
        max_length=16,
        choices=StatusType.choices,
        null=True,
        blank=True,
        help_text="Newest entry in the job's status history. Maintained by record_status().",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Newest first, with `id` as a tiebreaker so the ordering is total and
        # safe for keyset pagination.
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=("-created_at", "-id"), name="job_created_desc_idx"),
            # Equality on `current_status` plus the list's sort order as the
            # trailing columns, so a filtered page is one bounded index range
            # scan with no sort step.
            models.Index(
                fields=("current_status", "-created_at", "-id"),
                name="job_status_created_idx",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    @transaction.atomic
    def record_status(self, status_type: str, timestamp=None) -> "JobStatus":
        """Append a status entry and update ``current_status`` to match.

        This is the only supported way to move a job between states. Both
        writes commit together, which is what keeps the column and the log in
        agreement for every reader.
        """
        # Take a row lock for the rest of the transaction. This serializes
        # concurrent transitions *for this job*, so two of them cannot
        # interleave and leave `current_status` disagreeing with the newest log
        # entry. Jobs see a handful of transitions each, so it never becomes a
        # throughput bottleneck. The fetched row is discarded: `update_fields`
        # below means this instance's other columns are never written back.
        Job.objects.select_for_update().get(pk=self.pk)

        status = self.statuses.create(
            status_type=status_type, timestamp=timestamp or timezone.now()
        )
        # Derive from the log rather than assuming the row just written is the
        # newest one: callers may backdate `timestamp`.
        self.current_status = self.latest_status()
        # `auto_now` refreshes `updated_at`, which a status-only change would
        # otherwise miss, since it only fires on Job.save(). Saving `self`
        # rather than a second instance keeps both columns correct in memory,
        # so the caller can serialize this object without re-reading it.
        self.save(update_fields=("current_status", "updated_at"))
        return status

    def latest_status(self) -> str | None:
        """Derive the newest ``status_type`` from the history.

        This is the definition that ``current_status`` materializes: reads
        should use the column, while :meth:`record_status` uses this to keep
        the two equal, and tests can assert that they are. Costs one row from
        the ``jobstatus_latest_idx`` index.
        """
        return self.statuses.values_list("status_type", flat=True).first()


class JobStatus(models.Model):
    """One entry in a job's status history."""

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
