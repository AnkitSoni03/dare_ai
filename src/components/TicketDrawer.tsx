import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { CATEGORY_LABELS, type Ticket, type TicketPage } from '../../shared/tickets'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { errorMessage, ticketQuery } from '../lib/queries'
import { Avatar } from './Avatar'
import { PriorityLabel, StatusBadge } from './TicketTable'

/** Reuse the row we already have from any cached list page so the drawer has content instantly. */
function findInListCache(client: QueryClient, id: string): Ticket | undefined {
  for (const [, page] of client.getQueriesData<TicketPage>({ queryKey: ['tickets'] })) {
    const hit = page?.items.find((t) => t.id === id)
    if (hit) return hit
  }
  return undefined
}

/**
 * Detail view rendered as a child route (/tickets/:id) on top of the list.
 * The list stays mounted underneath, so closing the drawer keeps its scroll
 * position and filters. Uses a native modal <dialog> for focus trapping,
 * Escape handling and making the page behind it inert.
 */
export function TicketDrawer() {
  const { id = '' } = useParams()
  const ticketId = id.toUpperCase()
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)

  const detail = useQuery(ticketQuery(ticketId))
  // Keyed on the id: React Router reuses this component if only :id changes (e.g. Back/Forward).
  const cached = useMemo(() => findInListCache(client, ticketId), [client, ticketId])
  const ticket: Ticket | undefined = detail.data ?? cached
  const notFound = detail.error instanceof ApiError && detail.error.status === 404

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && !dialog.open) dialog.showModal?.()
    return () => {
      dialog?.close?.()
      // Hand focus back to the row that opened the drawer.
      if (opener && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const close = useCallback(() => {
    // Opened from the list: go back so the history stays clean and Back/Forward behave.
    // Deep-linked: there is no list entry behind us, so replace with the list URL.
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1)
    else navigate({ pathname: '/', search: location.search }, { replace: true })
  }, [location.state, location.search, navigate])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-labelledby="drawer-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="drawer-panel">
        <header className="drawer-header">
          <div>
            <p className="drawer-id">{ticketId}</p>
            <h2 id="drawer-title" className="drawer-title">
              {ticket?.subject ?? (notFound ? 'Ticket not found' : 'Loading ticket…')}
            </h2>
          </div>
          <div className="drawer-actions">
            <button type="button" className="button button-ghost" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button type="button" className="button" onClick={close} autoFocus>
              Close
            </button>
          </div>
        </header>
        <p className="sr-only" role="status" aria-live="polite">
          {copied ? 'Link copied to clipboard' : ''}
        </p>

        {notFound ? (
          <div className="state">
            <p>No ticket with the ID {ticketId} exists. It may have been mistyped in the link.</p>
          </div>
        ) : (
          <>
            {ticket && (
              <>
                <div className="drawer-badges">
                  <StatusBadge status={ticket.status} />
                  <PriorityLabel priority={ticket.priority} />
                  <span className="category-tag">{CATEGORY_LABELS[ticket.category]}</span>
                </div>
                <div className="customer-card">
                  <Avatar name={ticket.customer} size={40} />
                  <div>
                    <p className="customer-name">{ticket.customer}</p>
                    <a className="customer-email" href={`mailto:${ticket.email}`}>
                      {ticket.email}
                    </a>
                  </div>
                </div>
                <dl className="detail-grid">
                  <div>
                    <dt>Assignee</dt>
                    <dd>{ticket.assignee ?? 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{CATEGORY_LABELS[ticket.category]}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(ticket.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{formatDateTime(ticket.updatedAt)}</dd>
                  </div>
                </dl>
              </>
            )}

            <section className="drawer-section" aria-labelledby="conversation-title" aria-busy={detail.isPending}>
              <h3 id="conversation-title">Conversation</h3>
              {detail.isError ? (
                <div className="state state-error" role="alert">
                  <p>{errorMessage(detail.error)} The conversation couldn't be loaded.</p>
                  <button type="button" className="button button-primary" onClick={() => detail.refetch()} disabled={detail.isFetching}>
                    {detail.isFetching ? 'Retrying…' : 'Retry'}
                  </button>
                </div>
              ) : detail.data ? (
                <>
                  <p className="description">{detail.data.description}</p>
                  <ol className="messages">
                    {detail.data.messages.map((m, i) => (
                      <li key={i} className={`message${m.author === detail.data.customer ? '' : ' message-agent'}`}>
                        <Avatar name={m.author} size={28} />
                        <div className="message-body">
                          <p className="message-meta">
                            <strong>{m.author}</strong> · <time dateTime={m.sentAt}>{formatDateTime(m.sentAt)}</time>
                          </p>
                          <p>{m.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <>
                  <span className="sr-only">Loading conversation…</span>
                  <SkeletonLines />
                </>
              )}
            </section>
          </>
        )}
      </div>
    </dialog>
  )
}

function SkeletonLines() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton-row">
        <span />
      </div>
      <div className="skeleton-row">
        <span />
        <span />
      </div>
    </div>
  )
}
