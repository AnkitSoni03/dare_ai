import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { serializeTicketQuery, type SortField } from '../../shared/tickets'
import { FilterBar } from '../components/FilterBar'
import { Pagination } from '../components/Pagination'
import { SearchBox } from '../components/SearchBox'
import { StatusCards } from '../components/StatusCards'
import { SkeletonRows, TableMessage, TicketRows, TicketTable } from '../components/TicketTable'
import { useTicketQuery } from '../hooks/useTicketQuery'
import { plural } from '../lib/format'
import { errorMessage, statusCountsQuery, ticketsQuery } from '../lib/queries'

// Sorting a column for the first time: dates newest first, everything else A→Z / low→high.
const DEFAULT_ORDER: Partial<Record<SortField, 'asc' | 'desc'>> = { updatedAt: 'desc', createdAt: 'desc' }

export function ExplorerPage() {
  const { query, search, update } = useTicketQuery()
  const navigate = useNavigate()

  // Deliberately no `placeholderData: keepPreviousData`: while a new query loads
  // we show a loading state rather than old rows that no longer match the filters.
  const list = useQuery(ticketsQuery(query))
  const counts = useQuery(statusCountsQuery(query))

  const openTicket = useCallback(
    (id: string) => navigate({ pathname: `/tickets/${id}`, search }, { state: { fromList: true } }),
    [navigate, search],
  )

  const onSort = (field: SortField) => {
    if (field === query.sort) update({ order: query.order === 'asc' ? 'desc' : 'asc' })
    else update({ sort: field, order: DEFAULT_ORDER[field] ?? 'asc' })
  }

  const data = list.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : undefined
  const hasFilters = Boolean(query.q || query.status.length || query.priority.length || query.category.length)

  let body
  let announcement = ''
  if (list.isError) {
    body = (
      <TableMessage>
        <div className="state state-error" role="alert">
          <h2 className="state-title">Couldn't load tickets</h2>
          <p>{errorMessage(list.error)} Nothing shown here is out of date: results appear only once they load.</p>
          <button type="button" className="button button-primary" onClick={() => list.refetch()} disabled={list.isFetching}>
            {list.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      </TableMessage>
    )
  } else if (!data) {
    announcement = 'Loading tickets…'
    body = (
      <TableMessage>
        <span className="sr-only">Loading tickets…</span>
        <SkeletonRows />
      </TableMessage>
    )
  } else if (data.total === 0) {
    announcement = 'No tickets match your search and filters.'
    body = (
      <TableMessage>
        <div className="state">
          <h2 className="state-title">No tickets found</h2>
          <p>{query.q ? <>Nothing matches “{query.q}” with the current filters.</> : 'No tickets match the current filters.'}</p>
          {hasFilters && (
            <button type="button" className="button" onClick={() => update({ q: '', status: [], priority: [], category: [] })}>
              Clear search and filters
            </button>
          )}
        </div>
      </TableMessage>
    )
  } else if (data.items.length === 0) {
    announcement = `Page ${query.page} does not exist.`
    body = (
      <TableMessage>
        <div className="state">
          <h2 className="state-title">Page {query.page} doesn't exist</h2>
          <p>There {pages === 1 ? 'is only 1 page' : `are only ${pages} pages`} for these results.</p>
          <button type="button" className="button" onClick={() => update({ page: pages })}>
            Go to the last page
          </button>
        </div>
      </TableMessage>
    )
  } else {
    announcement = `${plural(data.total, 'ticket')} found. Page ${query.page} of ${pages}.`
    // Keyed on the query so a new search / page starts at the top with fresh
    // keyboard focus, while opening and closing the detail drawer keeps scroll.
    body = (
      <TicketRows
        key={serializeTicketQuery(query).toString()}
        items={data.items}
        offset={(query.page - 1) * query.pageSize}
        search={search}
        onOpen={openTicket}
      />
    )
  }

  return (
    <>
      <div className={`fetch-indicator${list.isFetching || counts.isFetching ? ' is-active' : ''}`} aria-hidden="true" />
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Ticket Explorer home">
            <span className="brand-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="brand-name">Ticket Explorer</span>
          </a>
          <p className="api-pill" title="Every request waits 200 ms–3 s and about 1 in 10 fail on purpose">
            <span className={`api-dot${list.isFetching ? ' is-busy' : ''}`} aria-hidden="true" />
            Mock API · 200 ms–3 s latency · ~10% failures
          </p>
        </div>
      </header>

      <div className="page">
        <div className="page-header">
          <h1>Support tickets</h1>
          <p className="muted">Search, filter and sort 10,000 tickets. Every view is a shareable link.</p>
        </div>

        <StatusCards
          selected={query.status}
          onChange={(status) => update({ status })}
          counts={{ data: counts.data, isError: counts.isError, isFetching: counts.isFetching, retry: () => counts.refetch() }}
        />

        <section className="toolbar" aria-label="Search and filters">
          <SearchBox value={query.q} onCommit={(q, { replace }) => update({ q }, { replace })} />
          <FilterBar query={query} onChange={update} />
        </section>

        <main className="results">
          {/* On narrow screens the table keeps every column and scrolls sideways
              (header and rows together) instead of hiding data. */}
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Ticket table, scrolls horizontally on small screens">
            <TicketTable sort={query.sort} order={query.order} onSort={onSort} rowCount={data?.total} busy={list.isFetching}>
              {body}
            </TicketTable>
          </div>
          <p className="scroll-hint" aria-hidden="true">
            Swipe sideways to see all columns →
          </p>
          <Pagination
            page={query.page}
            pageSize={query.pageSize}
            total={list.isError ? undefined : data?.total}
            failed={list.isError}
            onPage={(page) => update({ page })}
            onPageSize={(pageSize) => update({ pageSize })}
          />
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
        </main>

        <Outlet />
      </div>
    </>
  )
}
