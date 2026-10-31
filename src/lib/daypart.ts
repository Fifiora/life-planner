export type Daypart = 'morning' | 'afternoon' | 'evening'

/** Which part of the day an hour (0-23) belongs to. */
export function daypart(hour: number): Daypart {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}
