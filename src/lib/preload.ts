// Self-contained on purpose (no imports) so the small publish script can use it directly.

/** A planner locked with a passphrase, safe to publish: only someone with the passphrase can read it. */
export interface PreloadFile {
  v: 1
  kdf: 'PBKDF2-SHA256'
  iterations: number
  salt: string // base64
  iv: string // base64
  data: string // base64 AES-GCM ciphertext (includes its integrity tag)
}

const ITERATIONS = 250_000
const MIN_ITERATIONS = 10_000
const MAX_ITERATIONS = 2_000_000

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}
const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** Typing is forgiving: case and spaces versus dashes do not matter. */
const normalize = (passphrase: string) => passphrase.trim().toUpperCase().replace(/[\s_]+/g, '-')

export function isPreloadFile(x: unknown): x is PreloadFile {
  if (!x || typeof x !== 'object') return false
  const f = x as Record<string, unknown>
  return (
    f.v === 1 &&
    f.kdf === 'PBKDF2-SHA256' &&
    typeof f.iterations === 'number' &&
    typeof f.salt === 'string' &&
    typeof f.iv === 'string' &&
    typeof f.data === 'string'
  )
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(normalize(passphrase)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptPreload(plainText: string, passphrase: string): Promise<PreloadFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt, ITERATIONS)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText))
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) }
}

export async function decryptPreload(file: PreloadFile, passphrase: string): Promise<string> {
  if (!isPreloadFile(file) || file.iterations < MIN_ITERATIONS || file.iterations > MAX_ITERATIONS) {
    throw new Error("This preload file isn't in a format this app understands.")
  }
  try {
    const key = await deriveKey(passphrase, fromBase64(file.salt), file.iterations)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.iv) }, key, fromBase64(file.data))
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error("That passphrase didn't work (or the file was damaged).")
  }
}
