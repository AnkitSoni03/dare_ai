import { useId } from 'react'
import { STATUSES, type Status, type StatusCounts } from '../../shared/tickets'
import { capitalize, formatNumber } from '../lib/format'

interface StatusCardsProps {
  selected: Status[]
  onChange: (next: Status[]) => void
  counts: { data?: StatusCounts; isError: boolean; isFetching: boolean; retry: () => void }
}

/**
 * Status filter presented as summary cards: each card is a toggle button that
 * also shows how many tickets in the current search have that status.
 * If the counts request fails the cards still work as filters (partial failure).
 */
export function StatusCards({ selected, onChange, counts }: StatusCardsProps) {
  const labelId = useId()
  const total = counts.data ? STATUSES.reduce((sum, s) => sum + counts.data![s], 0) : 0

  return (
    <section className="status-section" aria-labelledby={labelId}>
      <h2 id={labelId} className="sr-only">
        Filter by status
      </h2>
      <div className="status-cards" role="group" aria-labelledby={labelId}>
        {STATUSES.map((status) => {
          const pressed = selected.includes(status)
          const n = counts.data?.[status]
          const share = n !== undefined && total ? Math.round((n / total) * 100) : 0
          return (
            <button
              key={status}
              type="button"
              className={`status-card status-card-${status}`}
              aria-pressed={pressed}
              onClick={() => onChange(pressed ? selected.filter((s) => s !== status) : [...selected, status])}
            >
              <span className="status-card-label">
                <span className={`dot dot-${status}`} aria-hidden="true" />
                {capitalize(status)}
                {pressed && (
                  <span className="status-card-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              <span className="status-card-value">
                {n !== undefined ? formatNumber(n) : counts.isError ? '—' : <span className="value-skeleton" aria-hidden="true" />}
              </span>
              <span className="status-card-bar" aria-hidden="true">
                <span style={{ width: `${share}%` }} />
              </span>
              <span className="status-card-meta">{n !== undefined ? `${share}% of matching tickets` : counts.isError ? 'Count unavailable' : 'Counting…'}</span>
            </button>
          )
        })}
      </div>
      {counts.isError && (
        <p className="inline-warning" role="alert">
          <span aria-hidden="true">⚠</span> Status counts couldn't be loaded. The ticket list below is unaffected.{' '}
          <button type="button" className="link-button" onClick={counts.retry} disabled={counts.isFetching}>
            {counts.isFetching ? 'Retrying…' : 'Retry counts'}
          </button>
        </p>
      )}
    </section>
  )
}
