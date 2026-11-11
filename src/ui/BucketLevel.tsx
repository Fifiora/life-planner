import { useGame } from '../data/useGame'
import { cap } from '../lib/format'
import { levelProgress } from '../lib/xp'
import type { Bucket } from '../types'

/** My level in one area (Health, Study...) as a small chip. */
export function BucketLevel({ bucket }: { bucket: Bucket }) {
  const game = useGame()
  if (!game.on) return null
  const p = levelProgress(game.me.byBucket[bucket])
  const pct = Math.round((p.into / p.needed) * 100)
  return (
    <span className="bucket-lv" role="img" aria-label={`${cap(bucket)} level ${p.level}`}>
      <span aria-hidden>{`Lv ${p.level}`}</span>
      <span className="bucket-lv-bar" aria-hidden><span style={{ width: `${pct}%` }} /></span>
    </span>
  )
}
