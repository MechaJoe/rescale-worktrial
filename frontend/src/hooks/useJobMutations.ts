import { useCallback, useState } from 'react'

import { createJob, deleteJob, updateJobStatus } from '../api/client'
import type { Job, StatusType } from '../api/types'
import { STATUS_LABELS } from '../components/statusLabels'

interface UseJobMutationsOptions {
  /** Called after a job is created, with the job the server returned. */
  onCreated: (job: Job) => void
  /** Called after an existing job is changed or deleted. */
  onChanged: () => void
}

export interface UseJobMutationsResult {
  /** Rejects with the ApiError on failure, so a form can show field errors. */
  create: (name: string) => Promise<Job>
  changeStatus: (job: Job, status: StatusType) => Promise<void>
  remove: (job: Job) => Promise<void>
  /** Jobs with a request in flight, whose controls should be disabled. */
  pendingIds: ReadonlySet<number>
  error: string | null
  notice: string | null
  dismissError: () => void
  dismissNotice: () => void
}

/**
 * Create, update and delete, with the bookkeeping around them.
 *
 * In-flight state is tracked per job rather than globally, so changing one
 * row's status does not lock every other row — the same way the AWS console
 * disables actions only on an instance that is mid-transition.
 */
export function useJobMutations({
  onCreated,
  onChanged,
}: UseJobMutationsOptions): UseJobMutationsResult {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(() => new Set())
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const setPending = useCallback((id: number, pending: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  /** Run a request against one job, reporting its outcome either way. */
  const runForJob = useCallback(
    async (job: Job, request: () => Promise<unknown>, success: string, failure: string) => {
      setPending(job.id, true)
      setError(null)
      setNotice(null)
      try {
        await request()
        setNotice(success)
        onChanged()
      } catch (cause) {
        setError(`${failure}: ${(cause as Error).message}`)
      } finally {
        setPending(job.id, false)
      }
    },
    [onChanged, setPending],
  )

  const create = useCallback(
    async (name: string) => {
      setError(null)
      setNotice(null)
      // Errors propagate to the caller rather than landing in `error`: they are
      // usually about the name, and belong beside the field that caused them.
      const job = await createJob(name)
      setNotice(`Created “${job.name}”.`)
      onCreated(job)
      return job
    },
    [onCreated],
  )

  const changeStatus = useCallback(
    (job: Job, status: StatusType) =>
      runForJob(
        job,
        () => updateJobStatus(job.id, status),
        `Set “${job.name}” to ${STATUS_LABELS[status]}.`,
        `Could not update “${job.name}”`,
      ),
    [runForJob],
  )

  const remove = useCallback(
    (job: Job) =>
      runForJob(
        job,
        () => deleteJob(job.id),
        `Deleted “${job.name}”.`,
        `Could not delete “${job.name}”`,
      ),
    [runForJob],
  )

  return {
    create,
    changeStatus,
    remove,
    pendingIds,
    error,
    notice,
    dismissError: useCallback(() => setError(null), []),
    dismissNotice: useCallback(() => setNotice(null), []),
  }
}
