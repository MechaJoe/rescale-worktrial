/** Absolute local time, for correlating with logs rather than for prose. */
const TIMESTAMP_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatTimestamp(iso: string): string {
  return TIMESTAMP_FORMAT.format(new Date(iso))
}
