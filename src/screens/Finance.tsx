import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
import { Pay } from './finance/Pay'
import { Plan } from './finance/Plan'
import { Savings } from './finance/Savings'
import { Transactions } from './finance/Transactions'

const TABS = ['Overview', 'Transactions', 'Month vs Month', 'Budget', 'Bills', 'Pay', 'Savings', 'Plan', 'Insights'] as const
type Tab = (typeof TABS)[number]
const BY_MONTH: Tab[] = ['Overview', 'Transactions', 'Bills', 'Pay', 'Savings']

export default function Finance() {
  const [month, setMonth] = useState(monthKeyCT())
  const [tab, setTab] = useState<Tab>('Overview')
  const f = useFinance(month)
  const listRef = useRef<HTMLDivElement>(null)

  // keep the chosen tab in view on a narrow phone, and let the arrow keys move between tabs
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [tab])
  function onKeys(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.indexOf(tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    setTab(TABS[next])
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className="stack">
      <PageHead title="Finance" sub="Plan the month, clear the debts, hit the savings goal." />

      <div role="tablist" aria-label="Finance sections" className="tabs" ref={listRef} onKeyDown={onKeys}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" id={`fin-tab-${t.replace(/ /g, '-')}`} tabIndex={tab === t ? 0 : -1} aria-selected={tab === t} className={`seg${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {BY_MONTH.includes(tab) && <MonthPills months={monthWindow(monthKeyCT(), 3, 4)} value={month} onChange={setMonth} />}

      {tab === 'Overview' && <Overview f={f} month={month} />}
      {tab === 'Transactions' && <Transactions f={f} month={month} />}
      {tab === 'Month vs Month' && <MonthVsMonth f={f} />}
      {tab === 'Budget' && <Budget f={f} />}
      {tab === 'Bills' && <Bills f={f} month={month} />}
      {tab === 'Pay' && <Pay f={f} month={month} />}
      {tab === 'Savings' && <Savings f={f} month={month} />}
      {tab === 'Plan' && <Plan f={f} />}
      {tab === 'Insights' && <Insights f={f} />}
    </div>
  )
}
