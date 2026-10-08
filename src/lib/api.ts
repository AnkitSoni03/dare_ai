import {
  serializeTicketQuery,
  type StatusCounts,
  type TicketDetail,
  type TicketPage,
  type TicketQuery,
} from '../../shared/tickets'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  } catch (error) {
    // Let aborts propagate untouched; React Query treats them as cancellations, not failures.
    if (signal?.aborted) throw error
    throw new ApiError(0, 'Network error. Check your connection and try again.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(response.status, body?.error ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export function fetchTickets(query: TicketQuery, signal?: AbortSignal) {
  return getJson<TicketPage>(`/api/tickets?${serializeTicketQuery(query)}`, signal)
}

/** Facet counts only depend on search + the non-status filters. */
export function fetchStatusCounts(query: Pick<TicketQuery, 'q' | 'priority' | 'category'>, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.priority.length) params.set('priority', query.priority.join(','))
  if (query.category.length) params.set('category', query.category.join(','))
  return getJson<StatusCounts>(`/api/stats?${params}`, signal)
}

export function fetchTicket(id: string, signal?: AbortSignal) {
  return getJson<TicketDetail>(`/api/tickets/${encodeURIComponent(id)}`, signal)
}
