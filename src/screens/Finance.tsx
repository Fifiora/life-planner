import { useState } from 'react'
import { useFinance } from '../data/useFinance'
import { monthKeyCT } from '../lib/dates'
import { monthWindow } from '../lib/ledger'
import { MonthPills } from '../ui/MonthPills'
import { PageHead } from '../ui/PageHead'
import { Bills } from './finance/Bills'
import { Budget } from './finance/Budget'
import { Insights } from './finance/Insights'
import { MonthVsMonth } from './finance/MonthVsMonth'
import { Overview } from './finance/Overview'
import { Plan } from './finance/Plan'
import { Savings } from './finance/Savings'
import { Transactions } from './finance/Transactions'

const TABS = ['Overview', 'Transactions', 'Month vs Month', 'Budget', 'Bills', 'Savings', 'Plan', 'Insights'] as const
type Tab = (typeof TABS)[number]
const BY_MONTH: Tab[] = ['Overview', 'Transactions', 'Bills', 'Savings']

export default function Finance() {
  const [month, setMonth] = useState(monthKeyCT())
  const [tab, setTab] = useState<Tab>('Overview')
  const f = useFinance(month)

  return (
    <div className="stack">
      <PageHead title="Finance" bucket="finance" sub="Plan the month, clear the debts, hit the savings goal." />

      <div role="tablist" aria-label="Finance sections" className="tabs">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`seg${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {BY_MONTH.includes(tab) && <MonthPills months={monthWindow(monthKeyCT(), 3, 4)} value={month} onChange={setMonth} />}

      {tab === 'Overview' && <Overview f={f} month={month} />}
      {tab === 'Transactions' && <Transactions f={f} month={month} />}
      {tab === 'Month vs Month' && <MonthVsMonth f={f} />}
      {tab === 'Budget' && <Budget f={f} />}
      {tab === 'Bills' && <Bills f={f} month={month} />}
      {tab === 'Savings' && <Savings f={f} month={month} />}
      {tab === 'Plan' && <Plan f={f} />}
      {tab === 'Insights' && <Insights f={f} />}
    </div>
  )
}
