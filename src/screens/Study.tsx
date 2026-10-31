import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { addDays, todayCT, weekStart } from '../lib/dates'
import { scoreSummary } from '../lib/trivia'
import { carryOver, milestoneStats, triviaStats } from '../lib/study'
import type { Milestone, TriviaAttempt, TriviaQuestion, TriviaTopic } from '../types'
import { PageHead } from '../ui/PageHead'
import { Quiz } from '../ui/Quiz'
import { Sheet } from '../ui/Sheet'

function QuestionForm({ onSave }: { onSave: (q: { prompt: string; options: string[]; correct_index: number }) => void }) {
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState('0')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || options.some((o) => !o.trim())) return setError('Write the question and all four answers')
    onSave({ prompt: prompt.trim(), options: options.map((o) => o.trim()), correct_index: Number(correct) })
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor="q-prompt">Question</label>
      <input id="q-prompt" className="input" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      {options.map((o, i) => (
        <div key={i}>
          <label className="label" htmlFor={`q-opt-${i}`}>Answer {String.fromCharCode(65 + i)}</label>
          <input id={`q-opt-${i}`} className="input" value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
        </div>
      ))}
      <label className="label" htmlFor="q-correct">Correct answer</label>
      <select id="q-correct" className="input" value={correct} onChange={(e) => setCorrect(e.target.value)}>
        {['A', 'B', 'C', 'D'].map((l, i) => <option key={l} value={i}>{l}</option>)}
      </select>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button type="submit" className="btn btn-primary">Save question</button></div>
    </form>
  )
}

