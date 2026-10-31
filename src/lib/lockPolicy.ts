const MINUTE_MS = 60_000

/**
 * Should the app lock after being away since `hiddenAt`?
 * `lockAfterMinutes`: 0 = as soon as it is left, a number = after that many minutes, negative = never by time.
 */
export function shouldLock(hiddenAt: number, now: number, lockAfterMinutes: number): boolean {
  if (lockAfterMinutes < 0) return false
  if (lockAfterMinutes === 0) return true
  return now - hiddenAt >= lockAfterMinutes * MINUTE_MS
}
