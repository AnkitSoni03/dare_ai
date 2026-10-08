// One framework-agnostic handler (Web Request -> Response) shared by the
// Vercel functions in /api and the Vite dev-server middleware, so local and
// deployed behaviour are identical.
//
// Chaos: every request waits 200ms-3s and ~10% fail with a 500.
// Set MOCK_CHAOS=off to disable it while debugging.

import { parseTicketQuery } from '../shared/tickets.js'
import { getTicketDetail, tickets } from './db.js'
import { countByStatus, queryTickets } from './query.js'

const FAILURE_RATE = 0.1
const MIN_LATENCY = 200
const MAX_LATENCY = 3000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function chaosEnabled(): boolean {
  return process.env.MOCK_CHAOS !== 'off'
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  if (chaosEnabled()) {
    await sleep(MIN_LATENCY + Math.random() * (MAX_LATENCY - MIN_LATENCY))
    if (Math.random() < FAILURE_RATE) {
      return json({ error: 'Simulated server error' }, 500)
    }
  }

  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/api/tickets') {
    return json(queryTickets(tickets, parseTicketQuery(url.searchParams)))
  }
  if (path === '/api/stats') {
    return json(countByStatus(tickets, parseTicketQuery(url.searchParams)))
  }
  const match = path.match(/^\/api\/tickets\/([^/]+)$/)
  if (match) {
    const detail = getTicketDetail(decodeURIComponent(match[1]).toUpperCase())
    return detail ? json(detail) : json({ error: 'Ticket not found' }, 404)
  }
  return json({ error: 'Not found' }, 404)
}
