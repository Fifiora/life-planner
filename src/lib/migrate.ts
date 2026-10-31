import type { Row } from '../types'

const FARMERS = /farmers?\s*market/i
const FLAG = 'lp.migrated.farmers'

const fix = (r: Row): Row => (FARMERS.test(String(r.name ?? '')) && r.cadence === 'weekly' ? { ...r, cadence: 'monthly' } : r)

/** The farmers market is a monthly grocery trip on a Tuesday, not a weekly one: fix it in a plan before it is added. */
export function adjustPlan<T extends Record<string, Row[]>>(tables: T): T {
  if (!Array.isArray(tables.routines)) return tables
  return { ...tables, routines: tables.routines.map(fix) }
}

/** One-time fix of the farmers market already saved on this phone. Returns how many routines changed. */
export function migrateOwnData(): number {
  try {
    if (localStorage.getItem(FLAG) === '1') return 0
    const raw = localStorage.getItem('lp.data.routines')
    let changed = 0
    if (raw) {
      const rows = JSON.parse(raw) as Row[]
      if (Array.isArray(rows)) {
        const next = rows.map((r) => {
          const out = r && typeof r === 'object' ? fix(r) : r
          if (out !== r) changed++
          return out
        })
        if (changed > 0) localStorage.setItem('lp.data.routines', JSON.stringify(next))
      }
    }
    if (raw !== null) localStorage.setItem(FLAG, '1')
    return changed
  } catch {
    return 0
  }
}
