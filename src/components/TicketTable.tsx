import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CATEGORY_LABELS, type Priority, type SortField, type SortOrder, type Status, type Ticket } from '../../shared/tickets'
import { capitalize, formatDate } from '../lib/format'
import { Avatar, PriorityIcon } from './Avatar'

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status}`}>
      <span className={`dot dot-${status}`} aria-hidden="true" />
      {capitalize(status)}
    </span>
  )
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className={`priority priority-${priority}`}>
      <PriorityIcon level={priority} />
      {capitalize(priority)}
    </span>
  )
}

export const ROW_HEIGHT = 50
const COLUMN_COUNT = 8

interface Column {
  label: string
  field?: SortField
}

const COLUMNS: Column[] = [
  { label: 'ID', field: 'id' },
  { label: 'Subject', field: 'subject' },
  { label: 'Customer', field: 'customer' },
  { label: 'Status', field: 'status' },
  { label: 'Priority', field: 'priority' },
  { label: 'Category' },
  { label: 'Assignee' },
  { label: 'Updated', field: 'updatedAt' },
]

interface TicketTableProps {
  sort: SortField
  order: SortOrder
  onSort: (field: SortField) => void
  /** Total matching rows across all pages, for aria-rowcount. */
  rowCount: number | undefined
  busy: boolean
  children: ReactNode
}

export function TicketTable({ sort, order, onSort, rowCount, busy, children }: TicketTableProps) {
  return (
    <div
      className="table"
      role="table"
      aria-label="Support tickets"
      aria-rowcount={rowCount === undefined ? -1 : rowCount + 1}
      aria-colcount={COLUMN_COUNT}
      aria-busy={busy}
    >
      <div role="rowgroup" className="table-head">
        <div role="row" aria-rowindex={1} className="table-row">
          {COLUMNS.map((col) => {
            const active = col.field === sort
            return (
              <div
                key={col.label}
                role="columnheader"
                className={`cell cell-${col.label.toLowerCase()}`}
                aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {col.field ? (
                  <button type="button" className="sort-button" onClick={() => onSort(col.field!)}>
                    {col.label}
                    <span className="sort-icon" aria-hidden="true">
                      {active ? (order === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </div>
            )
          })}
        </div>
      </div>
      {children}
    </div>
  )
}

/** A single full-width row used for loading / empty / error states, so the table stays valid ARIA. */
export function TableMessage({ children }: { children: ReactNode }) {
  return (
    <div role="rowgroup" className="table-body">
      <div role="row" className="table-message-row">
        <div role="cell" aria-colspan={COLUMN_COUNT} className="table-message">
          {children}
        </div>
      </div>
    </div>
  )
}

export function SkeletonRows() {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

interface TicketRowsProps {
  items: Ticket[]
  /** Index of the first item within the full result set (for aria-rowindex). */
  offset: number
  search: string
  onOpen: (id: string) => void
}

/**
 * Virtualized body: only the rows in (and just around) the viewport are in the
 * DOM, so a 1,000-row page scrolls as smoothly as a 50-row one.
 *
 * Keyboard: a single row is in the tab order (roving tabindex). Arrow keys,
 * Home/End and PageUp/PageDown move between rows, Enter opens the detail view.
 */
export function TicketRows({ items, offset, search, onOpen }: TicketRowsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const pendingFocus = useRef(false)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // After a keyboard move the target row may only be rendered once the
  // virtualizer has scrolled, so retry focusing it after every render.
  useEffect(() => {
    if (!pendingFocus.current) return
    const row = scrollRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    if (row) {
      row.focus({ preventScroll: true })
      pendingFocus.current = false
    }
  })

  function moveTo(index: number) {
    const next = Math.max(0, Math.min(items.length - 1, index))
    pendingFocus.current = true
    setActiveIndex(next)
    virtualizer.scrollToIndex(next, { align: 'auto' })
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!(e.target instanceof HTMLElement) || !e.target.matches('[role="row"]')) return
    const pageRows = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? ROW_HEIGHT * 10) / ROW_HEIGHT) - 1)
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveTo(activeIndex + 1),
      ArrowUp: () => moveTo(activeIndex - 1),
      Home: () => moveTo(0),
      End: () => moveTo(items.length - 1),
      PageDown: () => moveTo(activeIndex + pageRows),
      PageUp: () => moveTo(activeIndex - pageRows),
      Enter: () => onOpen(items[activeIndex].id),
      ' ': () => onOpen(items[activeIndex].id),
    }
    const action = keys[e.key]
    if (action) {
      e.preventDefault()
      action()
    }
  }

  return (
    <div role="rowgroup" className="table-body" ref={scrollRef} onKeyDown={onKeyDown}>
      <div role="presentation" style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((v) => (
          <TicketRow
            key={items[v.index].id}
            ticket={items[v.index]}
            index={v.index}
            rowIndex={offset + v.index + 2}
            start={v.start}
            active={v.index === activeIndex}
            search={search}
            onOpen={onOpen}
            onFocusRow={setActiveIndex}
          />
        ))}
      </div>
    </div>
  )
}

interface TicketRowProps {
  ticket: Ticket
  index: number
  rowIndex: number
  start: number
  active: boolean
  search: string
  onOpen: (id: string) => void
  onFocusRow: (index: number) => void
}

// Memoised so scrolling only renders rows entering the viewport, not every visible row.
const TicketRow = memo(function TicketRow({ ticket, index, rowIndex, start, active, search, onOpen, onFocusRow }: TicketRowProps) {
  return (
    <div
      role="row"
      className="table-row table-row-body"
      aria-rowindex={rowIndex}
      data-index={index}
      tabIndex={active ? 0 : -1}
      style={{ transform: `translateY(${start}px)`, height: ROW_HEIGHT }}
      onClick={() => onOpen(ticket.id)}
      onFocus={() => onFocusRow(index)}
    >
      <div role="cell" className="cell cell-id">
        {/* A real link so middle-click / "open in new tab" work; rows own keyboard focus. */}
        <Link
          to={{ pathname: `/tickets/${ticket.id}`, search }}
          state={{ fromList: true }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {ticket.id}
        </Link>
      </div>
      <div role="cell" className="cell cell-subject" title={ticket.subject}>
        {ticket.subject}
      </div>
      <div role="cell" className="cell cell-customer">
        <span className="person">
          <Avatar name={ticket.customer} />
          <span className="truncate">{ticket.customer}</span>
        </span>
      </div>
      <div role="cell" className="cell cell-status">
        <StatusBadge status={ticket.status} />
      </div>
      <div role="cell" className="cell cell-priority">
        <PriorityLabel priority={ticket.priority} />
      </div>
      <div role="cell" className="cell cell-category">
        <span className="category-tag">{CATEGORY_LABELS[ticket.category]}</span>
      </div>
      <div role="cell" className="cell cell-assignee">
        {ticket.assignee ? (
          <span className="person">
            <Avatar name={ticket.assignee} size={22} />
            <span className="truncate">{ticket.assignee}</span>
          </span>
        ) : (
          <span className="unassigned">Unassigned</span>
        )}
      </div>
      <div role="cell" className="cell cell-updated">
        <time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
      </div>
    </div>
  )
})
