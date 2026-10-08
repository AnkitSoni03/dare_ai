// Server-side search / filter / sort / paginate over the in-memory dataset.

import {
  PRIORITIES,
  STATUSES,
  type StatusCounts,
  type Ticket,
  type TicketPage,
  type TicketQuery,
} from '../shared/tickets.js'

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i])) as Record<string, number>
const STATUS_RANK = Object.fromEntries(STATUSES.map((s, i) => [s, i])) as Record<string, number>

function matches(t: Ticket, q: TicketQuery, ignoreStatus = false): boolean {
  if (!ignoreStatus && q.status.length && !q.status.includes(t.status)) return false
  if (q.priority.length && !q.priority.includes(t.priority)) return false
  if (q.category.length && !q.category.includes(t.category)) return false
  if (q.q) {
    const needle = q.q.toLowerCase()
    return (
      t.id.toLowerCase().includes(needle) ||
      t.subject.toLowerCase().includes(needle) ||
      t.customer.toLowerCase().includes(needle) ||
      t.email.includes(needle)
    )
  }
  return true
}

function compare(a: Ticket, b: Ticket, field: TicketQuery['sort']): number {
  switch (field) {
    case 'priority':
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    case 'status':
      return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    default:
      return a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0
  }
}

export function queryTickets(all: Ticket[], q: TicketQuery): TicketPage {
  const dir = q.order === 'asc' ? 1 : -1
  const filtered = all
    .filter((t) => matches(t, q))
    // Tie-break on id so ordering is stable and pages never overlap or skip rows.
    .sort((a, b) => dir * compare(a, b, q.sort) || (a.id < b.id ? -1 : 1))
  const start = (q.page - 1) * q.pageSize
  return {
    items: filtered.slice(start, start + q.pageSize),
    total: filtered.length,
    page: q.page,
    pageSize: q.pageSize,
  }
}

/** Counts per status for the current search + other filters. The status filter itself is ignored, like a facet. */
export function countByStatus(all: Ticket[], q: TicketQuery): StatusCounts {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as StatusCounts
  for (const t of all) {
    if (matches(t, q, true)) counts[t.status]++
  }
  return counts
}








