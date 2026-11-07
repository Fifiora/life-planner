import { useState, type FormEvent } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { todayCT } from '../../lib/dates'
import { defaultExpenseDate, normCategory, paymentPatch, payoffPatch, payoffPaid } from '../../lib/finance2'
import { newBankRows, parseBankCsv } from '../../lib/bankCsv'
import { readFileText } from '../../lib/files'
import { receiptStore } from '../../lib/receipts'
import { cap, money } from '../../lib/format'
import { filterLedger, ledgerRows, type LedgerFilter, type LedgerKind, type LedgerRow } from '../../lib/ledger'
import { AmountSheet } from '../../ui/AmountSheet'
import { ExpenseEditForm } from '../../ui/ExpenseEditForm'

export const EXPENSE_CATEGORIES: [string, string][] = [
  ['dining', 'Eating out / dates'],
  ['beauty', 'Nails, salon & massage'],
  ['travel', 'Trips'],
  ['transport', 'Car & fuel'],
  ['gifts', 'Gifts'],
  ['health', 'Health'],
  ['groceries', 'Groceries'],
  ['other', 'Other'],
]
const labelOf = (key: string) => EXPENSE_CATEGORIES.find(([k]) => k === key)?.[1] ?? cap(key)
const KINDS: ['all' | LedgerKind, string][] = [['all', 'All'], ['expense', 'Spending'], ['income', 'Income'], ['bill', 'Bills'], ['payoff', 'Payoffs'], ['savings', 'Savings'], ['transfer', 'Transfers']]

