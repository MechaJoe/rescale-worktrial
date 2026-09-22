# syntax=docker/dockerfile:1

FROM python:3.12-slim

# PYTHONDONTWRITEBYTECODE keeps .pyc files out of the image; PYTHONUNBUFFERED
# makes logs appear in `docker compose logs` as they happen rather than when a
# buffer fills.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies are copied and installed before the source so that editing code
# does not invalidate the (slow) pip layer. psycopg ships binary wheels, so no
# libpq or compiler is needed here.
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# Run as a non-root user. Ownership is set on /app so collectstatic and any
# other runtime writes succeed.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--access-logfile", "-"]
