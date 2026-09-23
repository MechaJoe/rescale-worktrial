import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'

import type { Job } from '../api/types'
import { Banner } from '../components/Banner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CreateJobForm } from '../components/CreateJobForm'
import { JobTable } from '../components/JobTable'
import { StatusFilter } from '../components/StatusFilter'
import { useJobMutations } from '../hooks/useJobMutations'
import { useJobs } from '../hooks/useJobs'
import { readNotice, useDocumentTitle } from '../lib/navigation'
import controls from '../styles/controls.module.css'
import page from '../styles/page.module.css'

import styles from './JobListPage.module.css'

export function JobListPage() {
  useDocumentTitle('Jobs')
  const location = useLocation()

  const {
    jobs,
    status,
    setStatus,
    isLoading,
    error,
    hasNext,
    hasPrevious,
    goToNext,
    goToPrevious,
    reload,
    showNewJob,
  } = useJobs()

  const onCreated = useCallback((job: Job) => showNewJob(job.status), [showNewJob])
  const mutations = useJobMutations({
    onCreated,
    onChanged: reload,
    // A job's page hands over its "Deleted …" notice when it returns here. Only
    // read on arrival; useJobs then clears it from history so a reload does not
    // show it again.
    initialNotice: readNotice(location.state),
  })

  // The job awaiting delete confirmation, if any.
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)

  function confirmDelete() {
    if (jobToDelete) void mutations.remove(jobToDelete)
    setJobToDelete(null)
  }

  return (
    <div className={page.page}>
      <header className={page.header}>
        <div>
          <h1 className={page.title}>Jobs</h1>
          <p className={page.subtitle}>Computational jobs and their current status.</p>
        </div>
        <CreateJobForm onCreate={mutations.create} />
      </header>

      <main className={page.main}>
        <div className={styles.toolbar}>
          <StatusFilter value={status} onChange={setStatus} />

          <div className={styles.controls}>
            <button type="button" className={controls.button} onClick={reload} disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>

            {/* Previous/Next rather than numbered pages: keyset pagination has
                no page numbers and no total, and a bounded page keeps the DOM
                small however large the table grows. Top-right, as in the AWS
                console, so paging never means scrolling past the rows first. */}
            <nav className={styles.pagination} aria-label="Pagination">
              <button
                type="button"
                className={controls.button}
                onClick={goToPrevious}
                disabled={!hasPrevious || isLoading}
              >
                ← Previous
              </button>
              <button
                type="button"
                className={controls.button}
                onClick={goToNext}
                disabled={!hasNext || isLoading}
              >
                Next →
              </button>
            </nav>
          </div>
        </div>

        <Banner tone="error" message={error} action={{ label: 'Retry', onClick: reload }} />
        <Banner tone="error" message={mutations.error} onDismiss={mutations.dismissError} />
        <Banner tone="success" message={mutations.notice} onDismiss={mutations.dismissNotice} />

        <JobTable
          jobs={jobs}
          isLoading={isLoading}
          hasError={error !== null}
          pendingIds={mutations.pendingIds}
          onChangeStatus={mutations.changeStatus}
          onDelete={setJobToDelete}
        />
      </main>

      <ConfirmDialog
        open={jobToDelete !== null}
        title="Delete job?"
        confirmLabel="Delete job"
        onConfirm={confirmDelete}
        onCancel={() => setJobToDelete(null)}
      >
        <p>
          “{jobToDelete?.name}” and its entire status history will be permanently deleted.
        </p>
      </ConfirmDialog>
    </div>
  )
}