export function Transactions({ f, month }: { f: FinanceData; month: string }) {
  const { me, readOnly } = useHousehold()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('dining')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => defaultExpenseDate(month, todayCT()))
  const [error, setError] = useState<string | null>(null)
  const [budget, setBudget] = useState<string | null>(null)
  const [filter, setFilter] = useState<LedgerFilter>({ search: '', kind: 'all', category: 'all', sort: 'date', dir: 'desc' })
  const [preview, setPreview] = useState<{ rows: ReturnType<typeof newBankRows>; skipped: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<LedgerRow | null>(null)

  const { flex } = f
  const pct = flex.budget > 0 ? Math.min(100, Math.round((flex.spent / flex.budget) * 100)) : flex.spent > 0 ? 100 : 0
  const all = ledgerRows({ month, expenses: f.expenses.rows, payments: f.payments.rows, bills: f.bills.rows, savings: f.savings.rows })
  const shown = filterLedger(all, filter)
  const categories = [...new Set(all.map((r) => r.category))].sort()
  const totalOut = shown.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0)
  const totalIn = shown.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return setError('Enter an amount greater than 0.')
    setError(null)
    await f.expenses.insert({ date: date || todayCT(), amount: n, category, note: note.trim(), member_id: me.id, kind: 'expense', source: 'manual' })
    setAmount('')
    setNote('')
  }

  const editedExpense = editRow?.editable ? f.expenses.rows.find((x) => x.id === editRow.rawId) : undefined
  const editedBill = editRow?.kind === 'bill' ? f.bills.rows.find((b) => b.id === f.payments.rows.find((p) => p.id === editRow.rawId)?.bill_id) : editRow?.kind === 'payoff' ? f.bills.rows.find((b) => b.id === editRow.rawId) : undefined

  async function saveAmount(n: number) {
    if (!editRow) return
    if (editRow.kind === 'bill' && editedBill) await f.payments.update(editRow.rawId, paymentPatch(editedBill, n))
    else if (editRow.kind === 'payoff' && editedBill) await f.bills.update(editedBill.id, payoffPatch(editedBill, n))
    else if (editRow.kind === 'savings') await f.savings.update(editRow.rawId, { amount: n })
    setEditRow(null)
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed = parseBankCsv(await readFileText(file))
      const rows = newBankRows(f.expenses.rows, parsed, me.id)
      setPreview({ rows, skipped: parsed.length - rows.length })
      setImportError(null)
    } catch (err) {
      setPreview(null)
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runImport() {
    if (!preview) return
    for (const row of preview.rows) await f.expenses.insert(row)
    setPreview(null)
  }

  const setSort = (sort: LedgerFilter['sort']) => setFilter((cur) => ({ ...cur, sort, dir: cur.sort === sort && cur.dir === 'asc' ? 'desc' : 'asc' }))
  const sortMark = (key: LedgerFilter['sort']) => (filter.sort === key ? (filter.dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <>
      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Extra spending budget</h2></div></div>
        <p className="muted small">Dates, salon, nails, trips, the car — anything outside the monthly bills. It comes out of what's left after bills, so it lowers savings.</p>
        <div className="bar mt" role="progressbar" aria-label="Extra spending used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="bar-fill" style={{ width: `${pct}%`, background: flex.overBy > 0 ? 'var(--danger)' : undefined }} />
        </div>
        <p className="bar-text">
          {money(flex.spent)} spent of {money(flex.budget)} · <strong>{flex.overBy > 0 ? `${money(flex.overBy)} over` : `${money(flex.left)} left`}</strong>
        </p>
        {flex.groceries > 0 && <p className="muted small">Groceries logged: {money(flex.groceries)} (tracked against the groceries bill, not this budget).</p>}
        {!readOnly && (
          <>
            <label className="label" htmlFor="flex-budget">Monthly extra-spending budget ($)</label>
            <input
              id="flex-budget"
              className="input"
              inputMode="decimal"
              value={budget ?? String(f.flexBudget)}
              onChange={(e) => setBudget(e.target.value)}
              onBlur={() => {
                if (budget !== null && budget.trim() !== '' && Number(budget) >= 0) void f.settings.set('flex_budget', String(Number(budget)))
                setBudget(null)
              }}
            />
          </>
        )}
        <p className="callout">Projected savings this month: <strong>{money(f.projected)}</strong> of {money(f.target)}</p>
      </section>

      <section className="card">
        <h2>Add an expense</h2>
        <form onSubmit={add} noValidate>
          <div className="row2">
            <div>
              <label className="label" htmlFor="exp-amount">Amount</label>
              <input id="exp-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="exp-category">Category</label>
              <select id="exp-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div>
              <label className="label" htmlFor="exp-note">Note</label>
              <input id="exp-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="exp-date">Date</label>
              <input id="exp-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="btn btn-primary block mt">Add expense</button>
        </form>
      </section>

      <section className="card">
        <h2>Import from your bank</h2>
        <p className="muted small">Download a statement as CSV from your bank (Date, Description, Amount) and import it. Lines are sorted into categories (you can change any), and lines imported before are skipped. Once a month has bank lines, they are used instead of ticked-off bills so nothing counts twice.</p>
        <label className="label" htmlFor="bank-csv">Import bank CSV</label>
        <input id="bank-csv" className="input" type="file" accept=".csv,text/csv" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = '' }} />
        {importError && <p role="alert" className="error">{importError}</p>}
        {preview && (
          <div className="callout">
            <p>{preview.rows.length} new transaction{preview.rows.length === 1 ? '' : 's'} found{preview.skipped > 0 ? ` (${preview.skipped} already imported)` : ''}.</p>
            <div className="actions">
              {preview.rows.length > 0 && <button type="button" className="btn btn-primary" onClick={() => void runImport()}>{`Import ${preview.rows.length} transaction${preview.rows.length === 1 ? '' : 's'}`}</button>}
              <button type="button" className="btn" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card wide">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Transactions</h2></div><span className="muted small">{shown.length} shown · in {money(totalIn)} · out {money(-totalOut)}</span></div>
        <div className="filter-row">
          <input className="input" aria-label="Search transactions" placeholder="Search…" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
          <select className="input" aria-label="Type" value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value as LedgerFilter['kind'] })}>
            {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="input" aria-label="Filter by category" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
          </select>
        </div>
        {shown.length === 0 ? (
          <p className="muted small mt">No transactions match. Add one above, import a bank file, or tick off bills on the Bills tab.</p>
        ) : (
          <div className="table-wrap">
            <table className="ftable tx">
              <thead>
                <tr>
                  <th><button type="button" className="plain-btn" onClick={() => setSort('date')}>Date{sortMark('date')}</button></th>
                  <th><button type="button" className="plain-btn" onClick={() => setSort('description')}>Description{sortMark('description')}</button></th>
                  <th><button type="button" className="plain-btn" onClick={() => setSort('category')}>Category{sortMark('category')}</button></th>
                  <th><button type="button" className="plain-btn" onClick={() => setSort('amount')}>Amount{sortMark('amount')}</button></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date.slice(5)}</td>
                    <td>{r.description}</td>
                    <td>
                      {r.editable && !readOnly ? (
                        <select className="mini-select" aria-label={`Category for ${r.description}`} value={r.category} onChange={(e) => void f.expenses.update(r.id, { category: e.target.value })}>
                          {[...new Set([...EXPENSE_CATEGORIES.map(([k]) => k), 'subscriptions', 'housing', 'family', 'giving', 'insurance', 'utilities', 'debt', 'income', 'transfer', normCategory(r.category)])].map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
                        </select>
                      ) : (
                        labelOf(r.category)
                      )}
                    </td>
                    <td style={{ color: r.amount > 0 ? 'var(--ok)' : undefined, fontWeight: 600 }}>{r.amount > 0 ? '+' : ''}{money(r.amount)}</td>
                    <td>
                      {r.amountEditable && !readOnly && <button type="button" className="icon-btn" aria-label={`Edit ${r.description}`} onClick={() => setEditRow(r)}>✎</button>}
                      {r.editable && !readOnly && <button type="button" className="icon-btn" aria-label={`Delete ${r.description}`} onClick={() => { const photo = f.expenses.rows.find((x) => x.id === r.id)?.receipt_id; void f.expenses.remove(r.id); if (photo) void receiptStore.remove(photo) }}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editRow && editedExpense && (
        <ExpenseEditForm
          key={editRow.rawId}
          expense={editedExpense}
          onClose={() => setEditRow(null)}
          onSave={async (values) => {
            await f.expenses.update(editedExpense.id, values)
            setEditRow(null)
          }}
        />
      )}
      {editRow && !editedExpense && editRow.amountEditable && (
        <AmountSheet
          key={editRow.rawId}
          open
          title="Edit transaction"
          label="Amount"
          initial={editRow.kind === 'payoff' && editedBill ? payoffPaid(editedBill) || Math.abs(editRow.amount) : Math.abs(editRow.amount)}
          full={editedBill?.amount}
          onClose={() => setEditRow(null)}
          onSave={saveAmount}
        />
      )}
    </>
  )
}
