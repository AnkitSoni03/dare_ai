import { useEffect, useId, useRef, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

interface SearchBoxProps {
  /** The committed search text from the URL. */
  value: string
  onCommit: (value: string, options: { replace: boolean }) => void
}

/**
 * Keeps what the user is typing in local state and only commits it to the URL
 * after a pause, so a fast typist triggers one request instead of one per key.
 */
export function SearchBox({ value, onCommit }: SearchBoxProps) {
  const id = useId()
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const timer = useRef<number | undefined>(undefined)
  // The first commit of a typing session pushes a history entry, the rest
  // replace it, so Back undoes the whole search rather than one letter at a time.
  const pushedThisSession = useRef(false)

  // The URL changed from outside (back/forward, "clear filters", a shared link).
  useEffect(() => {
    if (value !== committed.current) {
      window.clearTimeout(timer.current)
      committed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // "/" focuses search from anywhere, unless the user is already typing in a field.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key !== '/' || e.metaKey || e.ctrlKey || target.closest('input, textarea, select, [contenteditable], dialog')) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function commit(next: string) {
    window.clearTimeout(timer.current)
    const trimmed = next.trim()
    if (trimmed === committed.current) return
    committed.current = trimmed
    onCommit(trimmed, { replace: pushedThisSession.current })
    pushedThisSession.current = true
  }

  return (
    <div className="search">
      <label htmlFor={id} className="field-label">
        Search tickets
      </label>
      <div className="search-field">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          type="search"
          className="search-input"
          value={text}
          maxLength={200}
          autoComplete="off"
          spellCheck={false}
          placeholder="ID, subject, customer or email"
          aria-describedby={`${id}-hint`}
          onFocus={() => {
            pushedThisSession.current = false
          }}
          onChange={(e) => {
            const next = e.target.value
            setText(next)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(text)
          }}
        />
        <kbd className="search-kbd" aria-hidden="true">
          /
        </kbd>
      </div>
      <p id={`${id}-hint`} className="sr-only">
        Results update as you type. Press slash to focus search from anywhere.
      </p>
    </div>
  )
}
