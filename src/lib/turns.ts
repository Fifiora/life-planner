/** Whose turn comes after `current`; falls back to the first member if `current` is unknown. */
export function nextTurn(memberIds: string[], current: string): string {
  const i = memberIds.indexOf(current)
  if (i === -1) return memberIds[0]
  return memberIds[(i + 1) % memberIds.length]
}
