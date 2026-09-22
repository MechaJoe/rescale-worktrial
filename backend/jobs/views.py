"""API views for the jobs app."""

from django.db import connection
from rest_framework import mixins, viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Job, StatusType
from .serializers import JobDetailSerializer, JobSerializer


class JobViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD for jobs.

    ``GET /api/jobs/``      paginated list, newest first, optionally ``?status=``
    ``POST /api/jobs/``     create a job, opening its history at ``PENDING``
    ``GET /api/jobs/{id}/`` a single job with its full status history
    ``PATCH /api/jobs/{id}/`` rename and/or append a new status entry
    ``DELETE /api/jobs/{id}/`` delete a job; its history cascades with it
    """

    queryset = Job.objects.all()
    serializer_class = JobSerializer
    # PUT is excluded deliberately: a job is only ever partially updated, and
    # UpdateModelMixin would otherwise expose a full-replacement route.
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_serializer_class(self):
        return JobDetailSerializer if self.action == "retrieve" else JobSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(current_status=self._validate_status(status_filter))
        return queryset

    @staticmethod
    def _validate_status(value: str) -> str:
        """Reject unknown statuses rather than silently returning an empty list.

        Only values backed by ``job_status_created_idx`` are accepted, so the
        endpoint cannot be talked into an unindexed scan.
        """
        if value not in StatusType.values:
            raise ValidationError(
                {"status": f"Must be one of: {', '.join(StatusType.values)}."}
            )
        return value


@api_view(("GET",))
def health(request):
    """Readiness probe for the container healthcheck.

    Touches the database so an unreachable Postgres fails the check rather than
    reporting a process that is up but cannot serve a request.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
    return Response({"status": "ok"})
