/**
 * State passed between pages through the router's history state.
 *
 * History state survives reloads and may have been written by an older build,
 * so everything here is validated on the way out rather than trusted.
 */

import { useEffect } from 'react'

/** A list view to return to: its URL, and the history state holding its page. */
export interface ReturnTo {
  pathname: string
  search: string
  state: unknown
}

/** Where a job's page was opened from, or null if it was reached directly. */
export function readReturnTo(state: unknown): ReturnTo | null {
  const from = (state as { from?: unknown } | null)?.from
  if (typeof from !== 'object' || from === null) return null
  const { pathname, search, state: fromState } = from as Record<string, unknown>
  if (typeof pathname !== 'string' || typeof search !== 'string') return null
  return { pathname, search, state: fromState }
}

/** A one-off message handed to a page on arrival, such as "Deleted …". */
export function readNotice(state: unknown): string | null {
  const notice = (state as { notice?: unknown } | null)?.notice
  return typeof notice === 'string' ? notice : null
}

/** Set the browser tab's title while a page is shown. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
