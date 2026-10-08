import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { vi } from 'vitest'
import type { Ticket, TicketPage } from '../../shared/tickets'
import { App, routes } from '../App'
import { createQueryClient } from '../lib/queries'

export interface PendingRequest {
  url: URL
  signal: AbortSignal | undefined
  respond: (body: unknown, status?: number) => void
}

/**
 * Replaces fetch with one whose responses the test resolves by hand, in any
 * order. That is what lets us reproduce "slow old response arrives last".
 */
export function installManualFetch() {
  const requests: PendingRequest[] = []
  const fetchMock = vi.fn(
    (input: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init?.signal ?? undefined
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        requests.push({
          url: new URL(input, 'http://localhost'),
          signal,
          respond: (body, status = 200) =>
            resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })),
        })
      }),
  )
  vi.stubGlobal('fetch', fetchMock)

  return {
    requests,
    /** Requests to a path, optionally filtered by a search param value. */
    to(path: string, params: Record<string, string> = {}) {
      return requests.filter(
        (r) => r.url.pathname === path && Object.entries(params).every(([k, v]) => r.url.searchParams.get(k) === v),
      )
    },
  }
}

export function makeTicket(n: number, overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: `TCK-${String(n).padStart(5, '0')}`,
    subject: `Ticket number ${n}`,
    customer: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    status: 'open',
    priority: 'medium',
    category: 'billing',
    assignee: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    ...overrides,
  }
}

export function page(items: Ticket[], total = items.length, pageNumber = 1, pageSize = 100): TicketPage {
  return { items, total, page: pageNumber, pageSize }
}

export function renderApp(initialUrl = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialUrl] })
  const queryClient = createQueryClient()
  const utils = render(<App router={router} queryClient={queryClient} />)
  return { ...utils, router, queryClient }
}
