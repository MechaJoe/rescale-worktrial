import { STATUS_TYPES } from '../api/types'
import type { Job, StatusType } from '../api/types'
import controls from '../styles/controls.module.css'

import styles from './JobActions.module.css'
import { STATUS_LABELS } from './statusLabels'

interface JobActionsProps {
  job: Job
  isPending: boolean
  onChangeStatus: (job: Job, status: StatusType) => void
  onDelete: (job: Job) => void
}

/**
 * Per-row actions: change status, and delete.
 *
 * The status control follows the AWS console's instance-state menu. Every
 * state is listed, but the one the job is already in is disabled and marked
 * current, so choosing it — which would append a meaningless duplicate to the
 * history — is not possible rather than silently ignored. The control resets
 * to its prompt after each choice, since it is a command, not a field holding
 * a value; the status column is where the value is shown.
 */
export function JobActions({ job, isPending, onChangeStatus, onDelete }: JobActionsProps) {
  return (
    <div className={styles.actions}>
      <select
        className={`${controls.field} ${styles.select}`}
        value=""
        onChange={(event) => onChangeStatus(job, event.target.value as StatusType)}
        disabled={isPending}
        aria-label={`Change status of ${job.name}`}
      >
        <option value="" disabled>
          {isPending ? 'Updating…' : 'Change status…'}
        </option>
        {STATUS_TYPES.map((status) => (
          <option key={status} value={status} disabled={status === job.status}>
            {status === job.status ? `${STATUS_LABELS[status]} (current)` : STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`${controls.button} ${controls.dangerQuiet} ${controls.small}`}
        onClick={() => onDelete(job)}
        disabled={isPending}
        aria-label={`Delete ${job.name}`}
      >
        Delete
      </button>
    </div>
  )
}
