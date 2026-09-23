import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'

import { Banner } from '../components/Banner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { JobActions } from '../components/JobActions'
import { StatusBadge } from '../components/StatusBadge'
import { StatusHistory } from '../components/StatusHistory'
import { useJob } from '../hooks/useJob'
import { useJobMutations } from '../hooks/useJobMutations'
import { formatTimestamp } from '../lib/format'
import { readReturnTo, useDocumentTitle } from '../lib/navigation'
import page from '../styles/page.module.css'

import styles from './JobDetailPage.module.css'
import { NotFoundPage } from './NotFoundPage'

/** A route parameter as a job ID, or null if it cannot be one. */
function parseJobId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function JobDetailPage() {
  const id = parseJobId(useParams().id)
  if (id === null) {
    return <NotFoundPage title="Job not found" message="That is not a valid job ID." />
  }
  // Keyed by ID, so moving between jobs starts from a clean slate instead of
  // briefly showing the previous job's details.
  return <JobDetailView key={id} id={id} />
}

function JobDetailView({ id }: { id: number }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { job, isLoading, isNotFound, error, reload } = useJob(id)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  // The list view this page was opened from, so the way back restores its
  // filter and page. Reached directly — by a shared link or a reload in a new
  // tab — it falls back to the unfiltered first page.
  const returnTo = readReturnTo(location.state)
  const listUrl = returnTo ? { pathname: returnTo.pathname, search: returnTo.search } : '/'

  const mutations = useJobMutations({
    onChanged: reload,
    // The job no longer exists, so there is nothing left here to show. Return
    // to the list — replacing this entry, so Back does not revisit a dead page —
    // and hand the confirmation over for the list to display.
    onDeleted: (_deleted, notice) =>
      navigate(listUrl, {
        replace: true,
        state: { ...(returnTo?.state as object | undefined), notice },
      }),
  })

  useDocumentTitle(job ? `${job.name} · Jobs` : 'Job · Jobs')

  if (isNotFound) {
    return (
      <NotFoundPage
        title="Job not found"
        message={`There is no job with ID ${id}. It may have been deleted.`}
      />
    )
  }

  return (
    <div className={page.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to={listUrl} state={returnTo?.state}>
          Jobs
        </Link>
        <span aria-hidden="true"> › </span>
        <span aria-current="page">{job?.name ?? `Job ${id}`}</span>
      </nav>

      <header className={page.header}>
        <div className={styles.headline}>
          <h1 className={page.title}>{job?.name ?? 'Loading job…'}</h1>
          {job ? <StatusBadge status={job.status} /> : null}
        </div>
        {job ? (
          <JobActions
            job={job}
            isPending={mutations.pendingIds.has(job.id)}
            onChangeStatus={mutations.changeStatus}
            onDelete={() => setIsConfirmingDelete(true)}
          />
        ) : null}
      </header>

      <main className={page.main} aria-busy={isLoading}>
        <Banner tone="error" message={error} action={{ label: 'Retry', onClick: reload }} />
        <Banner tone="error" message={mutations.error} onDismiss={mutations.dismissError} />
        <Banner tone="success" message={mutations.notice} onDismiss={mutations.dismissNotice} />

        {job ? (
          <>
            <section className={styles.card} aria-labelledby="job-details-heading">
              <h2 id="job-details-heading" className={styles.cardTitle}>
                Details
              </h2>
              <dl className={styles.details}>
                <dt>ID</dt>
                <dd className={styles.mono}>{job.id}</dd>
                <dt>Created</dt>
                <dd>{formatTimestamp(job.created_at)}</dd>
                <dt>Last updated</dt>
                <dd>{formatTimestamp(job.updated_at)}</dd>
              </dl>
            </section>

            <section className={styles.card} aria-labelledby="job-history-heading">
              <h2 id="job-history-heading" className={styles.cardTitle}>
                Status history
              </h2>
              <StatusHistory entries={job.status_history} />
            </section>
          </>
        ) : null}
      </main>

      <ConfirmDialog
        open={isConfirmingDelete && job !== null}
        title="Delete job?"
        confirmLabel="Delete job"
        onConfirm={() => {
          if (job) void mutations.remove(job)
          setIsConfirmingDelete(false)
        }}
        onCancel={() => setIsConfirmingDelete(false)}
      >
        <p>“{job?.name}” and its entire status history will be permanently deleted.</p>
      </ConfirmDialog>
    </div>
  )
}
