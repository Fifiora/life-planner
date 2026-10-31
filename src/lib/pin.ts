export interface PinRecord {
  v: 1
  salt: string
  hash: string
  iterations: number
}

const ITERATIONS = 150_000

export const isValidPin = (pin: string) => /^\d{4,8}$/.test(pin)

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256)
  return toBase64(new Uint8Array(bits))
}

/** A salted, slow hash of the PIN, so the PIN itself is never stored. */
export async function createPinRecord(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { v: 1, salt: toBase64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS }
}

export const isPinRecord = (x: unknown): x is PinRecord => {
  const r = x as Partial<PinRecord> | null
  return !!r && r.v === 1 && typeof r.salt === 'string' && typeof r.hash === 'string' && typeof r.iterations === 'number'
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  if (!isPinRecord(record) || !pin) return false
  try {
    const candidate = await derive(pin, fromBase64(record.salt), record.iterations)
    let diff = candidate.length ^ record.hash.length
    for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ (record.hash.charCodeAt(i) || 0)
    return diff === 0
  } catch {
    return false
  }
}
