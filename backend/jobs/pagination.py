"""Pagination tuned for very large job tables."""

from rest_framework.pagination import CursorPagination


class JobCursorPagination(CursorPagination):
    """Keyset pagination over jobs.

    Cursor (keyset) pagination is used instead of page numbers because the table
    is expected to hold millions of rows:

    * ``LIMIT/OFFSET`` makes the database walk and discard every skipped row, so
      deep pages get linearly slower. A cursor turns every page into an indexed
      range scan of constant cost.
    * ``PageNumberPagination`` issues a ``COUNT(*)`` per request, which is a full
      scan in PostgreSQL. Cursor pagination reports no total, so it never pays it.
    * Rows inserted while a user is paging cannot shift results into or out of an
      already-visited page.

    ``ordering`` matches the composite index declared on :class:`jobs.models.Job`,
    and ``id`` breaks ties so the ordering is total.
    """

    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = ("-created_at", "-id")
