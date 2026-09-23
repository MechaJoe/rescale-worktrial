"""Populate the database with sample jobs for local development and demos."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from jobs.models import Job, StatusType

# Each entry is a job name and the states it has moved through, oldest first.
# The mix is deliberate: finished work, work in flight, and work that has not
# started, so a dashboard built against this data shows every state at once.
LIFECYCLES: list[tuple[str, list[str]]] = [
    ("Fluid Dynamics Simulation", [StatusType.PENDING, StatusType.RUNNING]),
    ("ML Model Training", [StatusType.PENDING, StatusType.RUNNING, StatusType.COMPLETED]),
    ("Mesh Generation", [StatusType.PENDING, StatusType.RUNNING, StatusType.FAILED]),
    ("Crash Test Analysis", [StatusType.PENDING]),
    ("Thermal Sweep", [StatusType.PENDING, StatusType.RUNNING, StatusType.COMPLETED]),
    ("Turbulence Model Calibration", [StatusType.PENDING, StatusType.RUNNING]),
    ("Structural Fatigue Study", [StatusType.PENDING, StatusType.RUNNING, StatusType.FAILED]),
    ("Battery Thermal Runaway", [StatusType.PENDING]),
    ("Acoustic Propagation Model", [StatusType.PENDING, StatusType.RUNNING, StatusType.COMPLETED]),
    ("Combustion Chamber CFD", [StatusType.PENDING, StatusType.RUNNING]),
]


# More than one page at the API's default page size of 25, so pagination has
# something to page through in a freshly seeded dashboard.
DEFAULT_COUNT = 40


class Command(BaseCommand):
    help = "Create sample jobs with realistic status histories."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=DEFAULT_COUNT,
            help=f"How many jobs to create (default: {DEFAULT_COUNT}).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing jobs first, for a reproducible starting state.",
        )

    def handle(self, *args, **options):
        count, clear = options["count"], options["clear"]

        if clear:
            deleted, _ = Job.objects.all().delete()
            self.stdout.write(f"Cleared {deleted} existing rows.")

        now = timezone.now()
        for index in range(count):
            # Cycle the fixtures so --count can exceed the list, and suffix the
            # repeats so names stay distinguishable in the UI.
            name, states = LIFECYCLES[index % len(LIFECYCLES)]
            repeat = index // len(LIFECYCLES)
            job = Job.objects.create(name=f"{name} {repeat + 1}" if repeat else name)

            # Each job starts 30 minutes after the previous one, and its
            # transitions follow 5 minutes apart, so later jobs are newer.
            created_at = now - timedelta(minutes=(count - index) * 30)
            timestamps = [created_at + timedelta(minutes=step * 5) for step in range(len(states))]
            for state, timestamp in zip(states, timestamps):
                job.record_status(state, timestamp=timestamp)

            # `auto_now_add` and `auto_now` pin both columns to the moment of
            # seeding, which would make every row look identical. A queryset
            # update bypasses them, so the job appears created when its history
            # starts and last updated at its newest transition.
            Job.objects.filter(pk=job.pk).update(created_at=created_at, updated_at=timestamps[-1])

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {count} jobs ({Job.objects.count()} total).")
        )
