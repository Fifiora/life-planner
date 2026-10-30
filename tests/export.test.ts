import { describe, it, expect } from 'vitest'
import { buildExport } from '../src/lib/export'

describe('buildExport', () => {
  it('has a key for every table, including empty ones', () => {
    const out = JSON.parse(buildExport({ bills: [{ id: '1', name: 'Rent' }], places: [] }))
    expect(Object.keys(out).sort()).toEqual(['bills', 'places'])
    expect(out.places).toEqual([])
  })
  it('leaves the internal household id out of exported rows', () => {
    const out = JSON.parse(buildExport({ bills: [{ id: '1', household_id: 'h', name: 'Rent' }] }))
    expect(out.bills[0]).toEqual({ id: '1', name: 'Rent' })
  })
})
