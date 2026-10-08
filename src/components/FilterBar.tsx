import { useId, type ReactNode } from 'react'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  PRIORITIES,
  type Category,
  type Priority,
  type TicketQuery,
} from '../../shared/tickets'
import { capitalize } from '../lib/format'
import { PriorityIcon } from './Avatar'

interface ChipGroupProps<T extends string> {
  label: string
  options: readonly T[]
  selected: T[]
  onChange: (next: T[]) => void
  optionLabel?: (option: T) => string
  icon?: (option: T) => ReactNode
}

function ChipGroup<T extends string>({ label, options, selected, onChange, optionLabel = capitalize, icon }: ChipGroupProps<T>) {
  const labelId = useId()
  return (
    <div className="chip-group" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="field-label">
        {label}
      </span>
      <div className="chips">
        {options.map((option) => {
          const pressed = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              className="chip"
              data-value={option}
              aria-pressed={pressed}
              onClick={() => onChange(pressed ? selected.filter((s) => s !== option) : [...selected, option])}
            >
              {icon?.(option)}
              {optionLabel(option)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface FilterBarProps {
  query: TicketQuery
  onChange: (patch: Partial<TicketQuery>) => void
}

export function FilterBar({ query, onChange }: FilterBarProps) {
  const active = query.status.length + query.priority.length + query.category.length + (query.q ? 1 : 0)

  return (
    <div className="filters">
      <ChipGroup<Priority>
        label="Priority"
        options={PRIORITIES}
        selected={query.priority}
        onChange={(priority) => onChange({ priority })}
        icon={(p) => <PriorityIcon level={p} />}
      />
      <ChipGroup<Category>
        label="Category"
        options={CATEGORIES}
        selected={query.category}
        onChange={(category) => onChange({ category })}
        optionLabel={(c) => CATEGORY_LABELS[c]}
      />
      {active > 0 && (
        <button
          type="button"
          className="button button-ghost clear-filters"
          onClick={() => onChange({ q: '', status: [], priority: [], category: [] })}
        >
          Clear search and filters
          <span className="badge-count" aria-hidden="true">
            {active}
          </span>
        </button>
      )}
    </div>
  )
}
