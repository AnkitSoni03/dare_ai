import { useId } from 'react'
import { PAGE_SIZES } from '../../shared/tickets'
import { formatNumber } from '../lib/format'

interface PaginationProps {
  page: number
  pageSize: number
  /** Undefined while the current page has not loaded, so we never show a stale total. */
  total: number | undefined
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

export function Pagination({ page, pageSize, total, onPage, onPageSize }: PaginationProps) {
  const sizeId = useId()
  const pages = total === undefined ? undefined : Math.max(1, Math.ceil(total / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = total === undefined ? undefined : Math.min(total, page * pageSize)

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">
        {total === undefined
          ? 'Loading…'
          : total === 0 || last! < first
            ? `${formatNumber(total)} results`
            : `Showing ${formatNumber(first)}–${formatNumber(last!)} of ${formatNumber(total)}`}
      </p>
      <div className="pagination-controls">
        <button type="button" className="button" onClick={() => onPage(1)} disabled={page <= 1} aria-label="First page">
          «
        </button>
        <button type="button" className="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          ‹ Prev
        </button>
        <span className="pagination-page">
          Page {formatNumber(page)}
          {pages !== undefined && ` of ${formatNumber(pages)}`}
        </span>
        <button
          type="button"
          className="button"
          onClick={() => onPage(page + 1)}
          disabled={pages === undefined || page >= pages}
          aria-label="Next page"
        >
          Next ›
        </button>
        <button
          type="button"
          className="button"
          onClick={() => pages && onPage(pages)}
          disabled={pages === undefined || page >= pages}
          aria-label="Last page"
        >
          »
        </button>
        <label htmlFor={sizeId} className="page-size-label">
          Rows per page
        </label>
        <select id={sizeId} className="select" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </nav>
  )
}
