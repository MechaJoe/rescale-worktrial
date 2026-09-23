**Time spent:** 3 hours and 48 minutes, excluding a ~1 hour dinner break. Source changes were made from 5:00 to 9:48PM.

## Quick start

The only requirements are `make`, `docker`, Docker Compose v2, and `bash`.

```bash
make test    # build everything, run the backend unit tests, then the Playwright suite
make up      # start the stack
make seed    # optional: load 40 sample jobs, enough to page through
```

Then open http://localhost:5173.

`make test` should work from a clean checkout; it brings up whatever it needs rather
than assuming `make up` has run. The first run takes about **90 seconds**, most
of it pulling and building the Playwright image. After that it takes seconds.

## Make targets

| Target | What it does |
|---|---|
| `make build` | Build all images, including the end-to-end test runner |
| `make up` | Start the stack, returning once every service is healthy |
| `make test` | Run 27 backend unit tests, then 6 Playwright end-to-end tests |
| `make stop` | Stop the running containers |
| `make clean` | Remove containers, networks, and the database volume |
| `make seed` | Replace all data with 40 sample jobs spanning every status |
| `make dev` | Run only the API and database, for developing the frontend locally |
| `make logs` | Follow the container logs |

`make test` is repeatable despite whatever is in the database. Django creates and drops
its own test database, and every Playwright test deletes the jobs it created,
even if it fails partway. Running it against a seeded database leaves the seed
data untouched.

## How this was built with AI

The transcript file can be located at 2026-09-22-worktrial-transcript.txt

I built this (including this README) with assistance from Claude Code.
I asked it to  explain the function and motivation of every backend change before
making it, show me every commit before it lands, and never push without my approval.
I reviewed every change Claude performed on the codebase, and tested the result
manually.

**Examples where pushing back on Claude changed the code:**

- I asked whether storing an append-only status log forever was a problem. That
  led to working out that the log grows with job state transitions, not with time,
  which was acceptable for the scope of the project.
- Pushed Claude to include filtering by job status as a supported feature from the start of
  implementation, which meant including the status as a column
- Claude originally implemented creating a job and setting its first status as two
  separate transactions, which I amended to do in one transaction to avoid failure modes
  where a job could be created without a status.

## Services

| Service | URL | Notes |
|---|---|---|
| App | http://localhost:5173 | nginx serving the built frontend and proxying `/api` |
| API | http://localhost:8000/api/jobs/ | Also browsable directly |
| Admin | http://localhost:8000/admin/ | Run `createsuperuser` in the backend container first |
| PostgreSQL | `localhost:5433` | Database, user, and password are all `jobs` |

PostgreSQL is published on **5433**, not 5432, so the stack will not collide with
a PostgreSQL already running on the host. Inside the Compose network it is on
the standard port.

## Considerations

### Status as an append-only log

`JobStatus` rows are never modified. Changing a job's status appends a new
entry, so the table is both the source of the current status and a complete
audit history. `Job.record_status()` is the only code path that writes one.

`Job.current_status` holds the newest entry's state so the list can filter on it
through an index. It is written in the same transaction as the entry it
reflects, under a row lock on the job, so no reader ever sees the two disagree.

**Cursor Pagination**

To prevent large database scans, I implemented keyset (cursor) pagination instead
of page numbers. Offset pagination makes the database read and discard every skipped
row, so deep pages get slower in proportion to their depth. 
A cursor turns every page into an index range scan of constant cost. Rows inserted
while a user is paging cannot shift what they see either.

**Indexes built around the actual queries:**

| Index | Serves |
|---|---|
| `jobs_job (created_at DESC, id DESC)` | The unfiltered list, in its sort order |
| `jobs_job (current_status, created_at DESC, id DESC)` | The filtered list: equality on status, then the sort order, so no sort step |
| `jobs_jobstatus (job_id, timestamp DESC, id DESC)` | A job's latest status and its full history |

Filtering on status happens on the server, against an indexed column.

The frontend has 25 rows per page (at most 100), with Previous and Next controls.
There is no total count and no per-status count, since either would need
the `COUNT(*)` the design avoids.

## Local development

The frontend can also run outside Docker, with hot reload:

```bash
make dev                     # API and database in Docker; frontend container stopped
cd frontend
nvm use                      # Node 24, from .nvmrc
npm install && npm run dev   # http://localhost:5173, proxying /api to :8000
```

The toolchain requires Node `>=22.12`. However the Docker build does not depend on the host's Node at all.

## Project layout

```
backend/            Django project (config/) and the jobs app
  jobs/models.py      Job, JobStatus, and the append-only status log
  jobs/pagination.py  Cursor pagination
  jobs/tests/         Backend unit tests
frontend/           React + TypeScript (Vite), served by nginx
  src/api/            Typed API client
  src/hooks/          useJobs (list, filter, paging), useJobMutations
  src/components/     Table, filter, create form, row actions, dialog
e2e/                Playwright suite, run as a Compose service
docker-compose.yml  PostgreSQL, backend, frontend, and the e2e runner (profile: test)
Makefile
```

## Known limitations

- Jobs are always sorted newest first; sorting by name is not implemented.
- No auth
- No frontend tests
- The Compose file uses a development secret key and fixed credentials. They
  are fine for local use and not for anything else.
