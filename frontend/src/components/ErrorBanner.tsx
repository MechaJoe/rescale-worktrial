import styles from './ErrorBanner.module.css'

interface ErrorBannerProps {
  message: string | null
  onRetry?: () => void
}

/**
 * Surfaces an API failure.
 *
 * Rendered unconditionally with `aria-live` rather than mounted on demand, so a
 * screen reader announces a message that appears after the initial render — a
 * region added to the DOM at the same time as its content is not reliably
 * announced.
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div role="status" aria-live="polite" className={styles.region}>
      {message ? (
        <div className={styles.banner}>
          <span>{message}</span>
          {onRetry ? (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