export default function Study() {
  const { me, members } = useHousehold()
  const milestones = useTable<Milestone>('milestones')
  const topics = useTable<TriviaTopic>('trivia_topics')
  const questions = useTable<TriviaQuestion>('trivia_questions')
  const attempts = useTable<TriviaAttempt>('trivia_attempts')

  const today = todayCT()
  const thisWeek = weekStart(today)
  const isSunday = new Date(`${today}T00:00:00Z`).getUTCDay() === 0
  const [week, setWeek] = useState(isSunday ? addDays(thisWeek, 7) : thisWeek)
  const [draft, setDraft] = useState('')
  const [topicDraft, setTopicDraft] = useState('')
  const [writingFor, setWritingFor] = useState<TriviaTopic | null>(null)
  const [playing, setPlaying] = useState<TriviaTopic | null>(null)

  const other = members.find((m) => m.id !== me.id) ?? me
  const weekMilestones = milestones.rows.filter((m) => m.week_start === week)
  const stats = milestoneStats(milestones.rows, thisWeek, 4)
  const triviaScores = triviaStats(topics.rows, questions.rows, attempts.rows, members)
  const carry = carryOver(milestones.rows, addDays(week, -7), week, me.id)

  async function deleteTopic(t: TriviaTopic) {
    for (const q of questions.rows.filter((x) => x.topic_id === t.id)) await questions.remove(q.id)
    await topics.remove(t.id)
  }

  async function addMilestone(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    await milestones.insert({ week_start: week, member_id: me.id, text: draft.trim(), done: false })
    setDraft('')
  }

  async function claimTopic(e: FormEvent) {
    e.preventDefault()
    if (!topicDraft.trim()) return
    await topics.insert({ topic: topicDraft.trim(), claimed_by: me.id, author_id: other.id })
    setTopicDraft('')
  }

  return (
    <div className="stack">
      <PageHead title="Study" sub="Sunday plans and trivia for each other." />

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--study)' }} /><h2>Weekly milestones</h2></div>
        </div>
        <div className="row2">
          <button type="button" className={`btn${week === thisWeek ? ' btn-primary' : ''}`} onClick={() => setWeek(thisWeek)}>This week</button>
          <button type="button" className={`btn${week !== thisWeek ? ' btn-primary' : ''}`} onClick={() => setWeek(addDays(thisWeek, 7))}>Next week</button>
        </div>
        {isSunday && <p className="callout">It's Sunday — set next week's milestones.</p>}
        {carry.length > 0 && (
          <button type="button" className="btn block mt edit-only" onClick={() => void Promise.all(carry.map((m) => milestones.insert(m)))}>
            Carry over {carry.length} unfinished from last week
          </button>
        )}
        {members.map((m) => {
          const mine = weekMilestones.filter((x) => x.member_id === m.id)
          return (
            <div key={m.id} className="mt">
              <h3>{m.display_name}</h3>
              {mine.length === 0 ? <p className="muted small">No milestones yet.</p> : (
                <ul className="list">
                  {mine.map((x) => (
                    <li key={x.id} className="list-row" style={{ ['--accent' as string]: 'var(--study)' }}>
                      <button
                        type="button"
                        className={`check${x.done ? ' on' : ''}`}
                        aria-label={`${x.done ? 'Undo' : 'Complete'} ${x.text}`}
                        aria-pressed={x.done}
                        disabled={m.id !== me.id}
                        onClick={() => milestones.update(x.id, { done: !x.done })}
                      >{x.done ? '✓' : ''}</button>
                      <span className="grow" style={{ textDecoration: x.done ? 'line-through' : undefined }}>{x.text}</span>
                      {m.id === me.id && <button type="button" className="icon-btn" aria-label={`Delete ${x.text}`} onClick={() => milestones.remove(x.id)}>✕</button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        <form onSubmit={addMilestone} className="mt" style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" aria-label="New milestone" placeholder="Add a milestone for the week" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--study)' }} /><h2>Last 4 weeks</h2></div></div>
        <ul className="list">
          {stats.map((w) => (
            <li key={w.weekStart} className="cat-row">
              <div className="cat-head">
                <span>Week of {new Date(`${w.weekStart}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                <span className="muted small">{w.total === 0 ? 'no milestones' : `${w.done} of ${w.total} done`}</span>
              </div>
              <div className="bar" role="progressbar" aria-label={`Milestones done, week of ${w.weekStart}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={w.pct}>
                <div className="bar-fill" style={{ width: `${w.pct}%`, background: 'var(--study)' }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--study)' }} /><h2>Trivia nights</h2></div>
        </div>
        <p className="muted small">Claim a topic you're studying; your partner writes multiple-choice questions on it.</p>
        <form onSubmit={claimTopic} className="mt" style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" aria-label="Topic to study" placeholder="Topic I'm studying" value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} />
          <button type="submit" className="btn btn-primary">Claim</button>
        </form>
        {topics.rows.length === 0 ? <p className="muted small mt">No topics yet.</p> : (
          <ul className="list mt">
            {topics.rows.map((t) => {
              const qs = questions.rows.filter((q) => q.topic_id === t.id)
              const mine = attempts.rows.filter((a) => a.member_id === t.claimed_by && qs.some((q) => q.id === a.question_id))
              const s = scoreSummary(mine)
              const claimer = members.find((m) => m.id === t.claimed_by)
              const author = members.find((m) => m.id === t.author_id)
              return (
                <li key={t.id} className="list-row">
                  <span className="grow">
                    <strong>{t.topic}</strong>
                    <span className="muted small block-text">
                      {claimer?.display_name} studies · {author?.display_name} writes questions · {qs.length} question{qs.length === 1 ? '' : 's'}
                      {s.total > 0 ? ` · ${s.pct}% correct` : ''}
                    </span>
                  </span>
                  {t.author_id === me.id && <button type="button" className="btn btn-small" onClick={() => setWritingFor(t)}>Add question</button>}
                  {t.claimed_by === me.id && <button type="button" className="btn btn-small btn-primary" onClick={() => setPlaying(t)}>Play</button>}
                  {(t.claimed_by === me.id || t.author_id === me.id) && (
                    <button type="button" className="icon-btn" aria-label={`Delete topic ${t.topic}`} onClick={() => void deleteTopic(t)}>✕</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--study)' }} /><h2>Trivia scores</h2></div></div>
        {triviaScores.byMember.every((m) => m.attempts === 0) ? (
          <p className="muted small">No quiz answers yet. Play a topic to see scores here.</p>
        ) : (
          <>
            <ul className="list">
              {triviaScores.byMember.map((m) => (
                <li key={m.memberId} className="list-row">
                  <span className="grow">{members.find((x) => x.id === m.memberId)?.display_name}</span>
                  <span>{m.correct} of {m.attempts} right</span>
                  <strong>{m.pct}%</strong>
                </li>
              ))}
            </ul>
            <h3 className="mt">By topic</h3>
            <ul className="list">
              {triviaScores.byTopic.filter((t) => t.attempts > 0).map((t) => (
                <li key={t.topicId} className="list-row">
                  <span className="grow">{t.topic}<span className="muted small block-text">{t.questions} question{t.questions === 1 ? '' : 's'}</span></span>
                  <strong>{t.pct}%</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Sheet open={writingFor !== null} onClose={() => setWritingFor(null)} title={`Question on ${writingFor?.topic ?? ''}`}>
        {writingFor && (
          <QuestionForm
            onSave={async (q) => {
              await questions.insert({ topic_id: writingFor.id, ...q })
              setWritingFor(null)
            }}
          />
        )}
      </Sheet>
      <Sheet open={playing !== null} onClose={() => setPlaying(null)} title={playing?.topic ?? 'Quiz'}>
        {playing && (
          <Quiz
            questions={questions.rows.filter((q) => q.topic_id === playing.id)}
            onAnswer={(q, chosen, correct) => { attempts.insert({ question_id: q.id, member_id: me.id, chosen_index: chosen, correct }) }}
          />
        )}
      </Sheet>
    </div>
  )
}
