import type { StatusType } from '../api/types'

import styles from './StatusBadge.module.css'
import { STATUS_LABELS } from './statusLabels'

interface StatusBadgeProps {
  status: StatusType | null
}

/**
 * A job's status as a coloured pill.
 *
 * The label is always rendered as text, never conveyed by colour alone, so the
 * badge still reads for colour-blind users and in greyscale.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === null) {
    return <span className={styles.unknown}>Unknown</span>
  }

  return (
    <span className={`${styles.badge} ${styles[status.toLowerCase()]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  )
}
