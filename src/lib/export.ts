import type { Row } from '../types'
import { newId } from './ids'
import { TABLES } from './tables'

/** JSON text of every table's rows (for backup). */
export function buildExport(tables: Record<string, Record<string, unknown>[]>): string {
  const out: Record<string, Record<string, unknown>[]> = {}
  for (const [name, rows] of Object.entries(tables)) {
    out[name] = rows.map((row) => {
      const { household_id: _omit, ...rest } = row
      return rest
    })
  }
  return JSON.stringify(out, null, 2)
}

/**
 * Reads a backup or starter-data file: { "<table>": [ {row}, ... ], ... }.
 * Rows without an id get one; old household ids are dropped. Throws a readable message if the file is wrong.
 */
export function parseImport(text: string): Record<string, Row[]> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Expected an object with one list per table.')
  }
  const known = TABLES as readonly string[]
  const out: Record<string, Row[]> = {}
  for (const [table, rows] of Object.entries(data)) {
    if (!known.includes(table)) throw new Error(`Unknown table "${table}" in this file.`)
    if (!Array.isArray(rows)) throw new Error(`"${table}" should be a list.`)
    out[table] = rows.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`"${table}" contains something that isn't a row.`)
      }
      const { household_id: _omit, ...rest } = row as Record<string, unknown>
      return { ...rest, id: typeof rest.id === 'string' && rest.id ? rest.id : newId() }
    })
  }
  return out
}
