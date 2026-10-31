import { verifyPin } from '../lib/pin'
import { recordFromSettingsRows } from '../lib/pinStore'
import { useSyncExternalStore } from 'react'
import { buildExport } from '../lib/export'
import { downloadText } from '../lib/files'
import { deriveKey, formatCode, generateCode, householdId, isValidCode, normalizeCode } from '../lib/syncCrypto'
import { SyncEngine, type KV, type LocalStore, type SyncStatus, type Transport } from '../lib/syncEngine'
import { createSupabaseTransport } from '../lib/syncTransport'
import * as store from './tableStore'

export interface SyncDeps {
  transport: Transport
  kv: KV & { remove(key: string): void }
  local: LocalStore
  now: () => number
  downloadBackup: () => void
  isReadOnly: () => boolean
}

const SYNC_KEYS = ['code', 'meta', 'cursor', 'dirty', 'clock', 'device'].map((k) => `lp.sync.${k}`)
const DEBOUNCE_MS = 1000
const POLL_MS = 20_000
const BACKOFF_START_MS = 10_000
const BACKOFF_MAX_MS = 300_000

function realDeps(): SyncDeps {
  return {
    transport: createSupabaseTransport(),
    kv: { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), remove: (k) => localStorage.removeItem(k) },
    local: { getAll: store.getAllRows, apply: store.applyRemote, onLocalChange: store.onLocalChange },
    now: () => Date.now(),
    // A phone that holds nothing has nothing worth backing up.
    downloadBackup: () => {
      if (store.hasOwnData()) downloadText('life-planner-backup-before-sync.json', buildExport(store.getAllRows()))
    },
    isReadOnly: store.isReadOnly,
  }
}

let deps: SyncDeps | null = null
const getDeps = (): SyncDeps => (deps ??= realDeps())

interface Running {
  engine: SyncEngine
  run: () => Promise<void>
  stop: () => void
}
let running: Running | null = null
let generation = 0 // bumped by every start/join/resume, so a slower, older call can notice it was replaced

// ----- status for the screens -----
let status: SyncStatus | null = null
const listeners = new Set<() => void>()
const publish = (s: SyncStatus | null) => {
  status = s
  listeners.forEach((l) => l())
}
const subscribeStatus = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}
export const getSyncStatus = (): SyncStatus | null => status
/** The live sync state for the screens, or null when this phone is not sharing. */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(subscribeStatus, getSyncStatus)
}

function teardown() {
  running?.stop()
  running = null
}

/** For tests: swap the network, storage and clock, and stop anything running. Pass null to go back to the real ones. */
export function setSyncDepsForTests(d: Partial<SyncDeps> | null): void {
  teardown()
  publish(null)
  deps = d ? { ...realDeps(), ...d } : null
}

async function buildEngine(code: string): Promise<{ engine: SyncEngine; household: string }> {
  const d = getDeps()
  const household = await householdId(code)
  const engine = new SyncEngine({ household, key: await deriveKey(code), local: d.local, transport: d.transport, kv: d.kv, now: d.now })
  return { engine, household }
}

/** Start the automatic syncing: after edits, on a timer, when back online, when another phone nudges. */
function activate(engine: SyncEngine, household: string): Running {
  const d = getDeps()
  let fails = 0
  let retry: ReturnType<typeof setTimeout> | null = null
  let debounce: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  let inflight: Promise<void> | null = null
  let rerun = false
  const attempt = async () => {
    if (stopped || d.isReadOnly()) return
    if (retry) clearTimeout(retry)
    retry = null
    let pushed = 0
    do {
      rerun = false
      pushed += (await engine.syncNow()).pushed
      if (stopped) return
    } while (rerun && engine.status.state === 'idle') // something asked for a sync while this one was running
    const state = engine.status.state
    if (state === 'offline' || state === 'error') {
      retry = setTimeout(() => void run(), Math.min(BACKOFF_START_MS * 2 ** fails, BACKOFF_MAX_MS))
      fails++
    } else {
      fails = 0
      if (pushed > 0) d.transport.notify?.(household)
    }
  }
  // One attempt at a time: several triggers at once share it (so backoff is counted once, with one retry timer).
  const run = (): Promise<void> => {
    if (inflight) {
      rerun = true
      return inflight
    }
    inflight = attempt().finally(() => {
      inflight = null
    })
    return inflight
  }
  // Timers and quiet triggers wait for a pending retry; events that mean "things changed" try right away.
  const quiet = () => void (retry === null && run())
  const now = () => {
    fails = 0
    void run()
  }

  engine.start()
  const offStatus = engine.onStatus((s) => publish(s))
  publish(engine.status)
  const offEdits = d.local.onLocalChange(() => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(quiet, DEBOUNCE_MS)
  })
  const offNudges = d.transport.subscribe(household, now)
  const poll = setInterval(() => document.visibilityState === 'visible' && quiet(), POLL_MS)
  // Coming back: look for news. Leaving: send what is waiting now, before the phone may freeze the page.
  const onVisibility = () => (document.visibilityState === 'visible' ? now() : void run())
  const onHide = () => void run()
  window.addEventListener('online', now)
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    engine,
    run,
    stop: () => {
      stopped = true
      if (retry) clearTimeout(retry)
      if (debounce) clearTimeout(debounce)
      clearInterval(poll)
      offStatus()
      offEdits()
      offNudges()
      window.removeEventListener('online', now)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
      engine.stop()
    },
  }
}

