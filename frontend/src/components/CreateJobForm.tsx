import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError } from '../api/client'
import type { Job } from '../api/types'
import controls from '../styles/controls.module.css'

import styles from './CreateJobForm.module.css'

/**
 * Mirrors the backend's column length. Enforced by the input's `maxLength`,
 * which blocks typing and truncates pastes, so it needs no validation message.
 */
const MAX_NAME_LENGTH = 255

function validateName(name: string): string | null {
  return name.trim() === '' ? 'Enter a name for the job.' : null
}

interface CreateJobFormProps {
  onCreate: (name: string) => Promise<Job>
}

/**
 * Creates a job from a name.
 *
 * Validation runs on submit rather than on every keystroke, so an empty field
 * is not flagged before the user has tried anything. After a failed attempt it
 * re-validates as they type, so the message clears as soon as it is fixed.
 *
 * The submit button stays enabled when the field is empty: a disabled button
 * cannot explain itself, whereas submitting produces a message saying what is
 * wrong. Client-side checks are a courtesy — the server validates too, and its
 * errors are shown against the field in the same place.
 */
export function CreateJobForm({ onCreate }: CreateJobFormProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hasAttempted, setHasAttempted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputId = useId()
  const errorId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHasAttempted(true)

    const problem = validateName(name)
    setError(problem)
    if (problem) return

    setIsSubmitting(true)
    try {
      await onCreate(name.trim())
      setName('')
      setHasAttempted(false)
    } catch (cause) {
      const apiError = cause instanceof ApiError ? cause : null
      setError(apiError?.fieldErrors.name?.[0] ?? (cause as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleChange(value: string) {
    setName(value)
    if (hasAttempted) setError(validateName(value))
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className={styles.label}>
        New job
      </label>
      <div className={styles.row}>
        <input
          id={inputId}
          className={`${controls.field} ${styles.input}`}
          type="text"
          value={name}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="e.g. Fluid Dynamics Simulation"
          maxLength={MAX_NAME_LENGTH}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className={`${controls.button} ${controls.primary}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating…' : 'Create job'}
        </button>
      </div>
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
    </form>
  )
}
