const number = new Intl.NumberFormat('en-IN')
const date = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

export const formatNumber = (n: number) => number.format(n)
export const formatDate = (iso: string) => date.format(new Date(iso))
export const formatDateTime = (iso: string) => `${dateTime.format(new Date(iso))} UTC`

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function plural(n: number, word: string) {
  return `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`
}
