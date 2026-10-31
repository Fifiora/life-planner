import { useState } from 'react'
import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { useToday } from '../data/useToday'
import { cheerLine } from '../lib/voice'
import type { Cheer, RoutineLog } from '../types'
import { useStyleChoice } from './StyleSwitch'

/** Cheers between the two of you: see who cheered you today, and cheer your partner once they have ticked something. */
export function CheerCard() {
  const on = useStyleChoice() === 'anime'
  const { me, members, readOnly } = useHousehold()
  const cheers = useTable<Cheer>('cheers')
  const logs = useTable<RoutineLog>('routine_logs')
  const today = useToday()
  const [busy, setBusy] = useState(false)
  const partner = members.find((m) => m.id !== me.id)
  if (!on || !partner) return null

  const fromIds = [...new Set(cheers.rows.filter((c) => c.to_member === me.id && c.date === today).map((c) => c.from_member))]
  const sent = cheers.rows.some((c) => c.from_member === me.id && c.to_member === partner.id && c.date === today)
  const partnerTicked = logs.rows.some((l) => l.done && l.member_id === partner.id && l.date === today)
  const canSend = !readOnly && partnerTicked && !sent
  if (fromIds.length === 0 && !canSend && !sent) return null

  async function send() {
    if (busy || sent || !partner) return
    setBusy(true)
    await cheers.insert({ from_member: me.id, to_member: partner.id, date: today })
    setBusy(false)
  }

  return (
    <section className="card cheer-card" aria-label="Cheers">
      {fromIds.map((id) => (
        <p key={id} className="cheer-line">{cheerLine(members.find((m) => m.id === id)?.display_name ?? 'Your partner')}</p>
      ))}
      {canSend && <button type="button" className="btn btn-primary" onClick={() => void send()}>{`Cheer ${partner.display_name}`}</button>}
      {sent && <p className="muted small">Cheer sent</p>}
    </section>
  )
}
