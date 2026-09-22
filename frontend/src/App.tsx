import { ErrorBanner } from './components/ErrorBanner'
import { JobTable } from './components/JobTable'
import { StatusFilter } from './components/StatusFilter'
import { useJobs } from './hooks/useJobs'

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
  } = useJobs()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Jobs</h1>
        <p className={styles.subtitle}>Computational jobs and their current status.</p>
      </header>

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <StatusFilter value={status} onChange={setStatus} />

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={reload}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>

            {/* Previous/Next rather than numbered pages: keyset pagination has
                no page numbers and no total, and a bounded page keeps the DOM
                small however large the table grows. Top-right, as in the AWS
                console, so paging never means scrolling past the rows first. */}
            <nav className={styles.pagination} aria-label="Pagination">
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={goToPrevious}
                disabled={!hasPrevious || isLoading}
              >
                ← Previous
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={goToNext}
                disabled={!hasNext || isLoading}
              >
                Next →
              </button>
            </nav>
          </div>
        </div>

        <ErrorBanner message={error} onRetry={reload} />

        <JobTable jobs={jobs} isLoading={isLoading} hasError={error !== null} />
      </main>
    </div>
  )
}
