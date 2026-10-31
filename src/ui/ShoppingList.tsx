import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { groupShopping } from '../lib/shopping'
import type { ShoppingItem } from '../types'

const STORES = ['Groceries', 'African store', 'Farmers market', 'Other']

/** A shared list of things to buy, grouped by store. */
export function ShoppingList() {
  const { me } = useHousehold()
  const items = useTable<ShoppingItem>('shopping')
  const [name, setName] = useState('')
  const [store, setStore] = useState(STORES[0])

  const groups = groupShopping(items.rows)
  const bought = items.rows.filter((i) => i.done)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await items.insert({ name: name.trim(), store, done: false, added_by: me.id })
    setName('')
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: 'var(--food)' }} /><h2>Shopping list</h2></div>
        {bought.length > 0 && (
          <button type="button" className="btn btn-small edit-only" onClick={() => void Promise.all(bought.map((i) => items.remove(i.id)))}>Clear bought items</button>
        )}
      </div>
      <form onSubmit={add} noValidate>
        <div className="row2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
          <div>
            <label className="label" htmlFor="shop-item">Item</label>
            <input id="shop-item" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="shop-store">Store</label>
            <select id="shop-store" className="input" value={store} onChange={(e) => setStore(e.target.value)}>
              {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary block mt">Add item</button>
      </form>
      {groups.length === 0 ? <p className="muted small mt">Nothing on the list. Add what you need for the next shop.</p> : groups.map((g) => (
        <div key={g.store} className="mt">
          <h3>{g.store}</h3>
          <ul className="list">
            {g.items.map((i) => (
              <li key={i.id} className="list-row">
                <input type="checkbox" className="tick" checked={i.done} aria-label={i.name} onChange={() => items.update(i.id, { done: !i.done })} />
                <span className="grow" style={{ textDecoration: i.done ? 'line-through' : undefined, opacity: i.done ? 0.55 : 1 }}>{i.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
