import { describe, expect, it } from 'vitest'
import { DEFAULT_QUERY } from '../shared/tickets'
import { tickets, TICKET_COUNT } from './db'
import { countByStatus, queryTickets } from './query'

describe('mock API query', () => {
  it('serves at least 10,000 records', () => {
    expect(tickets).toHaveLength(TICKET_COUNT)
    expect(TICKET_COUNT).toBeGreaterThanOrEqual(10_000)
  })

  it('pages through a sorted result with no overlaps or gaps', () => {
    const q = { ...DEFAULT_QUERY, status: ['open' as const], sort: 'priority' as const, pageSize: 1000 }
    const first = queryTickets(tickets, q)
    const seen = new Set<string>()
    for (let p = 1; p <= Math.ceil(first.total / q.pageSize); p++) {
      for (const t of queryTickets(tickets, { ...q, page: p }).items) seen.add(t.id)
    }
    expect(seen.size).toBe(first.total)
  })

  it('combines search with filters on the server', () => {
    const result = queryTickets(tickets, { ...DEFAULT_QUERY, q: 'REFUND', category: ['billing'], pageSize: 1000 })
    expect(result.total).toBeGreaterThan(0)
    for (const t of result.items) {
      expect(t.category).toBe('billing')
      expect(`${t.id} ${t.subject} ${t.customer} ${t.email}`.toLowerCase()).toContain('refund')
    }
  })

  it('status counts ignore the status filter itself (facet behaviour)', () => {
    const counts = countByStatus(tickets, { ...DEFAULT_QUERY, status: ['open'] })
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(TICKET_COUNT)
  })
})
