import { useRoutineData } from '../data/useRoutineData'
import { NightsPlanner } from '../ui/NightsPlanner'
import { PageHead } from '../ui/PageHead'
import { RoutineList } from '../ui/RoutineList'

const SECTIONS = [
  { key: 'physical', title: 'Physical health', hint: 'Daily movement, sleep, and monthly care visits.' },
  { key: 'mental', title: 'Mental health', hint: 'Game, painting, date and movie nights live here.' },
  { key: 'spiritual', title: 'Spiritual health', hint: 'Prayers, mass, Blessed Sacrament visits and Bible study.' },
] as const

export default function Health() {
  const data = useRoutineData()
  const health = data.routines.filter((r) => r.bucket === 'health')
  const loose = health.filter((r) => !SECTIONS.some((s) => s.key === r.sub_bucket))

  return (
    <div className="stack">
      <PageHead title="Health" sub="Body, mind and spirit — together." />
      {SECTIONS.map((s) => (
        <div key={s.key} className="stack">
          {s.key === 'mental' && <NightsPlanner />}
          <RoutineList
            title={s.title}
            color="var(--health)"
            routines={health.filter((r) => r.sub_bucket === s.key)}
            data={data}
            defaults={{ bucket: 'health', sub_bucket: s.key }}
            emptyHint={s.hint + ' Tap + to add one.'}
          />
        </div>
      ))}
      {loose.length > 0 && (
        <RoutineList title="Other" color="var(--health)" routines={loose} data={data} defaults={{ bucket: 'health' }} />
      )}
    </div>
  )
}
