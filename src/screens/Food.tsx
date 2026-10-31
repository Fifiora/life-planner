import { useRoutineData } from '../data/useRoutineData'
import { useTable } from '../data/useTable'
import { monthKeyCT } from '../lib/dates'
import { countByType } from '../lib/shopping'
import type { NightLog } from '../types'
import { GroceryBudget } from '../ui/GroceryBudget'
import { ReceiptLogger } from '../ui/ReceiptLogger'
import { ShoppingList } from '../ui/ShoppingList'
import { PageHead } from '../ui/PageHead'
import { RoutineList } from '../ui/RoutineList'

export default function Food() {
  const data = useRoutineData()
  const food = data.routines.filter((r) => r.bucket === 'food')
  const nights = useTable<NightLog>('night_log')
  const dates = countByType(nights.rows, monthKeyCT(), 'date')
  return (
    <div className="stack">
      <PageHead title="Food" sub="Shop with a plan, eat out on date nights." />
      <RoutineList
        title="Shopping rhythm"
        color="var(--food)"
        routines={food}
        data={data}
        defaults={{ bucket: 'food', cadence: 'biweekly' }}
        showDue
        emptyHint="Add your grocery run, meat purchase and farmers market days."
      />
      <ShoppingList />
      <ReceiptLogger />
      <GroceryBudget />
      <section className="card">
        <h2>Eating out</h2>
        <p className="muted">Restaurants are reserved for date nights — plan them in Health → Mental health.</p>
        <p><strong>{dates} date night{dates === 1 ? '' : 's'}</strong> so far this month.</p>
      </section>
    </div>
  )
}
