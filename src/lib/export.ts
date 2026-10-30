/** JSON text of every table's rows, without the internal household id. */
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
