"""Tests for the jobs API, covering the contract the frontend depends on."""

from unittest import mock

from django.test import TestCase
from django.urls import reverse
from rest_framework import status as http
from rest_framework.test import APIClient

from jobs.models import Job, JobStatus, StatusType


class JobAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.list_url = reverse("job-list")

    def detail_url(self, job_id: int) -> str:
        return reverse("job-detail", args=[job_id])

    def create_job(self, name: str = "Fluid Dynamics Simulation") -> dict:
        response = self.client.post(self.list_url, {"name": name}, format="json")
        self.assertEqual(response.status_code, http.HTTP_201_CREATED)
        return response.json()


class CreateJobTests(JobAPITestCase):
    def test_opens_history_at_pending(self):
        body = self.create_job()

        self.assertEqual(body["status"], StatusType.PENDING)
        job = Job.objects.get(pk=body["id"])
        self.assertEqual(
            list(job.statuses.values_list("status_type", flat=True)), [StatusType.PENDING]
        )

    def test_accepts_an_explicit_initial_status(self):
        response = self.client.post(
            self.list_url, {"name": "Resumed", "status": StatusType.RUNNING}, format="json"
        )

        self.assertEqual(response.json()["status"], StatusType.RUNNING)

    def test_rejects_a_blank_name(self):
        for name in ("", "   "):
            with self.subTest(name=name):
                response = self.client.post(self.list_url, {"name": name}, format="json")

                self.assertEqual(response.status_code, http.HTTP_400_BAD_REQUEST)
                self.assertIn("name", response.json())

    def test_trims_surrounding_whitespace(self):
        body = self.create_job("  Mesh Generation  ")

        self.assertEqual(body["name"], "Mesh Generation")

    def test_is_atomic(self):
        """A job must never be left statusless if recording its first entry fails."""
        with mock.patch.object(Job, "record_status", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.client.post(self.list_url, {"name": "Doomed"}, format="json")

        self.assertEqual(Job.objects.count(), 0)


class UpdateJobTests(JobAPITestCase):
    def test_patch_appends_a_status_entry(self):
        job_id = self.create_job()["id"]

        response = self.client.patch(
            self.detail_url(job_id), {"status": StatusType.RUNNING}, format="json"
        )

        self.assertEqual(response.json()["status"], StatusType.RUNNING)
        self.assertEqual(
            list(
                JobStatus.objects.filter(job_id=job_id)
                .order_by("timestamp")
                .values_list("status_type", flat=True)
            ),
            [StatusType.PENDING, StatusType.RUNNING],
        )

    def test_patch_response_reflects_the_write_it_performed(self):
        """Regression: the response once carried the `updated_at` loaded before
        the write, so a client saw a value older than the entry it just created."""
        job_id = self.create_job()["id"]

        body = self.client.patch(
            self.detail_url(job_id), {"status": StatusType.FAILED}, format="json"
        ).json()

        job = Job.objects.get(pk=job_id)
        self.assertEqual(body["status"], job.current_status)
        self.assertEqual(body["updated_at"].replace("Z", "+00:00"), job.updated_at.isoformat())

    def test_patch_can_rename_and_transition_together(self):
        job_id = self.create_job()["id"]

        body = self.client.patch(
            self.detail_url(job_id),
            {"name": "Renamed", "status": StatusType.COMPLETED},
            format="json",
        ).json()

        self.assertEqual((body["name"], body["status"]), ("Renamed", StatusType.COMPLETED))

    def test_patch_rejects_an_unknown_status(self):
        job_id = self.create_job()["id"]

        response = self.client.patch(
            self.detail_url(job_id), {"status": "BOGUS"}, format="json"
        )

        self.assertEqual(response.status_code, http.HTTP_400_BAD_REQUEST)
        self.assertEqual(JobStatus.objects.filter(job_id=job_id).count(), 1)

    def test_put_is_not_allowed(self):
        job_id = self.create_job()["id"]

        response = self.client.put(self.detail_url(job_id), {"name": "X"}, format="json")

        self.assertEqual(response.status_code, http.HTTP_405_METHOD_NOT_ALLOWED)


class ListJobTests(JobAPITestCase):
    def test_returns_newest_first_with_current_status(self):
        self.create_job("First")
        self.create_job("Second")

        results = self.client.get(self.list_url).json()["results"]

        self.assertEqual([job["name"] for job in results], ["Second", "First"])
        self.assertTrue(all(job["status"] == StatusType.PENDING for job in results))

    def test_filters_by_status(self):
        running_id = self.create_job("Running Job")["id"]
        self.create_job("Pending Job")
        self.client.patch(
            self.detail_url(running_id), {"status": StatusType.RUNNING}, format="json"
        )

        results = self.client.get(self.list_url, {"status": StatusType.RUNNING}).json()[
            "results"
        ]

        self.assertEqual([job["name"] for job in results], ["Running Job"])

    def test_rejects_an_unknown_status_filter(self):
        """An unindexed filter value is an error, not an empty result set."""
        response = self.client.get(self.list_url, {"status": "bogus"})

        self.assertEqual(response.status_code, http.HTTP_400_BAD_REQUEST)

    def test_paginates_with_an_opaque_cursor(self):
        for index in range(3):
            self.create_job(f"Job {index}")

        page = self.client.get(self.list_url, {"page_size": 2}).json()

        self.assertEqual(len(page["results"]), 2)
        self.assertIsNotNone(page["next"])
        # Keyset pagination deliberately reports no total, so no COUNT(*) is run.
        self.assertNotIn("count", page)


class DetailAndDeleteTests(JobAPITestCase):
    def test_detail_includes_history_newest_first(self):
        job_id = self.create_job()["id"]
        self.client.patch(
            self.detail_url(job_id), {"status": StatusType.RUNNING}, format="json"
        )

        history = self.client.get(self.detail_url(job_id)).json()["status_history"]

        self.assertEqual(
            [entry["status_type"] for entry in history],
            [StatusType.RUNNING, StatusType.PENDING],
        )

    def test_delete_removes_the_job_and_its_history(self):
        job_id = self.create_job()["id"]

        response = self.client.delete(self.detail_url(job_id))

        self.assertEqual(response.status_code, http.HTTP_204_NO_CONTENT)
        self.assertEqual(Job.objects.count(), 0)
        self.assertEqual(JobStatus.objects.count(), 0)

    def test_detail_returns_404_for_a_missing_job(self):
        response = self.client.get(self.detail_url(9999))

        self.assertEqual(response.status_code, http.HTTP_404_NOT_FOUND)
