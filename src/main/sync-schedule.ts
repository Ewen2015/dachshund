export function nextSyncDelay(
  lastAttemptAt: number | null,
  intervalMinutes: number,
  now = Date.now()
): number {
  if (!lastAttemptAt) return 1_000
  return Math.max(1_000, lastAttemptAt + intervalMinutes * 60_000 - now)
}
