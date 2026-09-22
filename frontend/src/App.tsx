import { useEffect, useState } from 'react'

import { listJobs } from './api/client'
import type { Job } from './api/types'

/**
 * Placeholder shell. It exists to prove the wiring — React, the `/api` proxy,
 * and the Django backend — end to end, and is replaced by the real dashboard.
 */
export default function App() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listJobs()
      .then((page) => setJobs(page.results))
      .catch((cause: Error) => setError(cause.message))
  }, [])

  return (
    <main>
      <h1>Job Management Dashboard</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              {job.name} — {job.status}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
