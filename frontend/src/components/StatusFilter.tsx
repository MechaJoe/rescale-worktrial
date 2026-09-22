import { STATUS_TYPES } from '../api/types'
import type { StatusType } from '../api/types'

import styles from './StatusFilter.module.css'
import { STATUS_LABELS } from './statusLabels'

interface StatusFilterProps {
  value: StatusType | null
  onChange: (status: StatusType | null) => void
  disabled?: boolean
}

/**
 * Status tabs, filtered server-side.
 *
 * Filtering never happens in the browser: a page holds at most `pageSize` rows,
 * so a client-side filter would only narrow the current page and would look
 * broken the moment there is more than one.
 *
 * The tabs carry no counts, deliberately — a count per status means either a
 * COUNT(*) per request, which keyset pagination exists to avoid, or a rollup
 * table the backend does not yet maintain.
 */
export function StatusFilter({ value, onChange, disabled = false }: StatusFilterProps) {
  const options: Array<{ key: string; label: string; status: StatusType | null }> = [
    { key: 'ALL', label: 'All', status: null },
    ...STATUS_TYPES.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      status,
    })),
  ]

  return (
    <div className={styles.tabs} role="tablist" aria-label="Filter jobs by status">
      {options.map(({ key, label, status }) => {
        const selected = value === status
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? `${styles.tab} ${styles.selected}` : styles.tab}
            onClick={() => onChange(status)}
            disabled={disabled}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
