import type { JobStatusEntry } from '../api/types'
import { formatTimestamp } from '../lib/format'

import { StatusBadge } from './StatusBadge'
import styles from './StatusHistory.module.css'

interface StatusHistoryProps {
  /** Newest first, as the API returns them. */
  entries: JobStatusEntry[]
}

/**
 * A job's status history as a timeline, newest first.
 *
 * An ordered list, because the order is the information: each entry is a
 * transition that followed the one below it. The newest is marked as current,
 * which it always is — `current_status` is derived from exactly this entry.
 */
export function StatusHistory({ entries }: StatusHistoryProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>No status changes recorded.</p>
  }

  return (
    <ol className={styles.timeline} aria-label="Status history, newest first">
      {entries.map((entry, index) => (
        <li key={entry.id} className={styles.entry}>
          <span className={styles.marker} aria-hidden="true" />
          <StatusBadge status={entry.status_type} />
          <time className={styles.time} dateTime={entry.timestamp}>
            {formatTimestamp(entry.timestamp)}
          </time>
          {index === 0 ? <span className={styles.current}>Current</span> : null}
        </li>
      ))}
    </ol>
  )
}
