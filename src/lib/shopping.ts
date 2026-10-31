import type { NightLog, ShoppingItem } from '../types'

/** Shopping items grouped by store (in the order stores first appear), things still to buy first. */
export function groupShopping(items: ShoppingItem[]): { store: string; items: ShoppingItem[] }[] {
  const groups = new Map<string, ShoppingItem[]>()
  for (const item of items) groups.set(item.store, [...(groups.get(item.store) ?? []), item])
  return [...groups.entries()].map(([store, list]) => ({
    store,
    items: [...list].sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name)),
  }))
}

/** How many nights of one kind happened in `month`. */
export const countByType = (log: NightLog[], month: string, type: string) =>
  log.filter((n) => n.date.slice(0, 7) === month && n.type === type).length
