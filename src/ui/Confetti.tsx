import { useEffect, useState } from 'react'
import { useStyleChoice } from './StyleSwitch'

const COLORS = ['#16a34a', '#6366f1', '#0284c7', '#ea580c', '#b7791f', '#e11d48']
const SPARK_COLORS = ['#ff6fa8', '#3fe0ff', '#ffd24a', '#b79cff']

/** Short celebration burst; set `fire` to true to play it. Hidden for reduced-motion users via CSS. */
export function Confetti({ fire }: { fire: boolean }) {
  const [show, setShow] = useState(false)
  const spark = useStyleChoice() === 'anime'
  const colors = spark ? SPARK_COLORS : COLORS
  useEffect(() => {
    if (!fire) return
    setShow(true)
    const t = window.setTimeout(() => setShow(false), 2000)
    return () => window.clearTimeout(t)
  }, [fire])
  if (!show) return null
  return (
    <div className={`confetti${spark ? ' spark' : ''}`} aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 60}ms`,
          }}
        />
      ))}
    </div>
  )
}
