import { useState } from 'react'
import { gradeAnswer, scoreSummary } from '../lib/trivia'
import type { TriviaQuestion } from '../types'

export function Quiz({
  questions,
  onAnswer,
}: {
  questions: TriviaQuestion[]
  onAnswer: (q: TriviaQuestion, chosen: number, correct: boolean) => void
}) {
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [results, setResults] = useState<{ correct: boolean }[]>([])

  if (questions.length === 0) return <p className="muted">No questions yet. Your partner can add some.</p>

  if (index >= questions.length) {
    const s = scoreSummary(results)
    return (
      <div className="empty">
        <div className="empty-icon" aria-hidden>🏆</div>
        <h3>{s.correct} of {s.total} correct ({s.pct}%)</h3>
        <button type="button" className="btn btn-primary" onClick={() => { setIndex(0); setChosen(null); setResults([]) }}>Play again</button>
      </div>
    )
  }

  const q = questions[index]
  function pick(i: number) {
    if (chosen !== null) return
    const correct = gradeAnswer(q, i)
    setChosen(i)
    setResults((r) => [...r, { correct }])
    onAnswer(q, i, correct)
  }

  return (
    <div>
      <p className="muted small">Question {index + 1} of {questions.length}</p>
      <h3 style={{ margin: '0.4rem 0 0.8rem' }}>{q.prompt}</h3>
      <div className="stack">
        {q.options.map((opt, i) => {
          const isRight = chosen !== null && i === q.correct_index
          const isWrong = chosen === i && i !== q.correct_index
          return (
            <button
              key={i}
              type="button"
              className="btn block"
              style={{
                textAlign: 'left',
                borderColor: isRight ? 'var(--ok)' : isWrong ? 'var(--danger)' : undefined,
                background: isRight ? 'color-mix(in srgb, var(--ok) 14%, transparent)' : undefined,
              }}
              onClick={() => pick(i)}
              disabled={chosen !== null}
            >
              {String.fromCharCode(65 + i)}. {opt} {isRight ? '✓' : isWrong ? '✗' : ''}
            </button>
          )
        })}
      </div>
      {chosen !== null && (
        <button type="button" className="btn btn-primary block mt" onClick={() => { setIndex(index + 1); setChosen(null) }}>
          {index + 1 === questions.length ? 'See score' : 'Next'}
        </button>
      )}
    </div>
  )
}
