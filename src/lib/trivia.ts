export function gradeAnswer(q: { correct_index: number }, chosen: number): boolean {
  return q.correct_index === chosen
}

export function scoreSummary(attempts: { correct: boolean }[]): { correct: number; total: number; pct: number } {
  const total = attempts.length
  const correct = attempts.filter((a) => a.correct).length
  return { correct, total, pct: total === 0 ? 0 : Math.round((correct / total) * 100) }
}
