import { useEffect, useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { monthKeyCT, todayCT } from '../lib/dates'
import { money } from '../lib/format'
import { newId } from '../lib/ids'
import { compressImage, receiptStore, type ReceiptStore } from '../lib/receipts'
import type { Expense } from '../types'

const STORES = ['Groceries', 'African store', 'Farmers market', 'Other']

function Thumb({ store, id }: { store: ReceiptStore; id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    let cancelled = false
    void store.get(id).then((blob) => {
      if (!blob || cancelled || typeof URL.createObjectURL !== 'function') return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      cancelled = true
      if (made && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(made)
    }
  }, [store, id])
  return url ? <img className="receipt-thumb" src={url} alt="Receipt" /> : null
}

/** Log a grocery receipt: a total is enough; a photo is optional and stays on this phone. It counts toward the groceries budget. */
export function ReceiptLogger({ store = receiptStore, compress = compressImage }: { store?: ReceiptStore; compress?: (file: Blob) => Promise<Blob> }) {
  const { me, readOnly } = useHousehold()
  const expenses = useTable<Expense>('expenses')
  const [amount, setAmount] = useState('')
  const [shop, setShop] = useState(STORES[0])
  const [date, setDate] = useState(() => todayCT())
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const month = monthKeyCT()
  const receipts = expenses.rows
    .filter((e) => e.category === 'groceries' && (e.kind ?? 'expense') === 'expense' && typeof e.date === 'string' && e.date.slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date))

  async function save(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return setError('Enter the receipt total.')
    setError(null)
    setBusy(true)
    try {
      let receipt_id: string | undefined
      if (photo) {
        receipt_id = newId()
        await store.put(receipt_id, await compress(photo))
      }
      await expenses.insert({
        date: date || todayCT(),
        amount: n,
        category: 'groceries',
        note: [shop, note.trim()].filter(Boolean).join(' · '),
        member_id: me.id,
        kind: 'expense',
        source: 'manual',
        ...(receipt_id ? { receipt_id } : {}),
      })
      setAmount('')
      setNote('')
      setPhoto(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: Expense) {
    await expenses.remove(row.id)
    if (row.receipt_id) await store.remove(row.receipt_id)
  }

  return (
    <section className="card">
      <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--food)' }} /><h2>Log a grocery receipt</h2></div></div>
      {!readOnly && (
        <form onSubmit={save} noValidate>
          <div className="row2">
            <div>
              <label className="label" htmlFor="rc-total">Receipt total</label>
              <input id="rc-total" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rc-store">Store</label>
              <select id="rc-store" className="input" value={shop} onChange={(e) => setShop(e.target.value)}>
                {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div>
              <label className="label" htmlFor="rc-date">Date</label>
              <input id="rc-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rc-note">Note</label>
              <input id="rc-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <label className="label" htmlFor="rc-photo">Snap receipt</label>
          <input id="rc-photo" className="input" type="file" accept="image/*" capture="environment" onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
          {photo && (
            <p className="muted small">
              Photo attached ✓ {photo.name} <button type="button" className="plain-btn" onClick={() => setPhoto(null)}>Remove photo</button>
            </p>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="btn btn-primary block mt" disabled={busy}>Save receipt</button>
        </form>
      )}
      {receipts.length > 0 && (
        <ul className="list mt">
          {receipts.map((r) => (
            <li key={r.id} className="list-row">
              {r.receipt_id && <Thumb store={store} id={r.receipt_id} />}
              <span className="grow">
                <strong>{r.note || 'Groceries'}</strong>
                <span className="muted small block-text">{r.date.slice(5)}</span>
              </span>
              <span>{money(r.amount)}</span>
              {!readOnly && <button type="button" className="icon-btn" aria-label={`Delete receipt ${r.note || 'Groceries'}`} onClick={() => void remove(r)}>✕</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
