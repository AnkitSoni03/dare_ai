import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installManualFetch, makeTicket, page, renderApp } from './utils'

const statusCounts = { open: 1, pending: 0, resolved: 0, closed: 0 }

function bodyRows() {
  return screen.queryAllByRole('row').filter((row) => row.hasAttribute('data-index'))
}

describe('ticket explorer', () => {
  it('never lets a slow, superseded response overwrite newer results', async () => {
    const server = installManualFetch()
    const user = userEvent.setup()
    renderApp('/')

    await waitFor(() => expect(server.to('/api/tickets')).toHaveLength(1))
    act(() => server.to('/api/tickets')[0].respond(page([makeTicket(1)])))
    expect(await screen.findByText('Ticket number 1')).toBeInTheDocument()

    const search = screen.getByLabelText('Search tickets')

    // First search goes out...
    await user.type(search, 'ref')
    await waitFor(() => expect(server.to('/api/tickets', { q: 'ref' })).toHaveLength(1))
    const slowOld = server.to('/api/tickets', { q: 'ref' })[0]

    // ...the user keeps typing before it returns, so a second search goes out.
    await user.type(search, 'und')
    await waitFor(() => expect(server.to('/api/tickets', { q: 'refund' })).toHaveLength(1))
    const fastNew = server.to('/api/tickets', { q: 'refund' })[0]

    // The superseded request is cancelled at the network level.
    expect(slowOld.signal?.aborted).toBe(true)

    // Newer response arrives first, then the old one finally lands.
    act(() => fastNew.respond(page([makeTicket(2, { subject: 'Refund not received' })])))
    expect(await screen.findByText('Refund not received')).toBeInTheDocument()
    act(() => slowOld.respond(page([makeTicket(3, { subject: 'STALE result for ref' })])))

    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('STALE result for ref')).not.toBeInTheDocument()
    expect(screen.getByText('Refund not received')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 ticket found')
  })

  it('debounces typing into a single request', async () => {
    const server = installManualFetch()
    const user = userEvent.setup()
    renderApp('/')
    await waitFor(() => expect(server.to('/api/tickets')).toHaveLength(1))

    await user.type(screen.getByLabelText('Search tickets'), 'invoice')
    await waitFor(() => expect(server.to('/api/tickets', { q: 'invoice' })).toHaveLength(1))

    const searches = server.to('/api/tickets').map((r) => r.url.searchParams.get('q'))
    expect(searches).toEqual([null, 'invoice'])
  })

  it('on failure shows an error with retry and never leaves old rows looking current', async () => {
    const server = installManualFetch()
    const user = userEvent.setup()
    renderApp('/')

    await waitFor(() => expect(server.to('/api/tickets')).toHaveLength(1))
    act(() => server.to('/api/tickets')[0].respond(page([makeTicket(1, { subject: 'Old unfiltered row' })])))
    expect(await screen.findByText('Old unfiltered row')).toBeInTheDocument()

    // Change a filter; the new request fails.
    await user.click(screen.getByRole('button', { name: /^urgent/i }))
    await waitFor(() => expect(server.to('/api/tickets', { priority: 'urgent' })).toHaveLength(1))
    act(() => server.to('/api/tickets', { priority: 'urgent' })[0].respond({ error: 'Simulated server error' }, 500))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load tickets")
    // The previous (unfiltered) rows must not be on screen under the new filter.
    expect(screen.queryByText('Old unfiltered row')).not.toBeInTheDocument()
    expect(bodyRows()).toHaveLength(0)

    // Retry recovers.
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(server.to('/api/tickets', { priority: 'urgent' })).toHaveLength(2))
    act(() => server.to('/api/tickets', { priority: 'urgent' })[1].respond(page([makeTicket(9, { subject: 'Urgent row', priority: 'urgent' })])))
    expect(await screen.findByText('Urgent row')).toBeInTheDocument()
    expect(screen.queryByText("Couldn't load tickets")).not.toBeInTheDocument()
  })

  it('shows the list when only the status counts fail (partial failure)', async () => {
    const server = installManualFetch()
    renderApp('/')
    await waitFor(() => expect(server.to('/api/stats')).toHaveLength(1))
    act(() => {
      server.to('/api/tickets')[0].respond(page([makeTicket(1)]))
      server.to('/api/stats')[0].respond({ error: 'boom' }, 500)
    })
    expect(await screen.findByText('Ticket number 1')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent("Status counts couldn't be loaded")
  })

  it('restores the exact view from the URL (refresh / shared link)', async () => {
    const server = installManualFetch()
    renderApp('/?q=billing&status=open,pending&sort=priority&order=asc&page=2&pageSize=50')

    await waitFor(() => expect(server.to('/api/tickets')).toHaveLength(1))
    const params = server.to('/api/tickets')[0].url.searchParams
    expect(Object.fromEntries(params)).toEqual({
      q: 'billing',
      status: 'open,pending',
      sort: 'priority',
      order: 'asc',
      page: '2',
      pageSize: '50',
    })

    expect(screen.getByLabelText('Search tickets')).toHaveValue('billing')
    expect(screen.getByRole('button', { name: /^open/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^pending/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^resolved/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('columnheader', { name: /priority/i })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByLabelText('Rows per page')).toHaveValue('50')
  })

  it('opens a deep-linkable detail view and closes it without losing filters', async () => {
    const server = installManualFetch()
    const user = userEvent.setup()
    const { router } = renderApp('/?status=open')

    await waitFor(() => expect(server.to('/api/tickets')).toHaveLength(1))
    act(() => {
      server.to('/api/tickets')[0].respond(page([makeTicket(7, { subject: 'Cannot reset password' })]))
      server.to('/api/stats')[0].respond(statusCounts)
    })
    await user.click(await screen.findByText('Cannot reset password'))

    expect(router.state.location.pathname).toBe('/tickets/TCK-00007')
    expect(router.state.location.search).toBe('?status=open')
    // Summary comes from the list cache straight away, before the detail request resolves.
    expect(screen.getByRole('heading', { level: 2, name: 'Cannot reset password' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(router.state.location.search).toBe('?status=open')
    // The list was never unmounted, so no refetch was needed.
    expect(server.to('/api/tickets')).toHaveLength(1)
    expect(screen.getByText('Cannot reset password')).toBeInTheDocument()
  })
})
