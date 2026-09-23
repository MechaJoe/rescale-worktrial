import { useCallback, useEffect, useState } from 'react'

import { ApiError, getJob } from '../api/client'
import type { JobDetail } from '../api/types'

export interface UseJobResult {
  job: JobDetail | null
  isLoading: boolean
  /** The job does not exist — distinct from failing to load it. */
  isNotFound: boolean
  error: string | null
  reload: () => void
}

type Outcome =
  | { kind: 'loaded'; requestKey: string; job: JobDetail }
  | { kind: 'notFound'; requestKey: string }
  | { kind: 'failed'; requestKey: string; message: string }

/**
 * Loads one job with its status history.
 *
 * A 404 is reported as `isNotFound` rather than as an error: a job that does
 * not exist warrants a page saying so, where a Retry button would be useless.
 * As in useJobs, state is derived from which request last settled, so it is
 * only ever set from async callbacks.
 */
export function useJob(id: number): UseJobResult {
  const [reloadCount, setReloadCount] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  // The job last shown, kept across reloads so the page does not blank out
  // while a status change is being fetched back.
  const [lastJob, setLastJob] = useState<JobDetail | null>(null)

  const requestKey = `${id}#${reloadCount}`

  useEffect(() => {
    let cancelled = false
    getJob(id)
      .then((job) => {
        if (cancelled) return
        setLastJob(job)
        setOutcome({ kind: 'loaded', requestKey, job })
      })
      .catch((cause: Error) => {
        if (cancelled) return
        if (cause instanceof ApiError && cause.status === 404) {
          setOutcome({ kind: 'notFound', requestKey })
        } else {
          setOutcome({ kind: 'failed', requestKey, message: cause.message })
        }
      })
    return () => {
      cancelled = true
    }
  }, [id, requestKey])

  const settled = outcome?.requestKey === requestKey ? outcome : null
  const job = settled?.kind === 'loaded' ? settled.job : lastJob?.id === id ? lastJob : null

  return {
    job,
    isLoading: settled === null,
    isNotFound: settled?.kind === 'notFound',
    error: settled?.kind === 'failed' ? settled.message : null,
    reload: useCallback(() => setReloadCount((count) => count + 1), []),
  }
}
