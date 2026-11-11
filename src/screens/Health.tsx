import { useRoutineData } from '../data/useRoutineData'
import { ActivityCard } from '../ui/ActivityCard'
import { NightsPlanner } from '../ui/NightsPlanner'
import { Scorecard } from '../ui/Scorecard'
import { SleepRhythm } from '../ui/SleepRhythm'
import { TurnCard } from '../ui/TurnCard'
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
      <Scorecard data={data} bucket="health" />
      {SECTIONS.map((s) => (
        <div key={s.key} className="stack">
          {s.key === 'physical' && (
            <>
              <ActivityCard />
              <SleepRhythm data={data} />
            </>
          )}
          {s.key === 'mental' && <NightsPlanner />}
          {s.key === 'spiritual' && <TurnCard name="Bible study lead" title="Sunday Bible study" />}
          <RoutineList
            title={s.title}
            color="var(--health)"
            routines={health.filter((r) => r.sub_bucket === s.key)}
            data={data}
            defaults={{ bucket: 'health', sub_bucket: s.key }}
            emptyHint={s.hint + ' Tap + to add one.'}
            showDue
          />
        </div>
      ))}
      {loose.length > 0 && (
        <RoutineList title="Other" color="var(--health)" routines={loose} data={data} defaults={{ bucket: 'health' }} />
      )}
    </div>
  )
}
