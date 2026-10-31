import type { Expense } from '../types'

export interface BankRow {
  date: string // YYYY-MM-DD
  description: string
  amount: number // money out is negative
}

function parseLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

function parseDate(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text)
  if (!us) return null
  const year = us[3].length === 2 ? `20${us[3]}` : us[3]
  return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
}

function parseAmount(text: string): number | null {
  if (!text) return null
  const negative = /^\(.*\)$/.test(text) || text.trim().startsWith('-')
  const n = Number(text.replace(/[()$,\s-]/g, ''))
  if (!Number.isFinite(n) || text.replace(/[()$,\s-]/g, '') === '') return null
  return Math.round((negative ? -n : n) * 100) / 100
}

/** Reads a bank export: a header row, then Date / Description / Amount (or Debit and Credit) columns. */
export function parseBankCsv(text: string): BankRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) throw new Error('That file is empty.')
  const header = parseLine(lines[0]).map((h) => h.toLowerCase())
  const find = (re: RegExp) => header.findIndex((h) => re.test(h))
  const dateCol = find(/date/)
  const descCol = find(/desc|detail|memo|payee|name/)
  const amountCol = find(/amount/)
  const debitCol = find(/debit|withdraw/)
  const creditCol = find(/credit|deposit/)
  if (dateCol < 0 || descCol < 0 || (amountCol < 0 && debitCol < 0 && creditCol < 0)) {
    throw new Error('Could not find Date, Description and Amount columns in the first row of that file.')
  }
  const rows: BankRow[] = []
  for (const line of lines.slice(1)) {
    const cells = parseLine(line)
    const date = parseDate(cells[dateCol] ?? '')
    if (!date) continue
    let amount: number | null = null
    if (amountCol >= 0) amount = parseAmount(cells[amountCol] ?? '')
    if (amount === null) {
      const debit = parseAmount(cells[debitCol] ?? '')
      const credit = parseAmount(cells[creditCol] ?? '')
      if (debit !== null) amount = -Math.abs(debit)
      else if (credit !== null) amount = Math.abs(credit)
    }
    if (amount === null) continue
    rows.push({ date, description: cells[descCol] ?? '', amount })
  }
  return rows
}

const RULES: [RegExp, string][] = [
  [/netflix|spotify|youtube|hulu|disney|prime video|amazon prime|apple\.com\/bill|icloud|subscription|openai|chatgpt|claude/, 'subscriptions'],
  [/church|donation|charity|offering|tithe|society of st/, 'giving'],
  [/nail|salon|barber|massage|\bspa\b|braids/, 'beauty'],
  [/insurance|geico|progressive|state farm|allstate/, 'insurance'],
  [/\brent\b|apartment|lease|mortgage/, 'housing'],
  [/electric|power|energy|water|internet|wifi|xfinity|spectrum|t-mobile|verizon|at&t|mobile/, 'utilities'],
  [/\bheb\b|walmart|kroger|aldi|costco|grocery|supermarket|whole foods|target/, 'groceries'],
  [/restaurant|doordash|uber eats|ubereats|grubhub|mcdonald|chick-fil|starbucks|cafe|pizza|taco|burger|grill|kitchen/, 'dining'],
  [/shell|exxon|chevron|valero|\bbp\b|fuel|gas station|car wash|toll|lyft|\buber\b|parking|auto/, 'transport'],
  [/airline|delta|southwest|united air|hotel|airbnb|marriott|flight/, 'travel'],
  [/pharmacy|cvs|walgreens|clinic|dental|doctor|hospital/, 'health'],
  [/western union|remitly|sendwave|wise\.com|moneygram/, 'family'],
  [/loan|best buy|capital one|synchrony/, 'debt'],
]

/** A best guess at what a bank line is; the category can be changed afterwards. */
export function categorize(description: string, amount: number): { kind: 'expense' | 'income' | 'transfer'; category: string } {
  const d = description.toLowerCase()
  if (/transfer (to|from)|to savings|from savings|internal transfer|credit card payment|card payment/.test(d)) return { kind: 'transfer', category: 'transfer' }
  if (amount > 0) return { kind: 'income', category: 'income' }
  const hit = RULES.find(([re]) => re.test(d))
  return { kind: 'expense', category: hit ? hit[1] : 'other' }
}

const keyOf = (date: string, amount: number, description: string) => `${date}|${Math.abs(amount).toFixed(2)}|${description}`

/** Planner entries for rows not imported before (a repeat of the same line is skipped once per copy already there). */
export function newBankRows(existing: Expense[], parsed: BankRow[], memberId: string): Omit<Expense, 'id'>[] {
  const seen = new Map<string, number>()
  for (const e of existing.filter((x) => x.source === 'bank')) {
    const k = keyOf(e.date, e.amount, e.note)
    seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  const out: Omit<Expense, 'id'>[] = []
  for (const row of parsed) {
    const k = keyOf(row.date, row.amount, row.description)
    const left = seen.get(k) ?? 0
    if (left > 0) {
      seen.set(k, left - 1)
      continue
    }
    const { kind, category } = categorize(row.description, row.amount)
    out.push({ date: row.date, amount: Math.abs(row.amount), category, note: row.description, member_id: memberId, kind, source: 'bank' })
  }
  return out
}
