import type { StatusType } from '../api/types'

/**
 * Human-readable labels, so the UI never shows a raw enum value.
 *
 * Kept out of the component files: a module that exports both components and
 * plain values defeats Vite's fast refresh.
 */
export const STATUS_LABELS: Record<StatusType, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}
