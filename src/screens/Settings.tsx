import { setThemeChoice, type ThemeChoice } from '../lib/theme'
import { useState } from 'react'
import { useHousehold } from '../data/household'
import { getAllRows, replaceMany } from '../data/tableStore'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { DEFAULT_ANCHOR, todayCT } from '../lib/dates'
import { createPinRecord, isPinRecord, isValidPin } from '../lib/pin'
import { isDate } from '../lib/calendar'
import { downloadText as download, readFileText } from '../lib/files'
import { removeOrphanPhotos } from '../lib/receipts'
import { eraseThisPhone, logOut, reloadApp } from '../lib/session'
import { buildExport, parseImport } from '../lib/export'
import { shareOrCopy } from '../lib/share'
import { buildViewLink, encodeSnapshot, makeSnapshot, trimForSharing } from '../lib/snapshot'
import type { Member, Row } from '../types'
import { PageHead } from '../ui/PageHead'
import { SharedCopyNotice } from '../ui/SharedCopyNotice'
import { SyncCard } from '../ui/SyncCard'
import { StarterPlanLoader } from '../ui/StarterPlanLoader'
import { useThemeChoice } from '../ui/ThemeToggle'
import { useStyleChoice } from '../ui/StyleSwitch'
import { setStyleChoice, type StyleChoice } from '../lib/style'
import { useToast } from '../ui/Toast'


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
  const [flex, setFlex] = useState<string | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)
  const [pinOn, setPinOn] = useState(() => {
    try {
      return isPinRecord(JSON.parse(localStorage.getItem('lp.pin') ?? 'null'))
    } catch {
      return false
    }
  })
  const theme = useThemeChoice()
  const style = useStyleChoice()
  const [lockAfter, setLockAfter] = useState(() => localStorage.getItem('lp.lockAfter') ?? '1')
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

  async function setPin() {
    if (!isValidPin(pin1)) return setPinError('Use 4 to 8 digits.')
    if (pin1 !== pin2) return setPinError("The two PINs don't match.")
    localStorage.setItem('lp.pin', JSON.stringify(await createPinRecord(pin1)))
    sessionStorage.setItem('lp.unlocked', '1') // you just set it, so don't lock yourself out now
    setPinError(null)
    setPin1('')
    setPin2('')
    setPinOn(true)
    toast('PIN set')
  }

  function exportAll() {
    download('life-planner-backup.json', buildExport(getAllRows()))
    localStorage.setItem('lp.lastBackup', String(Date.now()))
    toast('Backup downloaded')
  }

  const snapshot = () => makeSnapshot(trimForSharing(getAllRows(), todayCT()))

  async function shareLink() {
    const url = buildViewLink(window.location.href, await encodeSnapshot(snapshot()))
    setLink(url)
    const result = await shareOrCopy(url, {
      share: typeof navigator.share === 'function' ? (data) => navigator.share(data) : undefined,
      clipboard: navigator.clipboard,
    })
    if (result === 'copied') toast('Link copied')
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return
    try {
      setPending(parseImport(await readFileText(file)))
      setImportError(null)
    } catch (err) {
      setPending(null)
      setImportError(err instanceof Error ? err.message : String(err))
    }
  }

  async function confirmImport() {
    if (!pending) return
    try {
      const photosBefore = getAllRows().expenses ?? []
      await replaceMany(pending)
      if (pending.expenses) void removeOrphanPhotos(photosBefore, pending.expenses)
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
        <label className="label" htmlFor="flex">Extra-spending budget ($ a month)</label>
        <input id="flex" className="input" inputMode="decimal" value={flex ?? settings.get('flex_budget') ?? '1000'} onChange={(e) => setFlex(e.target.value)} />
        <label className="label" htmlFor="anchor">Start of the 2-week cycle (a Monday)</label>
        <input id="anchor" className="input" type="date" value={anchor ?? settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR} onChange={(e) => setAnchor(e.target.value)} />
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              if (target !== null && Number.isFinite(Number(target)) && Number(target) >= 0) await settings.set('savings_target', String(Number(target)))
              if (flex !== null && Number.isFinite(Number(flex)) && Number(flex) >= 0) await settings.set('flex_budget', String(Number(flex)))
              if (anchor === null || isDate(anchor)) await settings.set('biweekly_anchor', anchor ?? settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR)
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

      <SyncCard />

      <section className="card">
        <h2>Starter plan</h2>
        <p className="muted small">Our routines, monthly bills, one-time payoffs and targets come with the site, locked with the passphrase. Load them any time: only what is missing is added, and nothing you changed is touched.</p>
        <StarterPlanLoader />
      </section>

      <section className="card">
        <h2>Appearance</h2>
        <label className="label" htmlFor="theme-choice">Appearance</label>
        <select id="theme-choice" className="input" value={theme} onChange={(e) => setThemeChoice(e.target.value as ThemeChoice)}>
          <option value="system">Match my phone</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <label className="label" htmlFor="style-choice">Style</label>
        <select id="style-choice" className="input" value={style} onChange={(e) => setStyleChoice(e.target.value as StyleChoice)}>
          <option value="anime">Anime</option>
          <option value="classic">Classic</option>
        </select>
      </section>

      <section className="card">
        <h2>App PIN</h2>
        <p className="muted small">An optional lock that asks for a PIN each time the app is opened. It keeps casual eyes out; it doesn't encrypt the data stored on this phone.</p>
        {pinOn ? (
          <>
            <div className="actions">
              <button type="button" className="btn" onClick={() => { sessionStorage.removeItem('lp.unlocked'); reloadApp() }}>Lock now</button>
              <button type="button" className="btn btn-danger" onClick={() => { localStorage.removeItem('lp.pin'); setPinOn(false) }}>Remove PIN</button>
            </div>
            <label className="label" htmlFor="lock-after">Lock when away</label>
            <select id="lock-after" className="input" value={lockAfter} onChange={(e) => { localStorage.setItem('lp.lockAfter', e.target.value); setLockAfter(e.target.value) }}>
              <option value="0">As soon as I leave the app</option>
              <option value="1">After 1 minute away</option>
              <option value="5">After 5 minutes away</option>
              <option value="15">After 15 minutes away</option>
              <option value="-1">Only when I close the app</option>
            </select>
          </>
        ) : (
          <>
            <div className="row2">
              <div>
                <label className="label" htmlFor="pin1">New PIN</label>
                <input id="pin1" className="input" type="password" inputMode="numeric" autoComplete="off" value={pin1} onChange={(e) => setPin1(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="pin2">Repeat PIN</label>
                <input id="pin2" className="input" type="password" inputMode="numeric" autoComplete="off" value={pin2} onChange={(e) => setPin2(e.target.value)} />
              </div>
            </div>
            {pinError && <p role="alert" className="error">{pinError}</p>}
            <div className="actions"><button type="button" className="btn btn-primary" onClick={() => void setPin()}>Set PIN</button></div>
          </>
        )}
      </section>

      <section className="card">
        <h2>This phone</h2>
        <p className="muted small">Log out to forget who is using this phone; your data stays and you can pick a person again. Erasing removes the planner from this phone for good.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => { logOut(); reloadApp() }}>Log out</button>
          {!confirmErase && <button type="button" className="btn btn-danger" onClick={() => setConfirmErase(true)}>Erase this phone</button>}
        </div>
        {confirmErase && (
          <div className="callout bad">
            <p>This deletes everything saved on this phone: routines, bills, ticks, your PIN and any shared copy. Download a backup first if you might need it.</p>
            <div className="actions">
              <button type="button" className="btn btn-danger" onClick={() => { eraseThisPhone(); reloadApp() }}>Yes, erase everything</button>
              <button type="button" className="btn" onClick={() => setConfirmErase(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
