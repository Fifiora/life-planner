import { useState } from 'react'
import { useFinance } from '../data/useFinance'
import { monthKeyCT } from '../lib/dates'
import { monthLabel, shiftMonthKey } from '../lib/format'
import { PageHead } from '../ui/PageHead'
import { Bills } from './finance/Bills'
import { Overview } from './finance/Overview'
import { Plan } from './finance/Plan'
import { Savings } from './finance/Savings'
import { Spending } from './finance/Spending'

const TABS = ['Overview', 'Bills', 'Spending', 'Savings', 'Plan'] as const
type Tab = (typeof TABS)[number]

export default function Finance() {
  const [month, setMonth] = useState(monthKeyCT())
  const [tab, setTab] = useState<Tab>('Overview')
  const f = useFinance(month)

  return (
    <div className="stack">
      <PageHead title="Finance" sub="Plan the month, clear the debts, hit the savings goal." />

      <div role="tablist" aria-label="Finance sections" className="tabs">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`seg${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab !== 'Plan' && (
        <div className="card month-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonthKey(month, -1))}>‹</button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonthKey(month, 1))}>›</button>
        </div>
      )}

      {tab === 'Overview' && <Overview f={f} />}
      {tab === 'Bills' && <Bills f={f} month={month} />}
      {tab === 'Spending' && <Spending f={f} month={month} />}
      {tab === 'Savings' && <Savings f={f} month={month} />}
      {tab === 'Plan' && <Plan f={f} />}
    </div>
  )
}
