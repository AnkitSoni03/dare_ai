// Deterministic fake dataset. A seeded PRNG means every serverless cold start
// (and every local run) produces the exact same 10,000 tickets, so shared links
// and deep links to a ticket id always resolve to the same record.

import {
  CATEGORIES,
  type Category,
  type Priority,
  type Status,
  type Ticket,
  type TicketDetail,
} from '../shared/tickets.js'

export const TICKET_COUNT = 10_000

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Kavya', 'Rahul', 'Isha', 'Liam', 'Emma', 'Noah', 'Olivia', 'Mateo', 'Sofia', 'Kenji', 'Yuki', 'Omar', 'Layla', 'Lucas', 'Chloe', 'Ethan', 'Zara']
const LAST = ['Sharma', 'Verma', 'Gupta', 'Iyer', 'Nair', 'Reddy', 'Mehta', 'Kapoor', 'Singh', 'Das', 'Smith', 'Garcia', 'Muller', 'Rossi', 'Tanaka', 'Haddad', 'Silva', 'Brown', 'Khan', 'Chen']
const AGENTS = ['Aditi Rao', 'Karan Malhotra', 'Neha Joshi', 'Sam Patel', 'Maria Lopez', 'Tom Becker']
const SUBJECTS: Record<Category, string[]> = {
  billing: ['Charged twice for {plan} plan', 'Invoice missing GST number', 'Refund not received after cancellation', 'Card declined on renewal', 'Need invoice for {month}', 'Upgrade to {plan} not reflected'],
  technical: ['Dashboard not loading on Safari', 'API returns 502 intermittently', 'Webhook deliveries delayed', 'CSV export times out', 'SSO login loop', 'Rank tracker stuck at 0%'],
  account: ['Cannot reset password', 'Add teammate to workspace', 'Change account owner email', 'Delete my account and data', '2FA codes not arriving', 'Merge two workspaces'],
  feature: ['Support for Perplexity citations report', 'Bulk edit for tracked prompts', 'Slack alerts for visibility drops', 'Dark mode for reports', 'White-label PDF exports', 'Compare brands across Gemini and ChatGPT'],
  bug: ['Chart tooltip shows wrong date', 'Filters reset after refresh', 'Duplicate rows in keyword table', 'Timezone off by one day', 'Search ignores accented names', 'Pagination skips page {n}'],
}
const PLANS = ['Starter', 'Growth', 'Agency', 'Enterprise']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September']
const STATUS_WEIGHTS: [Status, number][] = [['open', 0.3], ['pending', 0.2], ['resolved', 0.3], ['closed', 0.2]]
const PRIORITY_WEIGHTS: [Priority, number][] = [['low', 0.35], ['medium', 0.35], ['high', 0.2], ['urgent', 0.1]]

function weighted<T>(rand: () => number, weights: [T, number][]): T {
  let r = rand()
  for (const [value, w] of weights) {
    if ((r -= w) <= 0) return value
  }
  return weights[weights.length - 1][0]
}

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]
}

// Fixed "now" so dates are stable across runs instead of drifting with the clock.
const NOW = Date.UTC(2026, 9, 1)
const DAY = 86_400_000

function buildTickets(): Ticket[] {
  const rand = mulberry32(20261008)
  const tickets: Ticket[] = []
  for (let i = 1; i <= TICKET_COUNT; i++) {
    const first = pick(rand, FIRST)
    const last = pick(rand, LAST)
    const category = pick(rand, CATEGORIES)
    const subject = pick(rand, SUBJECTS[category])
      .replace('{plan}', pick(rand, PLANS))
      .replace('{month}', pick(rand, MONTHS))
      .replace('{n}', String(2 + Math.floor(rand() * 40)))
    const status = weighted(rand, STATUS_WEIGHTS)
    const created = NOW - Math.floor(rand() * 365 * DAY)
    const updated = Math.min(NOW, created + Math.floor(rand() * 30 * DAY))
    tickets.push({
      id: `TCK-${String(i).padStart(5, '0')}`,
      subject,
      customer: `${first} ${last}`,
      email: `${first}.${last}${i % 97}@example.com`.toLowerCase(),
      status,
      priority: weighted(rand, PRIORITY_WEIGHTS),
      category,
      assignee: status === 'open' && rand() < 0.4 ? null : pick(rand, AGENTS),
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(updated).toISOString(),
    })
  }
  return tickets
}

export const tickets: Ticket[] = buildTickets()
const byId = new Map(tickets.map((t) => [t.id, t]))

/** Detail fields are generated on demand from the id, so the list payload stays small. */
export function getTicketDetail(id: string): TicketDetail | undefined {
  const ticket = byId.get(id)
  if (!ticket) return undefined
  const rand = mulberry32(Number(id.slice(4)) * 7919)
  const count = 1 + Math.floor(rand() * 4)
  const start = Date.parse(ticket.createdAt)
  const step = (Date.parse(ticket.updatedAt) - start) / count
  const messages = Array.from({ length: count }, (_, i) => {
    const fromCustomer = i % 2 === 0
    return {
      author: fromCustomer ? ticket.customer : (ticket.assignee ?? 'Support bot'),
      body: fromCustomer
        ? pick(rand, ['Any update on this?', 'This is blocking our weekly report.', 'Attaching a screenshot of the issue.', 'Thanks, that worked partially.'])
        : pick(rand, ['Thanks for reaching out, looking into it now.', 'Could you share the workspace URL?', 'We have pushed a fix, please verify.', 'Escalated to the engineering team.']),
      sentAt: new Date(start + step * i).toISOString(),
    }
  })
  return {
    ...ticket,
    description: `${ticket.customer} reported: "${ticket.subject}". Category: ${ticket.category}. Priority set to ${ticket.priority}.`,
    messages,
  }
}