/** The saved pairing code, or null if there is none (or what is saved is not a code). */
export function getCode(): string | null {
  const saved = getDeps().kv.get('lp.sync.code')
  return saved && isValidCode(saved) ? saved : null
}

function clearSyncKeys() {
  const d = getDeps()
  for (const k of SYNC_KEYS) d.kv.remove(k)
}

/** First phone: make a code, upload everything this phone holds, and keep syncing. Returns the code to share. */
export async function startSharing(): Promise<string> {
  const mine = ++generation
  teardown()
  const d = getDeps()
  const code = generateCode()
  const { engine, household } = await buildEngine(code)
  if (mine !== generation) throw new Error('Superseded by a newer request.')
  d.kv.set('lp.sync.code', code)
  running = activate(engine, household)
  engine.markAllDirty()
  await running.run()
  if (mine !== generation) throw new Error('Superseded by a newer request.') // stopped (or replaced) while the first upload ran
  return code
}

/**
 * Other phone: enter the code. A backup of what this phone holds is downloaded first, then this phone is made to
 * match the shared planner. If the shared planner cannot be reached, nothing here changes.
 */
/** The shared planner has a PIN and none was given. */
export class PinRequiredError extends Error {
  constructor() {
    super('This planner has a PIN. Enter it to join.')
    this.name = 'PinRequiredError'
  }
}

export async function joinWithCode(input: string, over?: { downloadBackup?: () => void; pin?: string }): Promise<void> {
  if (!isValidCode(input)) throw new Error("That doesn't look like a pairing code.")
  const d = getDeps()
  const code = formatCode(normalizeCode(input))
  const mine = ++generation
  teardown()
  const { engine, household } = await buildEngine(code)
  try {
    await engine.replaceFromRemote({
      beforeApply: async (tables) => {
        // If the planner has a PIN, this phone must know it before anything is replaced.
        const record = recordFromSettingsRows((tables.settings ?? []) as Record<string, unknown>[])
        if (record) {
          if (!over?.pin) throw new PinRequiredError()
          if (!(await verifyPin(over.pin, record))) throw new Error("That PIN isn't right.")
        }
        ;(over?.downloadBackup ?? d.downloadBackup)() // the backup is taken just before this phone is replaced
      },
    })
    if (mine !== generation) throw new Error('Superseded by a newer request.')
  } catch (err) {
    engine.stop()
    clearSyncKeys()
    publish(null)
    throw err instanceof Error ? err : new Error(String(err))
  }
  localStorage.removeItem('lp.me') // this phone picks "who am I" again
  d.kv.set('lp.sync.code', code)
  running = activate(engine, household)
}

/** On app start: carry on syncing if this phone has been paired. */
export function resumeSync(): void {
  const d = getDeps()
  if (running || d.isReadOnly()) return
  const code = d.kv.get('lp.sync.code')
  if (!code || !isValidCode(code)) return
  const mine = ++generation
  void buildEngine(code)
    .then(({ engine, household }) => {
      if (running || mine !== generation) return
      running = activate(engine, household)
      return running.run()
    })
    .catch(() => undefined) // sync is best effort: never let it break the app
}

/** Forget the code and the sync notes on this phone. The planner's rows stay. */
export function stopSyncing(): void {
  generation++ // a start or resume still in progress must not carry on
  teardown()
  clearSyncKeys()
  publish(null)
}

/** 'ok', or a plain-language reason the shared project cannot be reached. */
export async function testConnection(): Promise<string> {
  try {
    await getDeps().transport.ping()
    return 'ok'
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
