import type { PipMood } from '../lib/pip'

/** Pip: an original round little spirit whose face shows the mood of the day. */
export function Pip({ mood, size = 64 }: { mood: PipMood; size?: number }) {
  const eyes =
    mood === 'sleepy' ? (
      <>
        <path d="M21 31 q4 3 8 0" /><path d="M35 31 q4 3 8 0" />
      </>
    ) : mood === 'proud' ? (
      <>
        <path d="M21 32 q4 -5 8 0" /><path d="M35 32 q4 -5 8 0" />
      </>
    ) : (
      <>
        <circle cx="25" cy="30" r={mood === 'hyped' ? 4 : 3} fill="var(--ink)" stroke="none" />
        <circle cx="39" cy="30" r={mood === 'hyped' ? 4 : 3} fill="var(--ink)" stroke="none" />
        {mood === 'hyped' && (
          <>
            <circle cx="26.3" cy="28.7" r="1.3" fill="#fff" stroke="none" />
            <circle cx="40.3" cy="28.7" r="1.3" fill="#fff" stroke="none" />
          </>
        )}
      </>
    )
  const mouth =
    mood === 'sleepy' ? <path d="M28 42 h8" /> : mood === 'happy' ? <path d="M26 40 q6 6 12 0" /> : <path d="M25 39 q7 10 14 0 z" fill="var(--ink)" />
  return (
    <svg className={`pip pip-${mood}`} role="img" aria-label={`Pip is ${mood}`} width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M32 8 v-3" />
      <circle cx="32" cy="4.5" r="2.3" fill="var(--brand-2)" />
      <ellipse cx="32" cy="36" rx="23" ry="21" fill="var(--brand)" />
      <ellipse cx="19" cy="40" rx="3.5" ry="2.2" fill="#fff" opacity="0.45" stroke="none" />
      <ellipse cx="45" cy="40" rx="3.5" ry="2.2" fill="#fff" opacity="0.45" stroke="none" />
      {eyes}
      {mouth}
      {mood === 'sleepy' && <text x="46" y="16" fontSize="10" fill="var(--ink)" stroke="none">z</text>}
      {mood === 'proud' && <path d="M52 12 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 z" fill="var(--brand-2)" stroke="none" />}
    </svg>
  )
}
