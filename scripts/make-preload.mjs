// Locks a planner snapshot with a passphrase so it can be published safely in this public repo.
//
//   node --experimental-strip-types scripts/make-preload.mjs <snapshot.json> [out.json]
//
// <snapshot.json> is {"v":1,"createdAt":"...","tables":{...}} (keep it OUT of the repo).
// The passphrase is read from $PRELOAD_PASSPHRASE; if unset, a strong random one is made and printed once.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { dirname } from 'node:path'
import { encryptPreload } from '../src/lib/preload.ts'

const [input, output = 'public/preload.enc.json'] = process.argv.slice(2)
if (!input) {
  console.error('Usage: node --experimental-strip-types scripts/make-preload.mjs <snapshot.json> [out.json]')
  process.exit(1)
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I, L, O, 0 or 1
const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const generated = !process.env.PRELOAD_PASSPHRASE
const passphrase = process.env.PRELOAD_PASSPHRASE ?? [group(), group(), group(), group()].join('-')

const plain = readFileSync(input, 'utf8')
JSON.parse(plain) // fail early on a broken input
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, JSON.stringify(await encryptPreload(plain, passphrase)))
console.log(`Wrote ${output}`)
if (generated) console.log(`PASSPHRASE (shown once, keep it safe): ${passphrase}`)
