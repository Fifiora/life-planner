import { useEffect, useState, type CSSProperties } from 'react'
import { AMBIENT_EVENT, getAmbient } from '../lib/ambient'

/** [left %, size px, seconds, delay seconds, sway px, colour variable] */
const FLOWERS: [number, number, number, number, number, string][] = [
  [6, 34, 38, 0, 24, '--brand'],
  [19, 22, 46, -14, -18, '--blue'],
  [33, 40, 52, -30, 30, '--brand-2'],
  [48, 26, 42, -8, -26, '--brand'],
  [62, 36, 56, -22, 22, '--blue'],
  [76, 24, 44, -36, -20, '--brand-2'],
  [90, 32, 50, -4, 28, '--brand'],
]

/** [top %, size px, seconds, delay seconds, bob px, colour variable, swims right-to-left (1) or left-to-right (0)] */
const FISH: [number, number, number, number, number, string, number][] = [
  [14, 46, 52, -6, 14, '--brand', 0],
  [28, 30, 44, -26, -10, '--blue', 1],
  [42, 58, 66, -40, 18, '--brand-2', 0],
  [57, 34, 48, -12, -12, '--blue', 1],
  [70, 50, 60, -32, 16, '--brand', 0],
  [84, 28, 40, -18, -8, '--brand-2', 1],
]

function Flower() {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="20" cy="9.5" rx="6" ry="9.5" transform={`rotate(${r} 20 20)`} />
        ))}
      </g>
      <circle cx="20" cy="20" r="4.2" fill="var(--card-solid)" opacity="0.85" />
    </svg>
  )
}

function Fish() {
  return (
    <svg viewBox="0 0 60 30" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M4 15c8-12 24-14 36-5l14-7v24l-14-7C28 29 12 27 4 15z" />
      <circle cx="14" cy="13" r="1.8" fill="var(--card-solid)" opacity="0.9" />
    </svg>
  )
}

/** Decorative only: fixed behind everything, never takes a tap, and stands still for people who asked for less motion. */
export function Ambient() {
  const [kind, setKind] = useState(getAmbient)
  useEffect(() => {
    const on = () => setKind(getAmbient())
    window.addEventListener(AMBIENT_EVENT, on)
    return () => window.removeEventListener(AMBIENT_EVENT, on)
  }, [])
  if (kind === 'off') return null
  return (
    <div className={`ambient ambient-${kind}`} aria-hidden="true" data-testid="ambient">
      {kind === 'flowers' &&
        FLOWERS.map(([left, size, dur, delay, sway, colour], i) => (
          <span key={i} className="amb-flower" style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `${delay}s`, color: `var(${colour})`, '--sway': `${sway}px` } as CSSProperties}>
            <Flower />
          </span>
        ))}
      {kind === 'fish' && (
        <>
          <span className="amb-water" />
          {FISH.map(([top, size, dur, delay, bob, colour, back], i) => (
            <span key={i} className={`amb-fish${back ? ' back' : ''}`} style={{ top: `${top}%`, width: size, height: size / 2, animationDuration: `${dur}s`, animationDelay: `${delay}s`, color: `var(${colour})`, '--bob': `${bob}px` } as CSSProperties}>
              <Fish />
            </span>
          ))}
        </>
      )}
    </div>
  )
}
