import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { useEvents } from '../data/useEvents'
import { useTable } from '../data/useTable'
import { todayCT } from '../lib/dates'
import type { Expense, ShoppingItem } from '../types'
import { EXPENSE_CATEGORIES } from '../screens/finance/Transactions'
import { EventForm } from './EventForm'
import { Sheet } from './Sheet'

const STORES = ['Groceries', 'African store', 'Farmers market', 'Other']
type Mode = 'menu' | 'expense' | 'event' | 'shop'

/** A floating "+" on Today for the three things added most: an expense, an event, a shopping item. */
export function QuickAdd() {
  const { me, members, readOnly } = useHousehold()
  const expenses = useTable<Expense>('expenses')
  const shopping = useTable<ShoppingItem>('shopping')
  const events = useEvents()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('other')
  const [item, setItem] = useState('')
  const [store, setStore] = useState(STORES[0])
  const [error, setError] = useState<string | null>(null)

  if (readOnly) return null

  const close = () => {
    setOpen(false)
    setMode('menu')
    setAmount('')
    setNote('')
    setItem('')
    setError(null)
  }

  async function saveExpense(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return setError('Enter an amount greater than 0.')
    await expenses.insert({ date: todayCT(), amount: n, category, note: note.trim(), member_id: me.id, kind: 'expense', source: 'manual' })
    close()
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault()
    if (!item.trim()) return setError('Type what to buy.')
    await shopping.insert({ name: item.trim(), store, done: false, added_by: me.id })
    close()
  }

  return (
    <>
      <button type="button" className="fab" aria-label="Quick add" onClick={() => setOpen(true)}>+</button>
      <Sheet open={open} onClose={close} title="Quick add">
        {mode === 'menu' && (
          <div className="quick-menu">
            <button type="button" className="btn" onClick={() => setMode('expense')}>Expense</button>
            <button type="button" className="btn" onClick={() => setMode('event')}>Event</button>
            <button type="button" className="btn" onClick={() => setMode('shop')}>Shopping item</button>
          </div>
        )}
        {mode === 'expense' && (
          <form onSubmit={saveExpense} noValidate>
            <label className="label" htmlFor="qa-amount">Amount</label>
            <input id="qa-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <label className="label" htmlFor="qa-cat">Category</label>
            <select id="qa-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <label className="label" htmlFor="qa-note">Note</label>
            <input id="qa-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <p role="alert" className="error">{error}</p>}
            <div className="actions"><button type="submit" className="btn btn-primary">Save expense</button></div>
          </form>
        )}
        {mode === 'event' && (
          <EventForm
            defaultDate={todayCT()}
            members={members}
            onSave={async (v) => { await events.add(v); close() }}
          />
        )}
        {mode === 'shop' && (
          <form onSubmit={saveItem} noValidate>
            <label className="label" htmlFor="qa-item">Item</label>
            <input id="qa-item" className="input" value={item} onChange={(e) => setItem(e.target.value)} />
            <label className="label" htmlFor="qa-store">Store</label>
            <select id="qa-store" className="input" value={store} onChange={(e) => setStore(e.target.value)}>
              {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {error && <p role="alert" className="error">{error}</p>}
            <div className="actions"><button type="submit" className="btn btn-primary">Add item</button></div>
          </form>
        )}
      </Sheet>
    </>
  )
}
