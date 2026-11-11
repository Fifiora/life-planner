import { useEffect, useState } from 'react'

const COLORS = ['#1d6b62', '#d6a560', '#7c6bd6', '#3a8fb7', '#c99a2e', '#2f9e73']

/** Short celebration burst; set `fire` to true to play it. Hidden for reduced-motion users via CSS. */
export function Confetti({ fire }: { fire: boolean }) {
  const [show, setShow] = useState(false)
  const colors = COLORS
  useEffect(() => {
    if (!fire) return
    setShow(true)
    const t = window.setTimeout(() => setShow(false), 2000)
    return () => window.clearTimeout(t)
  }, [fire])
  if (!show) return null
  return (
    <div className="confetti spark" aria-hidden>
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
