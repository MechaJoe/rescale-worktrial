/**
 * Thin typed wrapper over the jobs API.
 *
 * Requests go to the relative path `/api`, which the Vite dev server and the
 * production nginx image both proxy to Django, so the app is same-origin
 * everywhere and never needs a build-time backend URL.
 */

import type { CursorPage, Job, JobDetail, StatusType } from './types'

const API_ROOT = '/api'

/** Field-keyed validation messages, as returned by DRF. */
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  // Declared as fields rather than constructor parameter properties, which
  // `erasableSyntaxOnly` forbids: they emit runtime code instead of erasing.
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(message: string, status: number, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/**
 * Turn a DRF error body into a readable message plus per-field detail.
 *
 * DRF is not consistent here: it returns `{detail: "..."}` for routing and
 * permission errors, and `{field: ["..."], ...}` for validation, where a value
 * may be a string or a list of them.
 */
function parseErrorBody(body: unknown, status: number): ApiError {
  if (typeof body !== 'object' || body === null) {
    return new ApiError(`Request failed (${status}).`, status)
  }

  const entries = Object.entries(body as Record<string, unknown>)
  const fieldErrors: FieldErrors = {}
  for (const [key, value] of entries) {
    fieldErrors[key] = Array.isArray(value) ? value.map(String) : [String(value)]
  }

  const detail = fieldErrors.detail?.[0]
  const firstField = entries.length > 0 ? fieldErrors[entries[0][0]][0] : undefined
  return new ApiError(detail ?? firstField ?? `Request failed (${status}).`, status, fieldErrors)
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch only rejects on network-level failure, so this is the offline or
    // server-unreachable case rather than an HTTP error status.
    throw new ApiError('Could not reach the server. Is the backend running?', 0)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw parseErrorBody(body, response.status)
  }

  // 204 No Content, as returned by DELETE.
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export interface ListJobsOptions {
  status?: StatusType | null
  /** An opaque `next`/`previous` URL from a previous page. */
  cursor?: string | null
  pageSize?: number
}

export function listJobs({ status, cursor, pageSize }: ListJobsOptions = {}) {
  if (cursor) {
    // Follow the server's own link rather than rebuilding it; it already
    // carries the cursor and any filter that produced this page.
    return request<CursorPage<Job>>(cursor)
  }

  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (pageSize) params.set('page_size', String(pageSize))
  const query = params.toString()

  return request<CursorPage<Job>>(`${API_ROOT}/jobs/${query ? `?${query}` : ''}`)
}

export function getJob(id: number) {
  return request<JobDetail>(`${API_ROOT}/jobs/${id}/`)
}

export function createJob(name: string) {
  return request<Job>(`${API_ROOT}/jobs/`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updateJobStatus(id: number, status: StatusType) {
  return request<Job>(`${API_ROOT}/jobs/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteJob(id: number) {
  return request<void>(`${API_ROOT}/jobs/${id}/`, { method: 'DELETE' })
}
