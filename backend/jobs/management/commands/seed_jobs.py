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


class Command(BaseCommand):
    help = "Create sample jobs with realistic status histories."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=len(LIFECYCLES),
            help=f"How many jobs to create (default: {len(LIFECYCLES)}).",
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

            # Stagger history backwards so `created_at` ordering is meaningful
            # and each job's transitions are a few minutes apart.
            for step, state in enumerate(states):
                job.record_status(
                    state, timestamp=now - timedelta(minutes=(count - index) * 30 - step * 5)
                )

        self.stdout.write(
            self.style.SUCCESS(f"Seeded {count} jobs ({Job.objects.count()} total).")
        )
