import { useRoutineData } from '../data/useRoutineData'
import { PageHead } from '../ui/PageHead'
import { RoutineList } from '../ui/RoutineList'

export default function Food() {
  const data = useRoutineData()
  const food = data.routines.filter((r) => r.bucket === 'food')
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
      <section className="card">
        <h2>Eating out</h2>
        <p className="muted">Restaurants are reserved for date nights — plan them in Health → Mental health.</p>
      </section>
    </div>
  )
}
