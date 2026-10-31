import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Food from '../src/screens/Food'
import Finance from '../src/screens/Finance'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { createReceiptStore, receiptStore, type ReceiptStore } from '../src/lib/receipts'
import { todayCT } from '../src/lib/dates'
import { ReceiptLogger } from '../src/ui/ReceiptLogger'
import { renderScreen, saved, seedPlanner } from './seed'

const fakeStore = (): ReceiptStore & { put: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  remove: vi.fn().mockResolvedValue(undefined),
})
const noCompress = async (b: Blob) => b

beforeEach(() => seedPlanner())

describe('receipt store', () => {
  it('keeps, returns and removes a photo (in memory when the browser has no database)', async () => {
    const store = createReceiptStore()
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    await store.put('r1', blob)
    expect(await store.get('r1')).toBeTruthy()
    await store.remove('r1')
    expect(await store.get('r1')).toBeNull()
  })
})

describe('ReceiptLogger', () => {
  it('records just a number as a groceries expense', async () => {
    const store = fakeStore()
    renderScreen(<ReceiptLogger store={store} compress={noCompress} />)
    await userEvent.type(screen.getByLabelText('Receipt total'), '84.5')
    await userEvent.selectOptions(screen.getByLabelText('Shop'), 'African store')
    await userEvent.click(screen.getByRole('button', { name: 'Save receipt' }))
    await waitFor(() => expect(saved('expenses')[0]).toMatchObject({ amount: 84.5, category: 'groceries', date: todayCT(), kind: 'expense', source: 'manual', member_id: 'a' }))
    expect(saved('expenses')[0].note).toContain('African store')
    expect(saved('expenses')[0].receipt_id).toBeUndefined()
    expect(store.put).not.toHaveBeenCalled()
  })

  it('keeps a snapped photo with the expense', async () => {
    const store = fakeStore()
    renderScreen(<ReceiptLogger store={store} compress={noCompress} />)
    const file = new File(['img'], 'receipt.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Snap receipt'), file)
    expect(await screen.findByText(/Photo attached/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Receipt total'), '40')
    await userEvent.click(screen.getByRole('button', { name: 'Save receipt' }))
    await waitFor(() => expect(saved('expenses')[0].receipt_id).toEqual(expect.any(String)))
    expect(store.put).toHaveBeenCalledWith(saved('expenses')[0].receipt_id, expect.any(Blob))
  })

  it('asks for a total', async () => {
    renderScreen(<ReceiptLogger store={fakeStore()} compress={noCompress} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save receipt' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the receipt total.')
    expect(saved('expenses')).toHaveLength(0)
  })

  it('lists this month\'s receipts and deletes one together with its photo', async () => {
    const store = fakeStore()
    localStorage.setItem('lp.data.expenses', JSON.stringify([{ id: 'x1', date: todayCT(), amount: 55, category: 'groceries', note: 'Groceries', member_id: 'a', kind: 'expense', source: 'manual', receipt_id: 'photo-1' }]))
    renderScreen(<ReceiptLogger store={store} compress={noCompress} />)
    expect(await screen.findByText('$55')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete receipt Groceries' }))
    await waitFor(() => expect(saved('expenses')).toHaveLength(0))
    expect(store.remove).toHaveBeenCalledWith('photo-1')
  })

  it('is not available in a view-only copy', () => {
    loadSnapshot(getAllRows())
    renderScreen(<ReceiptLogger store={fakeStore()} compress={noCompress} />)
    expect(screen.queryByRole('button', { name: 'Save receipt' })).toBeNull()
  })
})

describe('receipts feed the dashboard', () => {
  it('moves the groceries budget on the Food screen', async () => {
    renderScreen(<Food />)
    await userEvent.type(await screen.findByLabelText('Receipt total'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Save receipt' }))
    expect(await screen.findByText(/\$100 spent of \$500/)).toBeInTheDocument()
  })

  it('removes the photo when the expense is deleted from Finance', async () => {
    const spy = vi.spyOn(receiptStore, 'remove').mockResolvedValue(undefined)
    localStorage.setItem('lp.data.expenses', JSON.stringify([{ id: 'x1', date: todayCT(), amount: 55, category: 'groceries', note: 'Weekly shop', member_id: 'a', kind: 'expense', source: 'manual', receipt_id: 'photo-9' }]))
    renderScreen(<Finance />)
    await userEvent.click(await screen.findByRole('tab', { name: 'Transactions' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Weekly shop' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('photo-9'))
    spy.mockRestore()
  })
})
