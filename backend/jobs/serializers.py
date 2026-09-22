"""Serializers for the jobs API."""

from django.db import transaction
from rest_framework import serializers

from .models import Job, JobStatus, StatusType


class JobStatusSerializer(serializers.ModelSerializer):
    """One entry in a job's status history."""

    class Meta:
        model = JobStatus
        fields = ("id", "status_type", "timestamp")
        read_only_fields = fields


class JobSerializer(serializers.ModelSerializer):
    """Read/write representation of a job.

    ``status`` is symmetric for clients — the field they read is the field they
    write — but a write appends a history entry rather than overwriting a row.
    """

    status = serializers.ChoiceField(
        choices=StatusType.choices, source="current_status", required=False
    )

    class Meta:
        model = Job
        fields = ("id", "name", "status", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    @transaction.atomic
    def create(self, validated_data: dict) -> Job:
        """Create the job and open its history with an initial status entry.

        Atomic so a job cannot be left statusless: the row and its opening
        entry commit together, or neither does.
        """
        status_type = validated_data.pop("current_status", StatusType.PENDING)
        job = Job.objects.create(**validated_data)
        job.record_status(status_type)
        return job

    def update(self, instance: Job, validated_data: dict) -> Job:
        """Apply field edits, and append a status entry when one is requested."""
        status_type = validated_data.pop("current_status", None)
        if validated_data:
            for field, value in validated_data.items():
                setattr(instance, field, value)
            instance.save(update_fields=(*validated_data, "updated_at"))
        if status_type is not None:
            instance.record_status(status_type)
        return instance


class JobDetailSerializer(JobSerializer):
    """A job together with its full status history, newest entry first."""

    status_history = JobStatusSerializer(source="statuses", many=True, read_only=True)

    class Meta(JobSerializer.Meta):
        fields = (*JobSerializer.Meta.fields, "status_history")
