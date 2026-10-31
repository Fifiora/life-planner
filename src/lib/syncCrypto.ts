import type { Row } from '../types'

/** No I, L, O, 0 or 1: easy to read out and type. 31 characters. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 24

const encoder = new TextEncoder()

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** Typing is forgiving: case, spaces and dashes do not matter. */
export const normalizeCode = (input: string): string => input.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

export const formatCode = (normalized: string): string => (normalized.match(/.{1,4}/g) ?? []).join('-')

export function isValidCode(input: string): boolean {
  const n = normalizeCode(input)
  return n.length === CODE_LENGTH && [...n].every((c) => CODE_ALPHABET.includes(c))
}

/** A new random pairing code (about 119 bits), shown as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX. */
export function generateCode(): string {
  const limit = 256 - (256 % CODE_ALPHABET.length) // reject the top few values so every character is equally likely
  const out: string[] = []
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(48))) {
      if (b < limit && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length])
    }
  }
  return formatCode(out.join(''))
}

/** What the server sees instead of the code: a one-way hash, so it cannot be turned back into the code. */
export async function householdId(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`lp-household|${normalizeCode(code)}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The key that locks every row, derived from the code (HKDF-SHA256 to AES-256-GCM). */
export async function deriveKey(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(normalizeCode(code)), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('lp-key') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** What the server keeps in the clear next to a row; it is bound into the encryption so it cannot be altered unnoticed. */
export interface RowMeta {
  updated_at: number
  deleted: boolean
}

const aad = (tbl: string, id: string, meta: RowMeta) => encoder.encode(`${tbl}|${id}|${meta.updated_at}|${meta.deleted ? 1 : 0}`)

/** Locks one row (or, for a delete, just its id). The table, id, change time and deleted flag are bound in. Returns base64 (iv + ciphertext). */
export async function encryptRow(key: CryptoKey, tbl: string, row: Row, meta: RowMeta): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(tbl, row.id, meta) }, key, encoder.encode(JSON.stringify(row))))
  const out = new Uint8Array(iv.length + cipher.length)
  out.set(iv)
  out.set(cipher, iv.length)
  return toBase64(out)
}

/** Opens one row; throws if the key, table, id, change time, deleted flag or bytes are wrong. */
export async function decryptRow(key: CryptoKey, tbl: string, id: string, payload: string, meta: RowMeta): Promise<Row> {
  const bytes = fromBase64(payload)
  if (bytes.length < 13) throw new Error('Damaged row.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12), additionalData: aad(tbl, id, meta) }, key, bytes.subarray(12))
  const row = JSON.parse(new TextDecoder().decode(plain)) as Row
  if (!row || row.id !== id) throw new Error('Row does not match its id.')
  return row
}
