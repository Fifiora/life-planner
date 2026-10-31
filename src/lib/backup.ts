const DAY_MS = 86_400_000

/** Remind about a backup once there is data to lose and none was made in the last `days` days. */
export function needsBackup(lastBackupMs: number | null, nowMs: number, hasData: boolean, days = 14): boolean {
  if (!hasData) return false
  if (lastBackupMs === null) return true
  return nowMs - lastBackupMs > days * DAY_MS
}
