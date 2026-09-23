import type { Job, StatusType } from '../api/types'

import { JobActions } from './JobActions'
import { StatusBadge } from './StatusBadge'
import styles from './JobTable.module.css'

/** Absolute local time; the column is for correlating with logs, not for prose. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatTimestamp(iso: string): string {
  return TIMESTAMP_FORMAT.format(new Date(iso))
}

interface JobTableProps {
  jobs: Job[]
  isLoading: boolean
  hasError: boolean
  pendingIds: ReadonlySet<number>
  onChangeStatus: (job: Job, status: StatusType) => void
  onDelete: (job: Job) => void
}

function emptyMessage(isLoading: boolean, hasError: boolean): string {
  if (isLoading) return 'Loading jobs…'
  // Distinct from "no matches": an empty table after a failure says nothing
  // about whether jobs exist, and claiming none match would be false.
  if (hasError) return 'Jobs could not be loaded.'
  return 'No jobs match the current filter.'
}

export function JobTable({
  jobs,
  isLoading,
  hasError,
  pendingIds,
  onChangeStatus,
  onDelete,
}: JobTableProps) {
  if (jobs.length === 0) {
    return <p className={styles.empty}>{emptyMessage(isLoading, hasError)}</p>
  }

  return (
    // The wrapper scrolls horizontally so the table keeps its columns on a
    // narrow screen rather than forcing the page to scroll sideways.
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.caption}>Jobs, most recently created first</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.idColumn}>
              ID
            </th>
            <th scope="col">Name</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Updated</th>
            <th scope="col" className={styles.actionsColumn}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody aria-busy={isLoading}>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td className={styles.idColumn}>{job.id}</td>
              <td className={styles.nameCell}>{job.name}</td>
              <td>
                <StatusBadge status={job.status} />
              </td>
              <td className={styles.timestamp}>{formatTimestamp(job.created_at)}</td>
              <td className={styles.timestamp}>{formatTimestamp(job.updated_at)}</td>
              <td>
                <JobActions
                  job={job}
                  isPending={pendingIds.has(job.id)}
                  onChangeStatus={onChangeStatus}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
