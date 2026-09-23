import { useCallback, useState } from 'react'

import type { Job } from './api/types'
import { Banner } from './components/Banner'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CreateJobForm } from './components/CreateJobForm'
import { JobTable } from './components/JobTable'
import { StatusFilter } from './components/StatusFilter'
import { useJobMutations } from './hooks/useJobMutations'
import { useJobs } from './hooks/useJobs'
import controls from './styles/controls.module.css'

import styles from './App.module.css'

export default function App() {
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
  const mutations = useJobMutations({ onCreated, onChanged: reload })

  // The job awaiting delete confirmation, if any.
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)

  function confirmDelete() {
    if (jobToDelete) void mutations.remove(jobToDelete)
    setJobToDelete(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Jobs</h1>
          <p className={styles.subtitle}>Computational jobs and their current status.</p>
        </div>
        <CreateJobForm onCreate={mutations.create} />
      </header>

      <main className={styles.main}>
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
