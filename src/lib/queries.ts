import { QueryClient, queryOptions } from '@tanstack/react-query'
import type { TicketQuery } from '../../shared/tickets'
import { ApiError, fetchStatusCounts, fetchTicket, fetchTickets } from './api'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No silent auto-retry: with a 10% failure rate the user should see the
        // failure and choose to retry, rather than wait through hidden backoff.
        retry: false,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

// Each distinct query gets its own cache entry, so a slow response for an old
// search can only ever write into the old entry, never into what is on screen.
// The AbortSignal additionally cancels the in-flight request once nobody observes it.
export const ticketsQuery = (query: TicketQuery) =>
  queryOptions({
    queryKey: ['tickets', query],
    queryFn: ({ signal }) => fetchTickets(query, signal),
  })

export const statusCountsQuery = ({ q, priority, category }: TicketQuery) =>
  queryOptions({
    queryKey: ['status-counts', { q, priority, category }],
    queryFn: ({ signal }) => fetchStatusCounts({ q, priority, category }, signal),
  })

export const ticketQuery = (id: string) =>
  queryOptions({
    queryKey: ['ticket', id],
    queryFn: ({ signal }) => fetchTicket(id, signal),
  })

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.message
    if (error.status >= 500) return 'The server had a problem loading this data.'
    return error.message
  }
  return 'Something went wrong.'
}
