import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import controls from '../styles/controls.module.css'

import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A modal confirmation for destructive actions.
 *
 * Built on the native <dialog>, whose showModal() provides focus trapping,
 * inert page content and Escape-to-close without any of it being reimplemented
 * here. Cancel is placed first so it receives initial focus: pressing Enter on
 * an unexpected dialog should never be the destructive choice.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  // Keep the element's modal state in step with `open`. This synchronises with
  // the DOM rather than setting React state, which is what an effect is for.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let `open` drive closing, so React state stays the source of truth.
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <div className={styles.buttons}>
        <button type="button" className={controls.button} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={`${controls.button} ${controls.danger}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
