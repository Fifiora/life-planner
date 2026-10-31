import { useEffect, useRef, useState } from 'react'

/** True for a couple of seconds whenever `n` goes up (never when the app first opens). */
export function useIncrease(n: number): boolean {
  const previous = useRef(n)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (n > previous.current) {
      setActive(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setActive(false), 2200)
    }
    previous.current = n
  }, [n])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return active
}
