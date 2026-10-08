function hue(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Decorative initials avatar; the name is always rendered as text next to it. */
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.42, ['--avatar-hue' as string]: hue(name) }}
    >
      {initials(name)}
    </span>
  )
}

export function PriorityIcon({ level }: { level: 'low' | 'medium' | 'high' | 'urgent' }) {
  const filled = { low: 1, medium: 2, high: 3, urgent: 4 }[level]
  return (
    <svg className="priority-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 3.5} y={10 - i * 3} width="2.5" height={4 + i * 3} rx="1" opacity={i < filled ? 1 : 0.22} />
      ))}
    </svg>
  )
}
