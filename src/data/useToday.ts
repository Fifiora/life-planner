import { useEffect, useState } from 'react'
import { todayCT } from '../lib/dates'

/** Today's Chicago date, refreshed every minute and when the app returns to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayCT())
  useEffect(() => {
    const refresh = () => setToday(todayCT())
    const id = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}
