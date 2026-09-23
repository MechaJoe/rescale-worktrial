import { useCallback, useEffect, useState } from 'react'

import { listJobs } from '../api/client'
import type { CursorPage, Job, StatusType } from '../api/types'

export const DEFAULT_PAGE_SIZE = 25

export interface UseJobsResult {
  jobs: Job[]
  status: StatusType | null
  setStatus: (status: StatusType | null) => void
  isLoading: boolean
  error: string | null
  hasNext: boolean
  hasPrevious: boolean
  goToNext: () => void
  goToPrevious: () => void
  reload: () => void
  showNewJob: (status: StatusType | null) => void
}

/**
 * Where the user is in the list: the cursor for the page in view (null for the
 * first page), and the cursors of the pages they came through to reach it.
 *
 * Kept as one value so that moving between pages updates both together.
 */
interface Position {
  cursor: string | null
  history: Array<string | null>
}

const FIRST_PAGE: Position = { cursor: null, history: [] }

/** The position one page back, or the first page if there is nowhere to go. */
function stepBack({ history }: Position): Position {
  if (history.length === 0) return FIRST_PAGE
  return { cursor: history[history.length - 1], history: history.slice(0, -1) }
}

/**
 * Loads one page of jobs, and owns the filter and position that identify it.
 *
 * Paging is keyset-based, so a page is addressed by an opaque cursor from the
 * server rather than by an offset. The server is therefore the only thing that
 * knows which jobs belong on the current page, which is why every refresh goes
 * back to it rather than adjusting a local copy.
 *
 * Going forward follows the server's `next` link. Going back does *not* follow
 * its `previous` link: it returns to the cursor that produced the earlier page.
 * The two agree for a populated page, but not for one that a delete has just
 * emptied — DRF then anchors `previous` on the cursor position itself, which
 * is the last row of the page before, and reverse paging excludes its anchor.
 * Following it drops that row, landing on a page one short with the missing
 * job stranded alone on the page after. Replaying our own history cannot.
 *
 * Loading and error state are derived from which request last settled, rather
 * than set when a request starts. That keeps every state update inside an
 * async callback, and lets rows be tied to the view that produced them.
 */
export function useJobs(pageSize: number = DEFAULT_PAGE_SIZE): UseJobsResult {
  const [status, setStatusState] = useState<StatusType | null>(null)
  const [position, setPosition] = useState<Position>(FIRST_PAGE)
  const [reloadCount, setReloadCount] = useState(0)

  const [loaded, setLoaded] = useState<{ viewKey: string; page: CursorPage<Job> } | null>(null)
  const [failure, setFailure] = useState<{ requestKey: string; message: string } | null>(null)
  const [settledKey, setSettledKey] = useState<string | null>(null)

  const { cursor } = position

  // A view is what is being looked at; a request is one attempt to load it.
  // Reloading the same view is a new request for an unchanged view.
  const viewKey = JSON.stringify([status, cursor, pageSize])
  const requestKey = `${viewKey}#${reloadCount}`

  useEffect(() => {
    // Guards against a slower earlier request resolving after a newer one and
    // overwriting it — reachable by clicking through filters quickly, and by
    // StrictMode's double-invoked effects in development.
    let cancelled = false

    const pending = cursor ? listJobs({ cursor }) : listJobs({ status, pageSize })
    pending
      .then((page) => {
        if (cancelled) return
        // A delete, or a status change under a filter, can empty a page past
        // the first. Rather than show an empty table with jobs still behind
        // it, step back; the request stays unsettled until that page arrives.
        if (page.results.length === 0 && cursor !== null) {
          setPosition(stepBack)
          return
        }
        setLoaded({ viewKey, page })
        setFailure(null)
        setSettledKey(requestKey)
      })
      .catch((cause: Error) => {
        if (cancelled) return
        setFailure({ requestKey, message: cause.message })
        setSettledKey(requestKey)
      })

    return () => {
      cancelled = true
    }
  }, [status, cursor, pageSize, viewKey, requestKey])

  const isLoading = settledKey !== requestKey
  const error = failure?.requestKey === requestKey ? failure.message : null

  // Rows from a previous view are kept only while their replacement loads, so
  // the table dims rather than flashing empty. Once a new view has failed they
  // are dropped: shown beside the error, they would read as belonging to the
  // filter the user just chose. A failed reload of the *same* view keeps them,
  // since they are still the right rows, just possibly stale.
  const page = loaded && (loaded.viewKey === viewKey || isLoading) ? loaded.page : null

  const setStatus = useCallback((next: StatusType | null) => {
    setStatusState(next)
    // A cursor encodes the filter that produced it, so it is meaningless under
    // a different one. Changing the filter returns to the first page.
    setPosition(FIRST_PAGE)
  }, [])

  /**
   * Re-fetch the page currently in view.
   *
   * TODO: mutations currently trigger a full page re-fetch. That keeps the list
   * correct by construction — under keyset pagination and a server-side filter,
   * only the server knows whether a mutated job still belongs on this page, and
   * reproducing those rules client-side would duplicate logic that can drift.
   * The cost is a round trip per mutation. If that ever becomes noticeable,
   * replace it with an optimistic local update plus reconciliation, which needs
   * client-side filter/ordering rules and rollback on failure.
   */
  const reload = useCallback(() => setReloadCount((count) => count + 1), [])

  /**
   * Bring a newly created job into view.
   *
   * New jobs sort first, so they appear on the first page — unless a filter
   * excludes their status, in which case the filter is cleared rather than
   * leaving the user to wonder where their job went.
   */
  const showNewJob = useCallback((jobStatus: StatusType | null) => {
    setStatusState((current) => (current === null || current === jobStatus ? current : null))
    setPosition(FIRST_PAGE)
    // Also needed when already on an unfiltered first page, where neither of
    // the above changes anything and the fetch would not otherwise re-run.
    setReloadCount((count) => count + 1)
  }, [])

  const nextCursor = page?.next ?? null

  const goToNext = useCallback(() => {
    if (nextCursor === null) return
    setPosition((current) => ({
      cursor: nextCursor,
      history: [...current.history, current.cursor],
    }))
  }, [nextCursor])

  const goToPrevious = useCallback(() => setPosition(stepBack), [])

  return {
    jobs: page?.results ?? [],
    status,
    setStatus,
    isLoading,
    error,
    hasNext: nextCursor !== null,
    hasPrevious: cursor !== null,
    goToNext,
    goToPrevious,
    reload,
    showNewJob,
  }
}
