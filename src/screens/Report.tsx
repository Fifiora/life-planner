import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useHousehold } from '../data/household'
import { useReport } from '../data/useReport'
import { useToday } from '../data/useToday'
import { copyText } from '../lib/clipboard'
import { finishedMonths } from '../lib/months'
import { downloadText } from '../lib/files'
import { monthLabel } from '../lib/format'
import { reportFileName, reportToMarkdown } from '../lib/reportText'
import { PageHead } from '../ui/PageHead'
import { ReportView } from '../ui/ReportView'
import { useToast } from '../ui/Toast'

/** Everything that happened in a month, what went well and what to improve. `today` is only given by tests. */
export default function Report({ today }: { today?: string }) {
  const live = useToday()
  const day = today ?? live
  const [params, setParams] = useSearchParams()
  const { members } = useHousehold()
  const toast = useToast()
  const [manual, setManual] = useState<string | null>(null)
  const boxRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (manual !== null) boxRef.current?.select()
  }, [manual])

  const current = day.slice(0, 7)
  const finished = finishedMonths(day)
  const options = [{ value: current, label: `${monthLabel(current)} (so far)` }, ...finished.map((m) => ({ value: m, label: monthLabel(m) }))]
  const wanted = params.get('month')
  const month = options.some((o) => o.value === wanted) ? (wanted as string) : (finished[0] ?? current)
  const report = useReport(month, day)
  const title = `${monthLabel(month)}${month === current ? ' (so far)' : ''}`
  const markdown = () => reportToMarkdown(report, members, monthLabel(month))

  return (
    <div className="stack">
      <PageHead title="Month-end report" sub={title} />
      <div className="report-actions">
        <div>
          <label className="label" htmlFor="report-month">Month</label>
          <select id="report-month" className="input" value={month} onChange={(e) => setParams({ month: e.target.value })}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" onClick={() => window.print()}>Print or save as PDF</button>
        <button type="button" className="btn" onClick={async () => {
          const text = markdown()
          if (await copyText(text)) {
            setManual(null)
            toast('Copied.')
          } else {
            setManual(text)
            toast('Could not copy. Select the text and copy it yourself.')
          }
        }}>Copy as text</button>
        <button type="button" className="btn" onClick={() => downloadText(reportFileName(month), markdown(), 'text/markdown')}>Download as file</button>
      </div>
      {manual !== null && (
        <section className="card">
          <label className="label" htmlFor="report-text">Report text</label>
          <textarea id="report-text" ref={boxRef} className="input" readOnly rows={8} value={manual} />
        </section>
      )}
      <ReportView report={report} members={members} />
    </div>
  )
}
