# Live sync between phones: design

Date: 2026-10-31. Status: awaiting review. Public repo: nothing secret in this file. The Supabase URL and publishable key are public by design.

## Intent
Both partners add and edit on their own phone (or laptop) and see each other's changes within seconds, with no logins. Each device keeps working offline and catches up later. Data stays private: it is encrypted on the device before upload, so the free Supabase project only holds scrambled text.

## Decisions (from the user)
Live sync through Supabase (free tier), pairing by a code instead of accounts, both people can add and edit. The one-tap view-only link stays as it is for read-only guests.

## Security model
- **Pairing code:** 24 characters from a 31-letter alphabet in 6 groups of 4 (about 119 bits), generated on the first phone. It never leaves the phones except when the owner shares it.
- **Derived secrets:** household id = hex SHA-256 of `"lp-household|" + code`; encryption key = HKDF-SHA256 of the code (info `"lp-key"`) used with AES-256-GCM (fresh 12-byte IV per row, stored with the ciphertext, base64).
- **Server:** table `sync_rows` has row level security on and no policies, with all direct access revoked. The only entry points are three `security definer` functions (`sync_push`, `sync_pull`, `sync_ping`) that validate the household id (64 hex characters), rows per push (at most 500) and payload size (at most 64 KB). See `docs/supabase/setup.sql`.
- **Honest limits:** only someone who knows the household id (the Supabase project owner, or its logs) could write to a household; they could delete or garble rows (phones reject garbled rows and remote change times far in the future, and deletes are encrypted and bound to their change time) but could not read anything. Anyone with the public key could fill the free database with junk under random households (capped per push and per household). The code is stored on each phone like the rest of its data; losing every phone and the code means the synced copy cannot be decrypted. Use one tab or window of the app at a time. Receipt photos and the PIN, theme and "who am I" choice are not synced.

## Data and conflict rules
- All tables in `TABLES` sync (including `members`). Each row has its id; the server keeps `payload` (ciphertext of the row JSON), `deleted`, `updated_at` (ms) and a server-ordered `seq`.
- **Last write wins per row:** a push only replaces a row whose `updated_at` is older. Deletions are tombstones (`deleted = true`), so a deleted row stays deleted on every device (this also fixes "reloading the starter plan re-adds deleted rows" for synced households).
- **Timestamps:** `updated_at = max(Date.now(), highest updated_at seen) + 0/1`, so a phone with a slow clock still wins over an older change it has already seen.
- **Local bookkeeping** (not in the rows, so backups and exports are unchanged): `lp.sync.meta` (row id to last updated_at and deleted flag), `lp.sync.cursor` (last pulled seq), `lp.sync.dirty` (rows waiting to upload), `lp.sync.code`.

## Flows
- **Start sharing (first phone):** generate the code, derive keys, upload every local row (`updated_at = now`), show the code with Copy/Share and a warning to keep it safe. Settings then shows status, "Stop syncing on this phone" and a "Test connection" button (calls `sync_ping`).
- **Join (other phone):** enter the code. The phone first downloads a backup file of whatever it already holds, then replaces its data with the shared planner (pull from seq 0). Then the normal "Who are you on this phone?" choice appears. Joining is meant for a phone that has not been used yet; the confirmation says so.
- **Normal operation:** every local change marks rows dirty and is pushed (debounced about 1 second, batches of 200). Pull happens at start, on return to the app, when the phone comes back online, every 20 seconds while visible, and immediately when a Realtime broadcast "changed" message arrives (best effort over a plain WebSocket to Supabase Realtime Broadcast channel `hh:<household id>`). Polling alone keeps working if Realtime is unavailable.
- **Failures:** offline, a paused or unreachable project, or any server error shows "Offline, will sync when back" with exponential backoff (10 s up to 5 min). The planner is never blocked and never loses a local change (dirty rows persist across restarts).
- **Free-tier pause:** a weekly GitHub Actions job calls `sync_ping` to keep the project awake; the app also pings on use.

## Units
- `src/lib/syncCrypto.ts`: code generation and validation, household id, key derivation, encrypt/decrypt a row.
- `src/lib/syncEngine.ts`: the engine, written against two small interfaces (`LocalStore`: read/replace rows, report local changes; `Transport`: `push`, `pull`, `subscribe`, `ping`) so it is tested with two simulated phones and a fake server.
- `src/data/syncRuntime.ts`: wires the engine to `tableStore` (a new hook reports local commits and a way to apply remote rows without echoing) and to the real Supabase transport (`fetch` calls to `/rest/v1/rpc/...`, plus the Realtime socket). Config in `src/lib/syncConfig.ts` (URL and publishable key).
- `src/ui/SyncCard.tsx` (Settings): start, join, code display, status, test connection, stop.
- `src/ui/SyncStatus.tsx`: a small "Synced just now / Syncing / Offline" indicator in the page header.

## Testing
TDD through CI. Engine tests with two simulated phones and a fake server: first upload, join and replace, concurrent edits to the same row (later one wins on both), edits to different rows both survive, delete wins over an older edit, offline queue then reconnect, repeated pulls are idempotent, clock skew, paging past 1000 rows, tampered or wrong-key ciphertext is ignored (not applied) and reported, no echo loops. Crypto tests (round trip, wrong code fails, id is stable and not the code). UI tests with a fake runtime. **Not testable from this sandbox:** the real Supabase project (the sandbox cannot reach it) and Realtime; the "Test connection" button and a two-phone check on the real devices cover that, and I will say exactly what was and was not verified.

## Out of scope
Receipt photos syncing, more than a few devices' presence indicators, per-field merging, end-to-end key rotation, and automatic merging of two phones that each already hold separate data.

## Deviations recorded during the build
Payload cap is 32 KB per row (not 64 KB); a server error shows "Sync problem" while only a network failure shows "Offline"; change stamps are ms x 1000 plus a per-phone 0-999 (so two phones never tie); a rejected row (unreadable, unknown table, change time more than 30 days ahead) is skipped and reported in the status message; joining is refused (and nothing changes) when the shared planner is empty or any of its rows cannot be read; a brand-new phone has to get past the starter-plan unlock and the names screen before it can reach Settings to join; a phone that is sharing counts as having its own planner at start-up.
