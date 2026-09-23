import styles from './Banner.module.css'

interface BannerAction {
  label: string
  onClick: () => void
}

interface BannerProps {
  tone: 'error' | 'success'
  message: string | null
  action?: BannerAction
  onDismiss?: () => void
}

/**
 * A one-line message about the outcome of a request.
 *
 * The live region is rendered unconditionally and only its content changes, so
 * a screen reader announces a message that appears after the initial render —
 * a region inserted into the DOM together with its content is not reliably
 * announced. Errors use `alert` so they interrupt; confirmations use `status`,
 * which waits its turn.
 */
export function Banner({ tone, message, action, onDismiss }: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={styles.region}
    >
      {message ? (
        <div className={`${styles.banner} ${styles[tone]}`}>
          <span className={styles.message}>{message}</span>
          {action ? (
            <button type="button" className={styles.button} onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className={styles.dismiss}
              onClick={onDismiss}
              aria-label="Dismiss message"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
