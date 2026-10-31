import type { Milestone, TriviaAttempt, TriviaQuestion, TriviaTopic } from '../types'
import { addDays } from './dates'

/** Milestone completion for each of the last `weeks` weeks, oldest first. */
export function milestoneStats(milestones: Milestone[], thisWeek: string, weeks: number) {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (weeks - 1 - i))
    const inWeek = milestones.filter((m) => m.week_start === weekStart)
    const done = inWeek.filter((m) => m.done).length
    return { weekStart, total: inWeek.length, done, pct: inWeek.length ? Math.round((done / inWeek.length) * 100) : 0 }
  })
}

/** One person's unfinished milestones from `fromWeek`, ready to add to `toWeek` (skipping ones already there). */
export function carryOver(milestones: Milestone[], fromWeek: string, toWeek: string, memberId: string) {
  const already = new Set(milestones.filter((m) => m.week_start === toWeek && m.member_id === memberId).map((m) => m.text))
  return milestones
    .filter((m) => m.week_start === fromWeek && m.member_id === memberId && !m.done && !already.has(m.text))
    .map((m) => ({ week_start: toWeek, member_id: memberId, text: m.text, done: false }))
}

const pct = (correct: number, attempts: number) => (attempts ? Math.round((correct / attempts) * 100) : 0)

/** Trivia accuracy by topic and by person. */
export function triviaStats(topics: TriviaTopic[], questions: TriviaQuestion[], attempts: TriviaAttempt[], members: { id: string }[]) {
  return {
    byTopic: topics.map((t) => {
      const ids = new Set(questions.filter((q) => q.topic_id === t.id).map((q) => q.id))
      const mine = attempts.filter((a) => ids.has(a.question_id))
      const correct = mine.filter((a) => a.correct).length
      return { topicId: t.id, topic: t.topic, questions: ids.size, attempts: mine.length, correct, pct: pct(correct, mine.length) }
    }),
    byMember: members.map((m) => {
      const mine = attempts.filter((a) => a.member_id === m.id)
      const correct = mine.filter((a) => a.correct).length
      return { memberId: m.id, attempts: mine.length, correct, pct: pct(correct, mine.length) }
    }),
  }
}
