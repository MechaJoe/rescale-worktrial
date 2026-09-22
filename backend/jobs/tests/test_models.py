"""Tests for the job models, focused on the append-only log and the invariant
that ``Job.current_status`` always equals the newest entry in that log."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from jobs.models import Job, JobStatus, StatusType


class RecordStatusTests(TestCase):
    def setUp(self):
        self.job = Job.objects.create(name="Fluid Dynamics Simulation")

    def test_appends_entry_and_updates_current_status(self):
        self.job.record_status(StatusType.PENDING)
        self.job.record_status(StatusType.RUNNING)

        self.assertEqual(self.job.statuses.count(), 2)
        self.assertEqual(self.job.current_status, StatusType.RUNNING)

    def test_never_mutates_an_existing_entry(self):
        """The history is append-only, so a transition must not rewrite the past."""
        first = self.job.record_status(StatusType.PENDING)
        self.job.record_status(StatusType.RUNNING)

        first.refresh_from_db()
        self.assertEqual(first.status_type, StatusType.PENDING)

    def test_current_status_matches_the_log_after_every_transition(self):
        for state in (StatusType.PENDING, StatusType.RUNNING, StatusType.COMPLETED):
            with self.subTest(state=state):
                self.job.record_status(state)
                self.job.refresh_from_db()
                self.assertEqual(self.job.current_status, self.job.latest_status())

    def test_backdated_entry_does_not_become_current(self):
        """`record_status` derives the newest state rather than assuming it just
        wrote it, so an out-of-order timestamp cannot corrupt the column."""
        self.job.record_status(StatusType.RUNNING)
        self.job.record_status(
            StatusType.PENDING, timestamp=timezone.now() - timedelta(hours=1)
        )

        self.assertEqual(self.job.current_status, StatusType.RUNNING)
        self.job.refresh_from_db()
        self.assertEqual(self.job.current_status, StatusType.RUNNING)

    def test_leaves_the_calling_instance_consistent_with_the_database(self):
        """The caller serializes the object it passed in, so that object must
        carry the values the write produced — not the ones it was loaded with."""
        self.job.record_status(StatusType.RUNNING)

        in_memory = (self.job.current_status, self.job.updated_at)
        self.job.refresh_from_db()
        self.assertEqual(in_memory, (self.job.current_status, self.job.updated_at))

    def test_refreshes_updated_at_on_a_status_only_change(self):
        """`auto_now` only fires on Job.save(), which a status append would miss."""
        before = self.job.updated_at
        self.job.record_status(StatusType.RUNNING)

        self.assertGreater(self.job.updated_at, before)

    def test_updated_at_is_never_older_than_the_newest_entry(self):
        self.job.record_status(StatusType.PENDING)

        self.assertGreaterEqual(self.job.updated_at, self.job.statuses.first().timestamp)


class LatestStatusTests(TestCase):
    def test_returns_none_without_history(self):
        job = Job.objects.create(name="Untouched")

        self.assertIsNone(job.latest_status())
        self.assertIsNone(job.current_status)

    def test_breaks_timestamp_ties_by_id(self):
        """Bulk transitions can share a timestamp, so the ordering must stay total."""
        job = Job.objects.create(name="Simultaneous")
        now = timezone.now()
        job.record_status(StatusType.PENDING, timestamp=now)
        job.record_status(StatusType.RUNNING, timestamp=now)

        self.assertEqual(job.latest_status(), StatusType.RUNNING)


class CascadeTests(TestCase):
    def test_deleting_a_job_deletes_its_history(self):
        job = Job.objects.create(name="Doomed")
        job.record_status(StatusType.PENDING)
        job.record_status(StatusType.FAILED)

        job.delete()

        self.assertEqual(JobStatus.objects.count(), 0)
