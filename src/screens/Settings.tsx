import { useState } from 'react'
import { useHousehold } from '../data/household'
import { getAllRows, replaceMany } from '../data/tableStore'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { DEFAULT_ANCHOR, todayCT } from '../lib/dates'
import { buildExport, parseImport } from '../lib/export'
import { buildViewLink, encodeSnapshot, makeSnapshot, trimForSharing } from '../lib/snapshot'
import type { Member, Row } from '../types'
import { PageHead } from '../ui/PageHead'
import { SharedCopyNotice } from '../ui/SharedCopyNotice'
import { useToast } from '../ui/Toast'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const LONG_LINK = 8000

export default function Settings() {
  const { me, members: people, switchTo } = useHousehold()
  const members = useTable<Member>('members')
  const settings = useSettings()
  const toast = useToast()
  const [target, setTarget] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, Row[]> | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)

  function exportAll() {
    download('life-planner-backup.json', buildExport(getAllRows()))
    localStorage.setItem('lp.lastBackup', String(Date.now()))
    toast('Backup downloaded')
  }

  const snapshot = () => makeSnapshot(trimForSharing(getAllRows(), todayCT()))

  async function shareLink() {
    const url = buildViewLink(window.location.href, await encodeSnapshot(snapshot()))
    setLink(url)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Our Life Planner', url })
        return
      } catch {
        /* cancelled or unsupported: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      /* the link is shown below to copy by hand */
    }
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
      await replaceMany(pending)
      toast('Data imported')
      setPending(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="stack">
      <PageHead title="Settings" sub={`Using the app as ${me.display_name}`} />

      <SharedCopyNotice />

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
        <p className="label">Use the app as</p>
        <div className="actions" style={{ marginTop: 0 }}>
          {people.map((m) => (
            <button key={m.id} type="button" className={`btn${m.id === me.id ? ' btn-primary' : ''}`} aria-pressed={m.id === me.id} onClick={() => switchTo(m.id)}>
              {m.display_name}
            </button>
          ))}
        </div>
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
        <h2>Share with your partner</h2>
        <p className="muted small">
          Makes a view-only copy of today's planner. She can look but not change anything, with no login. Anyone with the
          link can see it, so send it privately. Send a new one whenever you want her to see fresh progress.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => void shareLink()}>Share view-only link</button>
          <button type="button" className="btn" onClick={() => download('life-planner-view.json', JSON.stringify(snapshot()))}>Download view-only file</button>
        </div>
        {link && (
          <>
            <label className="label" htmlFor="the-link">Link</label>
            <textarea id="the-link" className="input" readOnly rows={3} value={link} onFocus={(e) => e.currentTarget.select()} style={{ padding: '0.5rem 0.75rem' }} />
            {link.length > LONG_LINK && (
              <p className="callout">This link is long ({link.length.toLocaleString('en-US')} characters). If your messaging app cuts it off, send the file instead.</p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Your planner is saved only on this phone. Download a backup now and then. On an iPhone, also use Share → Add to Home Screen, or Safari may clear the data after a week of not opening the site.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={exportAll}>Download backup</button>
        </div>
        <label className="label" htmlFor="import-file">Restore or import from a file</label>
        <input id="import-file" className="input" type="file" accept="application/json,.json" onChange={(e) => { void chooseFile(e.target.files?.[0]); e.target.value = '' }} />
        {importError && <p role="alert" className="error">{importError}</p>}
        {pending && (
          <div className="callout">
            <p>This replaces: {Object.entries(pending).map(([t, rows]) => `${t} (${rows.length})`).join(', ')}.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={confirmImport}>Replace my data</button>
              <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
