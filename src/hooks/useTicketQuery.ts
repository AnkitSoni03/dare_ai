import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { parseTicketQuery, serializeTicketQuery, type TicketQuery } from '../../shared/tickets'

interface UpdateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean
}

/**
 * The URL is the single source of truth for the explorer's view state.
 * Components read the parsed query and write patches back to the URL; nothing
 * is mirrored into React state, so refresh, back/forward and shared links can
 * never disagree with what is on screen.
 */
export function useTicketQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const key = searchParams.toString()
  // Memoise on the string form so the object identity is stable across renders.
  const query = useMemo(() => parseTicketQuery(searchParams), [key])

  const update = useCallback(
    (patch: Partial<TicketQuery>, { replace = false }: UpdateOptions = {}) => {
      setSearchParams(
        (current) => {
          const prev = parseTicketQuery(current)
          // Any change other than paging sends the user back to page 1,
          // otherwise they could land on a page that no longer exists.
          const resetsPage = Object.keys(patch).some((k) => k !== 'page')
          return serializeTicketQuery({ ...prev, ...(resetsPage ? { page: 1 } : {}), ...patch })
        },
        { replace, preventScrollReset: true },
      )
    },
    [setSearchParams],
  )

  return { query, search: key ? `?${key}` : '', update }
}
