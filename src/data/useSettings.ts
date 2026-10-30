import { useTable } from './useTable'

interface Setting {
  id: string
  key: string
  value: string
}

/** Simple key/value settings stored per household (savings target, biweekly anchor, ...). */
export function useSettings() {
  const t = useTable<Setting>('settings')
  const get = (key: string): string | undefined => t.rows.find((r) => r.key === key)?.value
  const set = async (key: string, value: string) => {
    const row = t.rows.find((r) => r.key === key)
    if (row) await t.update(row.id, { value })
    else await t.insert({ key, value })
  }
  return { get, set, loading: t.loading }
}
