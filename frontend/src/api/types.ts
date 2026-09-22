/** Types mirroring the Django API contract. */

export const STATUS_TYPES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const

export type StatusType = (typeof STATUS_TYPES)[number]

export interface Job {
  id: number
  name: string
  /** Null only for a job with no status history, which the API never creates. */
  status: StatusType | null
  created_at: string
  updated_at: string
}

export interface JobStatusEntry {
  id: number
  status_type: StatusType
  timestamp: string
}

export interface JobDetail extends Job {
  /** Newest entry first. */
  status_history: JobStatusEntry[]
}

/**
 * A page of a cursor-paginated list. The backend uses keyset pagination, so
 * there is deliberately no total count — only opaque links to adjacent pages.
 */
export interface CursorPage<T> {
  next: string | null
  previous: string | null
  results: T[]
}
