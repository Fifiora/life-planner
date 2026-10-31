import { describe, it, expect } from 'vitest'
import { carryOver, milestoneStats, triviaStats } from '../src/lib/study'

const ms = (id: string, week_start: string, member_id: string, text: string, done: boolean) => ({ id, week_start, member_id, text, done })

describe('milestoneStats', () => {
  it('shows completion for each of the last weeks, oldest first', () => {
    const rows = [ms('1', '2026-10-26', 'a', 'x', true), ms('2', '2026-10-26', 'a', 'y', false), ms('3', '2026-11-02', 'b', 'z', true)]
    expect(milestoneStats(rows, '2026-11-02', 3)).toEqual([
      { weekStart: '2026-10-19', total: 0, done: 0, pct: 0 },
      { weekStart: '2026-10-26', total: 2, done: 1, pct: 50 },
      { weekStart: '2026-11-02', total: 1, done: 1, pct: 100 },
    ])
  })
})

describe('carryOver', () => {
  it('copies one person\'s unfinished milestones into the next week, without repeats', () => {
    const rows = [
      ms('1', '2026-10-26', 'a', 'Read ch. 3', false),
      ms('2', '2026-10-26', 'a', 'Practice quiz', true),
      ms('3', '2026-10-26', 'b', 'Not mine', false),
      ms('4', '2026-10-26', 'a', 'Already planned', false),
      ms('5', '2026-11-02', 'a', 'Already planned', false),
    ]
    expect(carryOver(rows, '2026-10-26', '2026-11-02', 'a')).toEqual([{ week_start: '2026-11-02', member_id: 'a', text: 'Read ch. 3', done: false }])
  })
})

describe('triviaStats', () => {
  const topics = [{ id: 't1', topic: 'Cardio', claimed_by: 'a', author_id: 'b' }]
  const questions = [
    { id: 'q1', topic_id: 't1', prompt: '?', options: ['a', 'b', 'c', 'd'], correct_index: 0 },
    { id: 'q2', topic_id: 't1', prompt: '?', options: ['a', 'b', 'c', 'd'], correct_index: 1 },
  ]
  const attempts = [
    { id: '1', question_id: 'q1', member_id: 'a', chosen_index: 0, correct: true },
    { id: '2', question_id: 'q2', member_id: 'a', chosen_index: 0, correct: false },
    { id: '3', question_id: 'q1', member_id: 'b', chosen_index: 0, correct: true },
  ]
  it('rolls up accuracy by topic and by person', () => {
    const out = triviaStats(topics, questions, attempts, [{ id: 'a' }, { id: 'b' }])
    expect(out.byTopic).toEqual([{ topicId: 't1', topic: 'Cardio', questions: 2, attempts: 3, correct: 2, pct: 67 }])
    expect(out.byMember).toEqual([{ memberId: 'a', attempts: 2, correct: 1, pct: 50 }, { memberId: 'b', attempts: 1, correct: 1, pct: 100 }])
  })
})
