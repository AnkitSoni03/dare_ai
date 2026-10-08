// Types and constants shared by the mock API and the client, so both sides
// agree on what a valid status / priority / sort field is.

export const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const CATEGORIES = ['billing', 'technical', 'account', 'feature', 'bug'] as const
export const SORT_FIELDS = ['id', 'subject', 'customer', 'status', 'priority', 'createdAt', 'updatedAt'] as const
export const PAGE_SIZES = [50, 100, 500, 1000] as const

export type Status = (typeof STATUSES)[number]
export type Priority = (typeof PRIORITIES)[number]
export type Category = (typeof CATEGORIES)[number]
export type SortField = (typeof SORT_FIELDS)[number]
export type SortOrder = 'asc' | 'desc'

export const CATEGORY_LABELS: Record<Category, string> = {
  billing: 'Billing',
  technical: 'Technical',
  account: 'Account',
  feature: 'Feature request',
  bug: 'Bug report',
}

export interface Ticket {
  id: string
  subject: string
  customer: string
  email: string
  status: Status
  priority: Priority
  category: Category
  assignee: string | null
  createdAt: string
  updatedAt: string
}

export interface TicketDetail extends Ticket {
  description: string
  messages: { author: string; body: string; sentAt: string }[]
}

export interface TicketQuery {
  q: string
  status: Status[]
  priority: Priority[]
  category: Category[]
  sort: SortField
  order: SortOrder
  page: number
  pageSize: number
}

export interface TicketPage {
  items: Ticket[]
  total: number
  page: number
  pageSize: number
}

export type StatusCounts = Record<Status, number>

export const DEFAULT_QUERY: TicketQuery = {
  q: '',
  status: [],
  priority: [],
  category: [],
  sort: 'updatedAt',
  order: 'desc',
  page: 1,
  pageSize: 100,
}

function pickList<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  const wanted = new Set(raw.split(','))
  // Keep the canonical order so ?status=open,closed and ?status=closed,open
  // produce the same cache key.
  return allowed.filter((v) => wanted.has(v))
}

function pickInt(raw: string | null, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(raw)
  if (!raw || !Number.isInteger(n) || n < min) return fallback
  return Math.min(n, max)
}

/** Parse URL params into a query. Unknown or malformed values fall back to defaults instead of throwing. */
export function parseTicketQuery(params: URLSearchParams): TicketQuery {
  const sort = params.get('sort') as SortField
  const pageSize = Number(params.get('pageSize'))
  return {
    q: (params.get('q') ?? '').trim().slice(0, 200),
    status: pickList(params.get('status'), STATUSES),
    priority: pickList(params.get('priority'), PRIORITIES),
    category: pickList(params.get('category'), CATEGORIES),
    sort: SORT_FIELDS.includes(sort) ? sort : DEFAULT_QUERY.sort,
    order: params.get('order') === 'asc' ? 'asc' : params.get('order') === 'desc' ? 'desc' : DEFAULT_QUERY.order,
    page: pickInt(params.get('page'), DEFAULT_QUERY.page, 1),
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_QUERY.pageSize,
  }
}

/** Serialize a query back to params, omitting defaults so URLs stay short and shareable. */
export function serializeTicketQuery(query: TicketQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status.length) params.set('status', query.status.join(','))
  if (query.priority.length) params.set('priority', query.priority.join(','))
  if (query.category.length) params.set('category', query.category.join(','))
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort)
  if (query.order !== DEFAULT_QUERY.order) params.set('order', query.order)
  if (query.page !== DEFAULT_QUERY.page) params.set('page', String(query.page))
  if (query.pageSize !== DEFAULT_QUERY.pageSize) params.set('pageSize', String(query.pageSize))
  return params
}
