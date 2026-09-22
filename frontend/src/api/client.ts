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

  constructor(
    message: string,
    status: number,
    fieldErrors: FieldErrors = {},
    options?: ErrorOptions,
  ) {
    super(message, options)
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

/** Perform the request, translating transport and HTTP failures into ApiError. */
async function send(url: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (cause) {
    // fetch only rejects on network-level failure, so this is the offline or
    // server-unreachable case rather than an HTTP error status. The original
    // error is kept as `cause` so a DNS failure stays distinguishable from a
    // TLS one when debugging.
    throw new ApiError('Could not reach the server. Is the backend running?', 0, {}, { cause })
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw parseErrorBody(body, response.status)
  }
  return response
}

/** Request an endpoint that returns a JSON body. */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await send(url, init)
  return (await response.json()) as T
}

/**
 * Request an endpoint that returns no body, such as a 204 from DELETE.
 *
 * Kept separate from `request` so that no caller can ask for a typed body from
 * a response that has none — which `request` could only satisfy by casting
 * `undefined` to the requested type.
 */
async function requestNoContent(url: string, init?: RequestInit): Promise<void> {
  await send(url, init)
}

/**
 * Either describe a first page, or follow a cursor — never both.
 *
 * A cursor URL already encodes the filter and page size that produced it, so
 * passing them alongside would silently do nothing. The `never` members make
 * that combination a type error rather than a surprise at runtime.
 */
export type ListJobsOptions =
  | { cursor: string; status?: never; pageSize?: never }
  | { cursor?: never; status?: StatusType | null; pageSize?: number }

export function listJobs(options: ListJobsOptions = {}) {
  if (options.cursor) {
    // Follow the server's own link rather than rebuilding it.
    return request<CursorPage<Job>>(options.cursor)
  }

  const params = new URLSearchParams()
  if (options.status) params.set('status', options.status)
  if (options.pageSize) params.set('page_size', String(options.pageSize))
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
  return requestNoContent(`${API_ROOT}/jobs/${id}/`, { method: 'DELETE' })
}
