import { useState } from 'react'
import { useHousehold } from '../data/household'
import { replaceRows } from '../data/tableStore'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { DEFAULT_ANCHOR } from '../lib/dates'
import { buildExport, parseImport } from '../lib/export'
import { clearConfig, loadConfig, readTable } from '../lib/githubStore'
import { TABLES } from '../lib/tables'
import type { Member, Row } from '../types'
import { PageHead } from '../ui/PageHead'
import { useToast } from '../ui/Toast'

export default function Settings() {
  const { me } = useHousehold()
  const members = useTable<Member>('members')
  const settings = useSettings()
  const toast = useToast()
  const [target, setTarget] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, Row[]> | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function exportAll() {
    const cfg = loadConfig()
    if (!cfg) return
    const out: Record<string, Record<string, unknown>[]> = {}
    for (const t of TABLES) {
      const res = await readTable(cfg, t)
      out[t] = res === 'unchanged' ? [] : res.rows
    }
    const url = URL.createObjectURL(new Blob([buildExport(out)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'life-planner-export.json'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    try {
      setPending(parseImport(await file.text()))
      setImportError(null)
    } catch (err) {
      setPending(null)
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  async function confirmImport() {
    if (!pending) return
    try {
      for (const [table, rows] of Object.entries(pending)) await replaceRows(table, rows)
      toast('Data imported')
      setPending(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="stack">
      <PageHead title="Settings" sub={`This phone is ${me.display_name}'s`} />

      <section className="card">
        <h2>Us</h2>
        <p className="muted small">Names and colors show on ticks and lists. Refresh the page after changing them.</p>
        {members.rows.map((m) => (
          <div key={m.id} className="row2" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
            <div>
              <label className="label" htmlFor={`n-${m.id}`}>Name</label>
              <input id={`n-${m.id}`} className="input" defaultValue={m.display_name} onBlur={(e) => e.target.value.trim() && members.update(m.id, { display_name: e.target.value.trim() })} />
            </div>
            <input type="color" aria-label={`Color for ${m.display_name}`} defaultValue={m.color} onBlur={(e) => members.update(m.id, { color: e.target.value })} style={{ width: 44, height: 44, border: 0, background: 'none' }} />
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Targets</h2>
        <label className="label" htmlFor="target">Monthly savings target ($)</label>
        <input id="target" className="input" inputMode="decimal" value={target ?? settings.get('savings_target') ?? '10000'} onChange={(e) => setTarget(e.target.value)} />
        <label className="label" htmlFor="anchor">Start of the 2-week cycle (a Monday)</label>
        <input id="anchor" className="input" type="date" value={anchor ?? settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR} onChange={(e) => setAnchor(e.target.value)} />
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              if (target !== null && Number.isFinite(Number(target)) && Number(target) >= 0) await settings.set('savings_target', String(Number(target)))
              await settings.set('biweekly_anchor', anchor ?? settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR)
              toast('Saved')
            }}
          >Save</button>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Back up everything, or load a data file (such as your starter plan).</p>
        <div className="actions">
          <button type="button" className="btn" onClick={exportAll}>Export data</button>
        </div>
        <label className="label" htmlFor="import-file">Import data from a file</label>
        <input id="import-file" className="input" type="file" accept="application/json,.json" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = '' }} />
        {importError && <p role="alert" className="error">{importError}</p>}
        {pending && (
          <div className="callout">
            <p>
              This replaces: {Object.entries(pending).map(([t, rows]) => `${t} (${rows.length})`).join(', ')}.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={confirmImport}>Replace my data</button>
              <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>This phone</h2>
        <p className="muted small">Disconnecting forgets the GitHub token on this phone only. Your data stays in the repo.</p>
        <div className="actions">
          <button type="button" className="btn btn-danger" onClick={() => { clearConfig(); localStorage.removeItem('lp.me'); window.location.reload() }}>Disconnect this phone</button>
        </div>
      </section>
    </div>
  )
}
