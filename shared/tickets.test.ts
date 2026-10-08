import { describe, expect, it } from 'vitest'
import { DEFAULT_QUERY, parseTicketQuery, serializeTicketQuery } from './tickets'

describe('URL <-> query', () => {
  it('round-trips a full query', () => {
    const query = {
      q: 'refund',
      status: ['open' as const, 'pending' as const],
      priority: ['urgent' as const],
      category: ['billing' as const],
      sort: 'priority' as const,
      order: 'asc' as const,
      page: 3,
      pageSize: 500,
    }
    expect(parseTicketQuery(serializeTicketQuery(query))).toEqual(query)
  })

  it('omits defaults so shared URLs stay short', () => {
    expect(serializeTicketQuery(DEFAULT_QUERY).toString()).toBe('')
  })

  it('falls back to defaults for hand-edited or malformed params instead of crashing', () => {
    const parsed = parseTicketQuery(
      new URLSearchParams('status=open,bogus&sort=password&order=sideways&page=-4&pageSize=7&priority='),
    )
    expect(parsed).toEqual({ ...DEFAULT_QUERY, status: ['open'] })
  })

  it('normalises filter order so equivalent URLs share a cache entry', () => {
    const a = parseTicketQuery(new URLSearchParams('status=closed,open'))
    const b = parseTicketQuery(new URLSearchParams('status=open,closed'))
    expect(a).toEqual(b)
  })
})
