/** A short Scripture line to close a screen (public-domain King James wording). */
export function Verse({ text, reference }: { text: string; reference: string }) {
  return (
    <footer className="verse">
      <p>“{text}”</p>
      <p className="muted small">— {reference}</p>
    </footer>
  )
}
